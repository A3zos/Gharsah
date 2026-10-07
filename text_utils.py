"""Shared Arabic text helpers used by both the RAG search (llm_service) and
recitation scoring (asr_service) — kept in one place so the two never drift."""

_TASHKEEL = str.maketrans("", "", "ًٌٍَُِّْٰـ")


def normalize_ar(text: str) -> str:
    """Strips Arabic diacritics (tashkeel/tatweel). Real ASR transcripts (Whisper
    included) come out largely undiacritized, while the Quran text stored in the
    DB is fully vocalized (correct for display and future tajweed-rule analysis) —
    so any comparison between the two MUST normalize first, or scoring is wrong."""
    return (text or "").translate(_TASHKEEL)
