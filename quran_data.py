"""Full Quran for the teacher: 114 surahs / 6236 ayat (Tanzil text) + Tafsir Al-Muyassar per ayah.

Nothing here is written by an LLM. Text is Tanzil's (verbatim); tafsir is Al-Muyassar (verbatim).
Only Al-Fatiha has the hand-written child-level lesson (lesson_content.LESSON).
"""
import json
import os
import re

from app.services.lesson_content import LESSON as FATIHA
from app.services.text_utils import normalize_ar

_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
_Q = None
_T = None
CHUNK = 5           # ayat per session for surahs without a curated lesson
AUDIO_URL = "https://everyayah.com/data/Alafasy_128kbps/{surah:03d}{ayah:03d}.mp3"
_ALIASES = {"الرحمان": 55, "ياسين": 36, "اقرا": 96, "طه": 20, "الفاتحه": 1, "ام الكتاب": 1}
_AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def _load():
    global _Q, _T
    if _Q is None:
        with open(os.path.join(_DIR, "quran_uthmani.json"), encoding="utf-8") as f:
            _Q = json.load(f)
        with open(os.path.join(_DIR, "tafseer_muyassar.json"), encoding="utf-8") as f:
            _T = json.load(f)
    return _Q, _T


def _key(t):
    t = normalize_ar(t or "")
    for a, b in (("أ", "ا"), ("إ", "ا"), ("آ", "ا"), ("ٱ", "ا"), ("ى", "ي"), ("ة", "ه"), ("ؤ", "و"), ("ئ", "ي")):
        t = t.replace(a, b)
    t = re.sub(r"[^\w\s]", " ", t)
    t = re.sub(r"\bسوره\b", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def surah_list():
    q, _ = _load()
    return [{"n": s["n"], "name": s["name"], "count": len(s["ayat"])} for s in q]


def find_surah(text):
    """'سورة الإخلاص' / 'الاخلاص' / '112' -> 112. None if not found."""
    q, _ = _load()
    raw = (text or "").translate(_AR_DIGITS)
    m = re.search(r"\b(\d{1,3})\b", raw)
    if m and 1 <= int(m.group(1)) <= 114:
        return int(m.group(1))
    k = _key(raw)
    if not k:
        return None
    for alias, target in _ALIASES.items():
        if alias in k:
            return target
    names = {s["n"]: _key(s["name"]) for s in q}
    for n, nk in names.items():          # exact
        if k == nk or k == "ال" + nk or ("ال" + k) == nk:
            return n
    hits = [(len(nk), n) for n, nk in names.items() if len(nk) >= 4 and nk in k]
    if hits:
        return max(hits)[1]
    nokey = lambda x: x[2:] if x.startswith("ال") else x
    hits = [(len(nokey(nk)), n) for n, nk in names.items() if len(nokey(nk)) >= 3 and nokey(nk) in k.replace("ال", "")]
    return max(hits)[1] if hits else None


def chunks(n):
    """Ayah ranges (start, end) 1-based inclusive for a surah."""
    q, _ = _load()
    total = len(q[n - 1]["ayat"])
    if n == 1:
        return [(1, total)]
    out, s = [], 1
    while s <= total:
        e = min(s + CHUNK - 1, total)
        if total - e <= 2:
            e = total
        out.append((s, e)); s = e + 1
    return out


def _plan(k):
    if k == 1:
        return ["كرّر الآية بصوت مسموع خمس مرات.", "سمّعها لأحد والديك قبل النوم."]
    steps = ["كرّر الآية الأولى بصوت مسموع خمس مرات."]
    if k >= 2:
        steps.append("اقرأ الآية الثانية خمس مرات، ثم اجمعها مع الأولى ثلاث مرات.")
    for i in range(3, k + 1):
        steps.append(f"أضف الآية {i}، ثم اقرأ كل الآيات من البداية مرتين.")
    steps.append("سمّع ما حفظته لأحد والديك قبل النوم.")
    return steps


def build_lesson(n, chunk=0):
    """Lesson dict for surah n, chunk index. Same keys as lesson_content.LESSON plus first_ayah/has_more/curated."""
    q, t = _load()
    sur = q[n - 1]
    rng = chunks(n)
    chunk = max(0, min(chunk, len(rng) - 1))
    a, b = rng[chunk]
    if n == 1:
        L = dict(FATIHA)
        L.update(first_ayah=1, has_more=False, curated=True, chunk=0, chunks=1, surah_name=sur["name"])
        return L
    ay = sur["ayat"][a - 1:b]
    return {
        "surah_no": n, "surah_name": sur["name"], "title": f"سورة {sur['name']}",
        "meta": f"السورة رقم {n} · {len(sur['ayat'])} آية · الآيات {a} إلى {b}",
        "ayat": [x["i"] for x in ay], "ayat_uthmani": [x["u"] for x in ay],
        "tafsir": [t.get(f"{n}:{i}", "") for i in range(a, b + 1)],
        "fadl": None, "plan": _plan(len(ay)),
        "first_ayah": a, "has_more": chunk < len(rng) - 1, "curated": False, "chunk": chunk, "chunks": len(rng),
    }


def audio_url(n, ayah):
    return AUDIO_URL.format(surah=n, ayah=ayah)
