"""The recommendation engine — classical SM-2 spaced repetition, not an ML
model (see the earlier explanation: this one never needed training at all).
Real, deterministic, fully working right now with no external dependency."""
from datetime import datetime, timedelta


def sm2_update(ease_factor: float, interval_days: int, quality: int):
    """quality: 0-5 rating derived from the ASR score (see orchestrator.py).
    Returns (new_ease_factor, new_interval_days, next_review_at)."""
    quality = max(0, min(5, quality))
    if quality < 3:
        interval_days = 1
    else:
        if interval_days <= 1:
            interval_days = 1
        elif interval_days == 1:
            interval_days = 6
        else:
            interval_days = round(interval_days * ease_factor)
        ease_factor = max(1.3, ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
    next_review = datetime.utcnow() + timedelta(days=interval_days)
    return round(ease_factor, 2), interval_days, next_review


def score_to_quality(ai_score: float) -> int:
    """Maps the ASR 0-100 score onto SM-2's 0-5 quality scale."""
    if ai_score >= 95:
        return 5
    if ai_score >= 85:
        return 4
    if ai_score >= 70:
        return 3
    if ai_score >= 50:
        return 2
    return 1
