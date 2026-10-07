import shutil
import tempfile
import json
from fastapi import APIRouter, UploadFile, File, Form
from app.services import asr_service, srs_service
from app.db import fetch_one, execute

router = APIRouter(prefix="/recite", tags=["recite"])


@router.post("")
def recite(student_id: str = Form(...), ayah_id: int = Form(...), audio: UploadFile = File(...)):
    """The real orchestrator step: ASR -> score -> write attempt -> update spaced
    repetition -> generate a recommendation. Every write below hits the live
    Postgres database (db/schema.sql), not a mock."""
    ayah = fetch_one("SELECT text_ar FROM quran_ayat WHERE id=%s", (ayah_id,))
    if not ayah:
        return {"error": "ayah not found"}

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        shutil.copyfileobj(audio.file, tmp)
        tmp_path = tmp.name

    transcript = asr_service.transcribe(tmp_path)
    result = asr_service.score_recitation(transcript, ayah["text_ar"])

    attempt = execute(
        """INSERT INTO recitation_attempts (student_id, ayah_id, transcript, ai_score, tajweed_errors, model_version)
           VALUES (%s,%s,%s,%s,%s,%s) RETURNING id""",
        (student_id, ayah_id, result["transcript"], result["score"], json.dumps(result["tajweed_errors"]), "tarteel-ai/whisper-base-ar-quran"),
    )

    progress = fetch_one(
        "SELECT ease_factor, interval_days FROM memorization_progress WHERE student_id=%s AND ayah_id=%s",
        (student_id, ayah_id),
    )
    ease = float(progress["ease_factor"]) if progress else 2.5
    interval = progress["interval_days"] if progress else 1
    quality = srs_service.score_to_quality(result["score"])
    new_ease, new_interval, next_review = srs_service.sm2_update(ease, interval, quality)

    execute(
        """INSERT INTO memorization_progress (student_id, ayah_id, status, ease_factor, interval_days, next_review_at, updated_at)
           VALUES (%s,%s,%s,%s,%s,%s, now())
           ON CONFLICT (student_id, ayah_id) DO UPDATE SET
             status = EXCLUDED.status, ease_factor = EXCLUDED.ease_factor,
             interval_days = EXCLUDED.interval_days, next_review_at = EXCLUDED.next_review_at, updated_at = now()""",
        (student_id, ayah_id, "mastered" if quality >= 4 else "learning", new_ease, new_interval, next_review),
    )

    if result["tajweed_errors"]:
        note = result["tajweed_errors"][0]["note"]
        execute(
            """INSERT INTO ai_recommendations (student_id, type, priority, content, source_attempt_id)
               VALUES (%s,'practice_rule',3,%s,%s)""",
            (student_id, note, attempt["id"] if attempt else None),
        )

    return {"attempt_id": attempt["id"] if attempt else None, **result, "next_review_at": str(next_review)}
