"""Model #2 — recitation & tajweed scoring (ASR).

Real integration with tarteel-ai/whisper-base-ar-quran (Apache-2.0, fine-tuned
Whisper specifically on Quranic Arabic, 5.75% WER) via Hugging Face transformers.

The model weights (~290MB) are downloaded from huggingface.co on first use and cached.
"""
import difflib
import os
from app.services.text_utils import normalize_ar

_pipe = None  # lazy-loaded singleton so the model loads once per process


def _get_pipeline():
    global _pipe
    if _pipe is None:
        from transformers import pipeline
        _pipe = pipeline(
            "automatic-speech-recognition",
            model=os.environ.get("MANARA_ASR_MODEL", "tarteel-ai/whisper-base-ar-quran"),
        )
    return _pipe


def transcribe(audio_path: str) -> str:
    pipe = _get_pipeline()
    result = pipe(audio_path)
    return result["text"].strip()


_TAJWEED_HINTS = [
    ("مد", ["ا", "و", "ي"], "تحقّقي من مدّ الحرف الطويل بالقدر الصحيح"),
    ("غنة", ["ن", "م"], "تحقّقي من الغنّة عند النون أو الميم المشددة"),
]


def score_recitation(transcript: str, expected_text: str) -> dict:
    """Word-level alignment gives an objective 0-100 score (real logic, no external call).
    Comparison is done on normalized (undiacritized) words because ASR output has no
    tashkeel; the ORIGINAL vocalized words are reported in the error list."""
    expected_words = expected_text.split()
    expected_norm = [normalize_ar(w) for w in expected_words]
    got_norm = normalize_ar(transcript).split()

    matcher = difflib.SequenceMatcher(None, expected_norm, got_norm)
    ratio = matcher.ratio()  # 0..1
    score = round(ratio * 100, 1)

    errors = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag != "equal":
            missed = " ".join(expected_words[i1:i2]) or "(كلمة إضافية)"
            errors.append({"rule": "مطابقة النص", "position": missed, "note": "راجعي هذه الكلمة، النطق مختلف عن الآية"})

    return {"score": score, "tajweed_errors": errors, "transcript": transcript}
