# SAFE

SAFE is a crisis-support web app built for counselors. It starts with a polished landing page, then routes into a live guidance workspace where a counselor can enter a caller situation, receive a suggested response, ask follow-up questions, generate session notes, and optionally play the response aloud.

The app is split into two parts:

- React/Vite frontend at the repo root
- FastAPI backend in `backend/`

## Routes

- `/` - landing page
- `/chat` - SAFE chat/guidance app

React Router handles navigation between the landing page and the chat workspace.

## What The App Uses

- React + TypeScript + Vite
- React Router
- FastAPI
- Groq for main LLM guidance
- Local RAG over the PDFs in `backend/docs`
- Tavily for optional web context
- ElevenLabs for text-to-speech
- Browser speech recognition for caller dictation
- Browser speech synthesis fallback if ElevenLabs voice access fails

## Project Structure

```txt
.
├─ src/
│  ├─ App.tsx
│  ├─ main.tsx
│  ├─ Landingpage.tsx
│  ├─ Landing.css
│  ├─ SafeCopilot.tsx
│  └─ safe-copilot.css
├─ backend/
│  ├─ api.py
│  ├─ groq_client.py
│  ├─ rag_pipeline.py
│  ├─ tavily_search.py
│  ├─ voice_output.py
│  ├─ requirements.txt
│  ├─ .env.example
│  └─ docs/
├─ package.json
└─ README.md
```

## Local Setup

Install frontend dependencies from the project root:

```powershell
cd "C:\Users\saeva\OneDrive\Desktop\nuzrhat project\my-app"
npm install
```

Set up backend dependencies:

```powershell
cd "C:\Users\saeva\OneDrive\Desktop\nuzrhat project\my-app\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create the backend env file:

```powershell
copy .env.example .env
```

Then fill `backend/.env` with real values:

```env
GROQ_API_KEY=
TAVILY_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
```

Do not commit `backend/.env`. It is intentionally ignored by Git.

## Running Locally

Start the backend first:

```powershell
cd "C:\Users\saeva\OneDrive\Desktop\nuzrhat project\my-app\backend"
python -m uvicorn api:app --host 0.0.0.0 --port 8000
```

Do not use `--reload` during normal testing unless you are actively editing backend code. The backend builds the RAG index on startup, and `--reload` can rebuild it every time files change.

Start the frontend in a second terminal:

```powershell
cd "C:\Users\saeva\OneDrive\Desktop\nuzrhat project\my-app"
npm run dev
```

Open the Vite URL and test:

- `/` for the landing page
- `/chat` for the SAFE app

The frontend calls `http://localhost:8000` by default. To point it somewhere else, set:

```env
VITE_SAFE_API_URL=https://your-backend-url.example.com
```

## Backend Endpoints

- `GET /health` - confirms API status and RAG index readiness
- `POST /guidance` - generates risk, phrase, technique, reason, next steps, and quick questions
- `POST /followup` - answers counselor follow-up questions
- `POST /summary` - creates session notes
- `POST /voice` - returns MP3 audio for a phrase

Check backend health locally:

```txt
http://localhost:8000/health
```

`indexReady` should be `true` when the PDFs have loaded successfully.

## RAG Docs

The backend reads documents from:

```txt
backend/docs
```

Current docs include SAMHSA trauma/disaster resources and crisis-support literature. On startup, `rag_pipeline.py` loads the PDFs, creates embeddings, and builds a FAISS index. `/guidance` retrieves relevant document chunks and passes them into the Groq prompt.

Good RAG test prompt:

```txt
Caller is a 19-year-old first-time caller who is breathing fast, feels numb and disconnected, says nothing feels real, and is scared they might lose control. They deny having a plan to hurt themselves but sound overwhelmed and alone.
```

That should pull trauma, grounding, panic, and safety-check context from the docs.

## ElevenLabs Voice Notes

`ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` are different things.

- `ELEVENLABS_API_KEY` is the secret key used to call the API.
- `ELEVENLABS_VOICE_ID` must be an actual voice ID available to that API key/account.

To list voices available to the current API key:

```powershell
cd "C:\Users\saeva\OneDrive\Desktop\nuzrhat project\my-app\backend"
python -c 'import os,json,urllib.request; from dotenv import load_dotenv; load_dotenv(".env"); req=urllib.request.Request("https://api.elevenlabs.io/v1/voices", headers={"xi-api-key": os.getenv("ELEVENLABS_API_KEY")}); data=json.load(urllib.request.urlopen(req)); print("\n".join([v["name"]+"  "+v["voice_id"] for v in data.get("voices", [])]))'
```

If ElevenLabs rejects a voice because of plan or access restrictions, the frontend falls back to browser speech synthesis so the app does not break.

## Quality Checks

Run these before committing:

```powershell
npm run lint
npm run build
```

Python syntax check:

```powershell
python -m py_compile backend\api.py backend\groq_client.py backend\rag_pipeline.py backend\tavily_search.py backend\voice_output.py
```

## Deployment

Deploy as two services.

### Frontend

Deploy the repo root to Vercel.

Recommended Vercel settings:

```txt
Framework Preset: Vite
Root Directory: .
Build Command: npm run build
Output Directory: dist
```

Add this Vercel environment variable:

```env
VITE_SAFE_API_URL=https://your-backend-url.onrender.com
```

### Backend

Deploy `backend/` to Render or Railway.

Recommended Render settings:

```txt
Root Directory: backend
Build Command: pip install -r requirements.txt
Start Command: uvicorn api:app --host 0.0.0.0 --port $PORT
```

Add backend environment variables in the hosting dashboard:

```env
GROQ_API_KEY=
TAVILY_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
```

Never add production secrets to GitHub.

After deploying the backend, test:

```txt
https://your-backend-url.onrender.com/health
```

After deploying the frontend, test:

- `https://your-site.vercel.app/`
- `https://your-site.vercel.app/chat`
- guidance generation
- follow-up answers
- session summary
- voice playback

## Troubleshooting

### Frontend Says Safe API Is Not Reachable

Start the backend:

```powershell
cd "C:\Users\saeva\OneDrive\Desktop\nuzrhat project\my-app\backend"
python -m uvicorn api:app --host 0.0.0.0 --port 8000
```

For deployed frontend, make sure `VITE_SAFE_API_URL` points to the deployed backend URL.

### RAG Keeps Rebuilding

You are probably running Uvicorn with `--reload`. Use:

```powershell
python -m uvicorn api:app --host 0.0.0.0 --port 8000
```

### Recommended Response Is Empty Or Gibberish

The backend has cleanup/parsing logic for Groq responses, but the model can still fail if the prompt gets too long or malformed. Restart backend after code changes and make sure `/health` reports `indexReady: true`.

### ElevenLabs Voice Not Found

The value in `ELEVENLABS_VOICE_ID` is not a voice available to the current API key. List voices with the command in the ElevenLabs section and use one of those IDs.

### ElevenLabs Says Creator Tier Required

The API key may belong to a different/free workspace, or the selected voice may not be available to that account. Confirm the key belongs to the Creator workspace and that the voice ID is accessible.

## Security

API keys should live only in:

- `backend/.env` locally
- Render/Railway environment variables in production

If keys were ever pasted into chat, logs, or committed by accident, rotate them before deployment.
