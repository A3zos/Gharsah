"""Model #3 — the teacher's voice (Arabic TTS) via ElevenLabs.

Voice choice (male teacher):
1. env MANARA_TTS_VOICE_ID if set (best: pick a voice you like in ElevenLabs and paste its id);
2. otherwise the first male voice in the account whose verified languages include Arabic;
3. otherwise a premade multilingual male voice ("Adam").
"""
import os
import httpx

ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")
MODEL_ID = os.environ.get("MANARA_TTS_MODEL", "eleven_multilingual_v2")
FALLBACK_VOICE = "pNInz6obpgDQGcFmaJgB"  # Adam (premade, multilingual)
_picked = {"id": None, "how": None}
_picked_f = {"id": None, "how": None}
FALLBACK_FEMALE = "21m00Tcm4TlvDq8ikWAM"  # Rachel (premade, multilingual)
SALMA_CONVERSATIONAL = "a1KZUXKFVFDOb33I1uqr"  # "Salma - Conversational Expressive Voice" (Abdulaziz's pick, via razan, 2026-09-28)
BASE = "https://api.elevenlabs.io"

def available() -> bool:
    return bool(os.environ.get("ELEVENLABS_API_KEY", ELEVENLABS_API_KEY))

def _key() -> str:
    return os.environ.get("ELEVENLABS_API_KEY", ELEVENLABS_API_KEY or "")

def voice_id() -> str:
    env = os.environ.get("MANARA_TTS_VOICE_ID")
    if env:
        return env
    if _picked["id"]:
        return _picked["id"]
    vid, how = FALLBACK_VOICE, "fallback-adam"
    try:
        r = httpx.get(f"{BASE}/v1/voices", headers={"xi-api-key": _key()}, timeout=15.0)
        r.raise_for_status()
        for v in r.json().get("voices", []):
            langs = {(x.get("language") or "").lower() for x in (v.get("verified_languages") or [])}
            if "ar" in langs and (v.get("labels") or {}).get("gender", "").lower() == "male":
                vid, how = v["voice_id"], "account-arabic-male:" + v.get("name", "")
                break
    except Exception:
        pass
    _picked.update(id=vid, how=how)
    return vid

def voice_id_female() -> str:
    """Female teacher voice: env MANARA_TTS_VOICE_ID_FEMALE, else "Salma - Conversational"
    (Abdulaziz's requested voice, if it has been added to this ElevenLabs account's voice
    library — a Voice Library voice must be added to the account before its id is usable),
    else the first Arabic female voice already in the account, else Rachel."""
    env = os.environ.get("MANARA_TTS_VOICE_ID_FEMALE")
    if env:
        return env
    if _picked_f["id"]:
        return _picked_f["id"]
    vid, how = FALLBACK_FEMALE, "fallback-rachel"
    try:
        r = httpx.get(f"{BASE}/v1/voices/{SALMA_CONVERSATIONAL}", headers={"xi-api-key": _key()}, timeout=10.0)
        if r.status_code == 200:
            vid, how = SALMA_CONVERSATIONAL, "salma-conversational"
    except Exception:
        pass
    if how == "fallback-rachel":
        try:
            r = httpx.get(f"{BASE}/v1/voices", headers={"xi-api-key": _key()}, timeout=15.0)
            r.raise_for_status()
            for v in r.json().get("voices", []):
                langs = {(x.get("language") or "").lower() for x in (v.get("verified_languages") or [])}
                if "ar" in langs and (v.get("labels") or {}).get("gender", "").lower() == "female":
                    vid, how = v["voice_id"], "account-arabic-female:" + v.get("name", "")
                    break
        except Exception:
            pass
    _picked_f.update(id=vid, how=how)
    return vid

def info() -> dict:
    return {"elevenlabs": available(), "voice": voice_id() if available() else None,
            "how": _picked["how"] if available() else None, "model": MODEL_ID, "female_voice": voice_id_female() if available() else None}

def synthesize(text: str, girl: bool = False) -> bytes | None:
    """Returns raw MP3 bytes, or None if no API key is configured."""
    if not available():
        return None
    resp = httpx.post(
        f"{BASE}/v1/text-to-speech/{voice_id_female() if girl else voice_id()}?output_format=mp3_44100_128",
        headers={"xi-api-key": _key(), "Content-Type": "application/json"},
        json={
            "text": text,
            "model_id": MODEL_ID,
            "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.25, "speed": 0.92},
        },
        timeout=40.0,
    )
    resp.raise_for_status()
    return resp.content
