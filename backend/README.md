# Safe Backend

FastAPI backend for the React SAFE chat route.

## Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Fill `backend/.env` with the Groq, Tavily, and ElevenLabs keys.

## Run

```powershell
cd backend
uvicorn api:app --reload --host 0.0.0.0 --port 8000
```

The React app calls `http://localhost:8000` by default. To point it somewhere else, set:

```env
VITE_SAFE_API_URL=https://your-safe-api.example.com
```

## Endpoints

- `GET /health`
- `POST /guidance`
- `POST /followup`
- `POST /summary`
- `POST /voice`
