import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

ELEVENLABS_API_KEY: Optional[str] = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID: Optional[str] = os.getenv("ELEVENLABS_VOICE_ID")

client = ElevenLabs(api_key=ELEVENLABS_API_KEY) if ELEVENLABS_API_KEY else None


def speak(text: str) -> bytes:
    if client is None or not ELEVENLABS_VOICE_ID:
        raise ValueError("Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID in backend/.env.")

    audio = client.text_to_speech.convert(
        voice_id=ELEVENLABS_VOICE_ID,
        model_id="eleven_multilingual_v2",
        text=text,
        output_format="mp3_44100_128",
    )

    return b"".join(audio)
