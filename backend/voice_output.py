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


class VoiceUnavailableError(RuntimeError):
    pass


def speak(text: str) -> bytes:
    if client is None or not ELEVENLABS_VOICE_ID:
        raise ValueError("Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID in backend/.env.")

    try:
        audio = client.text_to_speech.convert(
            voice_id=ELEVENLABS_VOICE_ID,
            model_id="eleven_multilingual_v2",
            text=text,
            output_format="mp3_44100_128",
        )
    except Exception as exc:
        message = str(exc)
        if "free_users_not_allowed" in message or "creator tier" in message:
            raise VoiceUnavailableError(
                "Selected ElevenLabs voice is not available on this plan. "
                "Set ELEVENLABS_VOICE_ID to a voice included in your account."
            ) from exc

        raise VoiceUnavailableError("ElevenLabs voice generation failed.") from exc

    return b"".join(audio)
