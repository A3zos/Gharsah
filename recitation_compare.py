"""Manara: word-level recitation check against a KNOWN ayah (no training needed).

Word-level only. It does NOT judge tajweed/harakat: text is normalised
(no tashkeel, folded letters), so it only sees missing/wrong/extra words.
"""
from difflib import SequenceMatcher
import re

from app.services.text_utils import normalize_ar


def clean_text(t):
    t = normalize_ar(t or "")
    for a, b in (("أ", "ا"), ("إ", "ا"), ("آ", "ا"), ("ٱ", "ا"), ("ى", "ي"), ("ة", "ه"), ("ؤ", "و"), ("ئ", "ي")):
        t = t.replace(a, b)
    t = re.sub(r"[^\w\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()

CLOSE = 0.75  # char-similarity above which a wrong word counts as "close" (likely mispronounced, not another word)


def _sim(a, b):
    return SequenceMatcher(None, a, b).ratio()


def compare(expected, heard, close=CLOSE):
    """Align heard words to expected words (edit-distance DP).

    Returns dict: items=[{expected, heard, status}], score (0..1), counts.
    status: correct | close | wrong | missing | extra
    """
    E = clean_text(expected).split()
    H = clean_text(heard).split()
    n, m = len(E), len(H)
    # cost of substituting: 0 if equal, else 1 - sim (so near-misses are cheap)
    def sub(i, j):
        return 0.0 if E[i] == H[j] else 1.0 - _sim(E[i], H[j])
    INF = 1e9
    D = [[INF] * (m + 1) for _ in range(n + 1)]
    B = [[None] * (m + 1) for _ in range(n + 1)]
    D[0][0] = 0.0
    for i in range(n + 1):
        for j in range(m + 1):
            if i and D[i-1][j] + 1 < D[i][j]:
                D[i][j] = D[i-1][j] + 1; B[i][j] = "del"
            if j and D[i][j-1] + 1 < D[i][j]:
                D[i][j] = D[i][j-1] + 1; B[i][j] = "ins"
            if i and j:
                c = D[i-1][j-1] + sub(i-1, j-1)
                if c < D[i][j]:
                    D[i][j] = c; B[i][j] = "sub"
    items, i, j = [], n, m
    while i or j:
        op = B[i][j]
        if op == "sub":
            e, h = E[i-1], H[j-1]
            st = "correct" if e == h else ("close" if _sim(e, h) >= close else "wrong")
            items.append({"expected": e, "heard": h, "status": st}); i -= 1; j -= 1
        elif op == "del":
            items.append({"expected": E[i-1], "heard": None, "status": "missing"}); i -= 1
        else:
            items.append({"expected": None, "heard": H[j-1], "status": "extra"}); j -= 1
    items.reverse()
    counts = {k: sum(1 for x in items if x["status"] == k)
              for k in ("correct", "close", "wrong", "missing", "extra")}
    score = counts["correct"] / n if n else 0.0
    return {"items": items, "score": round(score, 3), "counts": counts,
            "complete": counts["missing"] == 0 and counts["wrong"] == 0}


def feedback_ar(result, name="يا بطل"):
    """Short child-friendly Arabic feedback from a compare() result (no religious rulings)."""
    c = result["counts"]
    if result["complete"] and c["extra"] == 0:
        return "ما شاء الله! قرأت كل الكلمات." if c["close"] == 0 else "ما شاء الله! قرأت كل الكلمات، وبعضها نطقه قريب جدًا، سنتقنه مع الوقت."
    parts = []
    miss = [x["expected"] for x in result["items"] if x["status"] == "missing"]
    wrong = [x["expected"] for x in result["items"] if x["status"] == "wrong"]
    if miss:
        parts.append("نسيت كلمة: " + "، ".join(miss[:2]))
    if wrong:
        parts.append("راجع كلمة: " + "، ".join(wrong[:2]))
    if not parts:
        parts.append("قريب جدًا")
    return "، ".join(parts) + f". حاول مرة أخرى يا {name}."
