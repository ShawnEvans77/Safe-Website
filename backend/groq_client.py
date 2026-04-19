import os
from pathlib import Path
import re
from typing import Optional

from dotenv import load_dotenv
from groq import Groq

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("Missing GROQ_API_KEY in backend/.env.")

client = Groq(api_key=GROQ_API_KEY)


def _clean_context(value: str, max_chars: int) -> str:
    cleaned = "".join(char if char.isprintable() or char in {"\n", "\t"} else " " for char in value)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:max_chars]


def get_response(query: str, rag_context: str, web_context: str) -> str:
    system_prompt = """You are Safe — a clinical assistant for crisis hotline counselors.
Return only valid JSON. Do not use markdown. Do not wrap it in code fences.

Required JSON shape:
{
  "technique": "name of the intervention technique",
  "phrase": "exact phrase the counselor can say right now — warm, human, natural",
  "risk": "Low | Medium | High",
  "reason": "one sentence explaining the risk level",
  "nextSteps": ["short action phrase", "short action phrase", "short action phrase"],
  "questions": ["question to ask the caller", "question to ask the caller", "question to ask the caller"]
}

Rules:
- Base your response only on the context provided.
- If the context is insufficient, make the phrase a safe clarifying question.
- Every string must be normal readable English.
- Never output binary, escaped control characters, or corrupted text."""

    user_prompt = f"""A crisis counselor needs help with this situation:
{query}

CLINICAL CONTEXT FROM DOCUMENTS:
{_clean_context(rag_context, 5000)}

LIVE WEB RESOURCES:
{_clean_context(web_context, 3000)}

Based only on the above context, provide guidance for the counselor."""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=900,
    )

    return response.choices[0].message.content.strip()


def get_followup_response(question: str, situation: str, previous_guidance: str) -> str:
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are Safe — a clinical assistant for crisis counselors. "
                    "Answer concisely in under 4 sentences. End with one suggested phrase."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Situation: {situation}\n"
                    f"Previous guidance: {previous_guidance}\n"
                    f"Follow-up: {question}"
                ),
            },
        ],
        max_tokens=250,
    )
    return response.choices[0].message.content.strip()


def get_session_summary(situation: str, guidance: str, followups: str = "") -> str:
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": """Generate a clinical session note in this format:
CALLER SUMMARY:
INTERVENTION USED:
RISK ASSESSMENT:
COUNSELOR ACTIONS:
FOLLOW-UP NEEDED:
REFERRALS SUGGESTED:""",
            },
            {
                "role": "user",
                "content": (
                    f"Situation: {situation}\n"
                    f"Guidance: {guidance}\n"
                    f"Follow-ups: {followups}"
                ),
            },
        ],
        max_tokens=400,
    )
    return response.choices[0].message.content.strip()
