from contextlib import asynccontextmanager
import json
from pathlib import Path
import re
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from groq_client import get_followup_response, get_response, get_session_summary
from rag_pipeline import DOCS_DIR, build_index, retrieve
from tavily_search import search_web
from voice_output import VoiceUnavailableError, speak

index_ready = False
index_error = ""


@asynccontextmanager
async def lifespan(_: FastAPI):
    global index_ready, index_error
    try:
        print(f"Building Safe RAG index from {DOCS_DIR}...")
        build_index(DOCS_DIR)
        index_ready = True
        index_error = ""
        print("Safe API is ready.")
    except Exception as exc:
        index_ready = False
        index_error = str(exc)
        print(f"Safe index failed to build: {exc}")
    yield


app = FastAPI(title="Safe API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class GuidanceRequest(BaseModel):
    situation: str


class FollowupRequest(BaseModel):
    question: str
    situation: str
    previous_guidance: str


class SummaryRequest(BaseModel):
    situation: str
    guidance: str
    followups: str = ""


class VoiceRequest(BaseModel):
    text: str


class GuidanceResponse(BaseModel):
    technique: str
    phrase: str
    risk: str
    reason: str
    nextSteps: List[str]
    questions: List[str]


def parse_guidance(response: str) -> GuidanceResponse:
    def clean(value: str) -> str:
        printable = "".join(
            char for char in value if char.isprintable() or char in {"\n", "\t"}
        )
        printable = re.sub(r"\s+", " ", printable)
        return printable.strip().strip('"').strip("'").strip()

    def readable(value: str) -> bool:
        value = clean(value)
        if len(value) < 8:
            return False
        letters = sum(char.isalpha() for char in value)
        return letters / max(len(value), 1) > 0.45

    def extract_json_object(value: str) -> dict | None:
        start = value.find("{")
        while start != -1:
            depth = 0
            in_string = False
            escape = False

            for index in range(start, len(value)):
                char = value[index]
                if in_string:
                    if escape:
                        escape = False
                    elif char == "\\":
                        escape = True
                    elif char == '"':
                        in_string = False
                    continue

                if char == '"':
                    in_string = True
                elif char == "{":
                    depth += 1
                elif char == "}":
                    depth -= 1
                    if depth == 0:
                        candidate = value[start:index + 1]
                        try:
                            payload = json.loads(candidate)
                            return payload if isinstance(payload, dict) else None
                        except json.JSONDecodeError:
                            break

            start = value.find("{", start + 1)

        return None

    payload = extract_json_object(response)
    if payload:
        phrase = clean(str(payload.get("phrase", "")))
        if readable(phrase):
            return GuidanceResponse(
                technique=clean(str(payload.get("technique", ""))) or "Supportive listening",
                phrase=phrase,
                risk=clean(str(payload.get("risk", ""))) or "Low",
                reason=clean(str(payload.get("reason", ""))) or "Safe did not return a separate risk explanation.",
                nextSteps=[
                    clean(str(step))
                    for step in payload.get("nextSteps", [])
                    if clean(str(step))
                ][:3],
                questions=[
                    clean(str(question))
                    for question in payload.get("questions", [])
                    if clean(str(question))
                ][:3],
            )

    technique = ""
    phrase = ""
    risk = "Low"
    reason = ""
    next_steps: List[str] = []
    questions: List[str] = []
    current_section = ""

    for line in response.splitlines():
        value = line.strip()
        if not value:
            continue

        normalized = re.sub(r"^[\s>*#`_\-•]+", "", value).strip()
        label_match = re.match(
            r"^(TECHNIQUE|PHRASE|RISK|REASON|NEXT\s+STEPS|QUESTION\s*[123])\s*[:\-–—]\s*(.*)$",
            normalized,
            re.IGNORECASE,
        )

        if label_match:
            label = re.sub(r"\s+", " ", label_match.group(1).upper())
            content = clean(label_match.group(2))
            current_section = label

            if label == "TECHNIQUE":
                technique = content
            elif label == "PHRASE":
                phrase = content
            elif label == "RISK":
                risk = content or risk
            elif label == "REASON":
                reason = content
            elif label == "NEXT STEPS":
                current_section = "NEXT STEPS"
                if content:
                    next_steps.append(content)
            elif label.startswith("QUESTION"):
                if content:
                    questions.append(content)
            continue

        bullet_match = re.match(r"^(?:[-•*]|\d+[.)])\s*(.+)$", normalized)
        if bullet_match and current_section == "NEXT STEPS" and len(next_steps) < 3:
            next_steps.append(clean(bullet_match.group(1)))
            continue

        if current_section == "PHRASE" and not phrase:
            phrase = clean(normalized)
        elif current_section == "REASON" and not reason:
            reason = clean(normalized)

    if not readable(phrase):
        nonempty_lines = [clean(line) for line in response.splitlines() if clean(line)]
        phrase = next((line for line in nonempty_lines if readable(line)), "")

    if not readable(phrase):
        phrase = "I’m here with you. Let’s slow this down and take one step at a time."

    if not technique:
        technique = "Supportive listening"

    if not reason:
        reason = "Safe did not return a separate risk explanation."

    return GuidanceResponse(
        technique=technique,
        phrase=phrase,
        risk=risk,
        reason=reason,
        nextSteps=next_steps[:3],
        questions=questions[:3],
    )


@app.post("/guidance", response_model=GuidanceResponse)
async def get_guidance(req: GuidanceRequest):
    situation = req.situation.strip()
    if not situation:
        raise HTTPException(status_code=400, detail="Situation is required.")
    if not index_ready:
        raise HTTPException(status_code=503, detail=f"RAG index is not ready: {index_error}")

    rag_results = retrieve(situation)
    rag_context = "\n\n".join(rag_results)
    web_context = search_web(situation)
    response = get_response(situation, rag_context, web_context)
    return parse_guidance(response)


@app.post("/followup")
async def get_followup(req: FollowupRequest):
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")

    answer = get_followup_response(question, req.situation, req.previous_guidance)
    return {"answer": answer}


@app.post("/summary")
async def get_summary(req: SummaryRequest):
    if not req.situation.strip() or not req.guidance.strip():
        raise HTTPException(status_code=400, detail="Situation and guidance are required.")

    summary = get_session_summary(req.situation, req.guidance, req.followups)
    return {"summary": summary}


@app.post("/voice")
async def get_voice(req: VoiceRequest):
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required.")

    try:
        audio = speak(text)
    except VoiceUnavailableError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return Response(content=audio, media_type="audio/mpeg")


@app.get("/health")
async def health():
    docs = sorted(path.name for path in Path(DOCS_DIR).glob("*") if path.is_file())
    return {
        "status": "ok" if index_ready else "degraded",
        "indexReady": index_ready,
        "indexError": index_error,
        "docsPath": str(DOCS_DIR),
        "docs": docs,
    }
