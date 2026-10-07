from fastapi import APIRouter, Response
from pydantic import BaseModel
from app.services import tts_service

router = APIRouter(prefix="/speak", tags=["speak"])


class SpeakIn(BaseModel):
    text: str
    gender: str = "boy"


@router.get("/status")
def status():
    return tts_service.info()


@router.post("")
def speak(body: SpeakIn):
    text = (body.text or "").strip()[:1200]
    if not text:
        return {"audio": None, "note": "empty"}
    try:
        audio_bytes = tts_service.synthesize(text, (body.gender or "").lower() in ("girl", "female"))
    except Exception as e:  # quota / network: the page falls back to the browser voice
        return {"audio": None, "note": "tts_error", "detail": str(e)[:200]}
    if audio_bytes is None:
        return {"audio": None, "note": "no_key"}
    return Response(content=audio_bytes, media_type="audio/mpeg",
                    headers={"Cache-Control": "public, max-age=86400"})
