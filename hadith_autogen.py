"""Auto-explain a hadith the guided lesson flow (hadith_agent.py) doesn't have
hand-written content for yet.

Abdulaziz's request (via razan, 2026-09-28): "المفترض الذكاء اي اضفنا لو حديث
مستقبلا يعرف يشرحه" — the AI should be able to explain any hadith we add
later, without someone first hand-writing its meaning/example/quiz/action the
way every hadith in hadith_content.py / hadith_nawawi.py is written today.

This module does NOT change the rule that hadith TEXT and SOURCE are always
fixed, human-supplied strings (getting the Prophet's wording or a citation
wrong is a real-accuracy problem, not a style one — an LLM must never be the
one typing out a hadith). What it changes is everything AROUND the text: for
a hadith dict that only has {id, title, text, source, keywords, ...} and no
"meaning" yet, this generates the meaning/example/quiz/action fields on
demand, grounded strictly in that fixed text + source, in the same simple
warm register as the hand-written ones, and tags the result
"auto_generated": True so whoever reviews content later can find and vet
everything the AI wrote before it's treated as fully final (same spirit as
hadith_nawawi.py's own "needs a scholar's review" note).

Usage: call ensure_explained(h) right after a hadith dict is chosen and
before it's shown to the child (hadith_agent.py's "intro" stage in handle()
is the right spot) — it returns h unchanged if h already has "meaning" (i.e.
it's already curated — which is every hadith in the app today), otherwise
fills the generated fields into h and returns it. Safe to call on every
selection: results are cached in-memory per hadith id, so the LLM is only
asked once per hadith per process lifetime.
"""
import re
import threading

from app.services import llm_service

try:
    import anthropic
except ImportError:  # pragma: no cover
    anthropic = None

SYSTEM_PROMPT = """أنت مساعد يحضّر شرحًا تعليميًا لحديث نبوي شريف لأطفال 6-12 سنة، لمنصة "منارة".
قواعد صارمة يجب الالتزام بها دائمًا:
1) نص الحديث ومصدره ثابتان ومُعطيان لك بالضبط كما هما — لا تُغيّر فيهما حرفًا واحدًا ولا تُعِد صياغتهما ولا تحذف منهما ولا تُضِف.
2) لا تحكم على الحديث بالصحة أو الضعف، ولا تنسب له شيئًا لم يرد فيه.
3) اشرح المعنى العام ببساطة شديدة ودفء، بدون أي حكم فقهي أو خلاف عقدي — إن كان الحديث يحتمل ذلك، اكتف بأبسط معنى عام متفق عليه.
4) أسلوبك بسيط جدًا ومناسب لعمر الطفل، جمل قصيرة، بلا إيموجي ولا قوائم.
5) أعد إجابتك بصيغة JSON فقط بالمفاتيح التالية بالضبط:
{"meaning": "...", "example": "...", "quiz": {"q": "...", "options": ["...", "...", "..."], "answer": 0}, "action": "..."}
- meaning: جملتان إلى ثلاث عن المعنى العام للحديث.
- example: موقف يومي بسيط يقرّب المعنى لطفل.
- quiz: سؤال اختيار من متعدد (3 خيارات)، answer هو index الإجابة الصحيحة (0/1/2).
- action: جملة قصيرة تطلب من الطفل تطبيق الحديث اليوم بعمل بسيط.
لا تكتب أي شيء خارج كائن الـJSON."""

_CACHE = {}
_LOCK = threading.Lock()


def _extract_json(t: str):
    import json
    t = (t or "").strip()
    m = re.search(r"\{.*\}", t, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group())
    except Exception:
        return None


def _generate(h: dict) -> dict | None:
    if anthropic is None or not llm_service.ANTHROPIC_API_KEY:
        return None
    try:
        client = anthropic.Anthropic(api_key=llm_service.ANTHROPIC_API_KEY)
        user = (f"نص الحديث (ثابت، لا يُغيَّر): {h['text']}\nالمصدر (ثابت): {h['source']}\n"
                f"عنوان الحديث: {h.get('title', '')}\n"
                "حضّر شرحًا لهذا الحديث بصيغة الـJSON المطلوبة.")
        msg = client.messages.create(
            model=llm_service.MODEL_NAME,
            max_tokens=500,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(b.text for b in msg.content if b.type == "text")
        data = _extract_json(text)
        if not data or not data.get("meaning") or not data.get("quiz"):
            return None
        return data
    except Exception:
        return None


def ensure_explained(h: dict) -> dict:
    """Returns h as-is if already curated (has 'meaning' — true for every hadith
    in the app today). Otherwise fills in LLM-generated meaning/example/quiz/
    action IN PLACE on h itself (not a copy) and returns h. Tags the result
    auto_generated=True + needs_review=True for a human review pass later.
    If generation isn't possible (no ANTHROPIC_API_KEY, or the model call
    failed), fills in a safe minimal placeholder instead of leaving
    hadith_agent.py to KeyError on h['meaning']."""
    if h.get("meaning"):
        return h
    hid = h.get("id")
    with _LOCK:
        cached = _CACHE.get(hid)
    if not cached:
        cached = _generate(h)
        if not cached:
            cached = {
                "meaning": "هذا حديث جديد ما زلنا نحضّر شرحه المبسّط، لكن يمكننا أن نتلوه معًا ونتدبّره.",
                "example": "فكّر يا بطل كيف يمكن أن تطبّق هذا الحديث في يومك.",
                "quiz": {"q": f"عن ماذا يتحدث حديث \"{h.get('title', '')}\"؟",
                         "options": [h.get("title", "هذا الموضوع"), "شيء آخر", "لا أعرف"], "answer": 0},
                "action": "تحدّث مع أهلك اليوم عن هذا الحديث.",
            }
        cached["auto_generated"] = True
        cached["needs_review"] = True
        with _LOCK:
            _CACHE[hid] = cached
    h.update(cached)
    return h
