"""Model #1 — the conversational "smart teacher" (LLM + RAG).

Integration with the Claude API. RAG retrieval works against the live Postgres
database with plain keyword search (no external calls needed) — swap
retrieve_context for a pgvector cosine-search version once embeddings are populated.
"""
import os
from app.db import fetch_all
from app.services.text_utils import normalize_ar as _normalize_ar

try:
    import anthropic
except ImportError:  # allows the rest of the app to import cleanly before pip install
    anthropic = None

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
MODEL_NAME = os.environ.get("MANARA_LLM_MODEL", "claude-sonnet-4-5")

SYSTEM_PROMPT = """أنت "المعلّم الذكي" في منصة منارة لتحفيظ القرآن للأطفال.
قواعد صارمة يجب الالتزام بها دائمًا:
1) أجب فقط استنادًا إلى "السياق المرجعي" المرفق أدناه (آيات/تفسير مبسّط/أحاديث مُراجَعة شرعيًا). لا تخترع أحكامًا دينية من عندك.
2) إن لم يكن في السياق المرجعي ما يكفي للإجابة بثقة، أو كان السؤال حساسًا شرعيًا (فتوى، خلاف فقهي، عقيدة)، لا تُجب مباشرة — قل بلطف إنك ستنقل السؤال لمعلّم بشري/لجنة المراجعة، ولا تخترع رأيًا.
3) أسلوبك بسيط ودافئ ومناسب لعمر الطفل (6-12 سنة)، جمل قصيرة، وتشجيع دائم.
4) لا تخرج عن سياق تحفيظ القرآن والحديث والأخلاق الإسلامية للأطفال.
"""


def retrieve_context(query: str, limit: int = 4) -> str:
    """Keyword-based retrieval against the live DB — works today, no API key needed.
    Diacritic-insensitive word match done in Python since the knowledge base is small."""
    stop_words = {"عن", "من", "الى", "إلى", "هل", "ايش", "ماذا", "لماذا", "كيف"}
    q_words = [w.strip("؟?!.,،") for w in _normalize_ar(query).split()]
    q_words = [w for w in q_words if len(w) >= 3 and w not in stop_words]

    def hits(*texts):
        blob = _normalize_ar(" ".join(t or "" for t in texts))
        return any(w in blob for w in q_words)

    all_ayat = fetch_all("SELECT surah_name, ayah_no, text_ar, tafsir_simple FROM quran_ayat")
    all_hadiths = fetch_all("SELECT text_ar, source, explanation_simple FROM hadiths")

    ayat = [a for a in all_ayat if hits(a["text_ar"], a["tafsir_simple"])][:limit]
    hadiths = [h for h in all_hadiths if hits(h["text_ar"], h["explanation_simple"])][:limit]
    parts = []
    for a in ayat:
        parts.append(f"[آية] سورة {a['surah_name']} ({a['ayah_no']}): {a['text_ar']}\nتفسير مبسّط: {a['tafsir_simple']}")
    for h in hadiths:
        parts.append(f"[حديث] {h['source']}: {h['text_ar']}\nشرح مبسّط: {h['explanation_simple']}")
    return "\n\n".join(parts) if parts else "(لا يوجد سياق مطابق في قاعدة المعرفة المُراجَعة)"


def ask(student_message: str) -> dict:
    """Retrieve real context from Postgres, then call the Claude API.
    Without ANTHROPIC_API_KEY it returns the context and a clear note instead of crashing."""
    context = retrieve_context(student_message)

    if not ANTHROPIC_API_KEY or anthropic is None:
        return {
            "context_used": context,
            "reply": None,
            "note": "ضع ANTHROPIC_API_KEY في متغيرات البيئة لتفعيل الرد الفعلي من Claude.",
        }

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    msg = client.messages.create(
        model=MODEL_NAME,
        max_tokens=400,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"السياق المرجعي:\n{context}\n\nسؤال الطفل: {student_message}",
            }
        ],
    )
    reply_text = "".join(block.text for block in msg.content if block.type == "text")
    return {"context_used": context, "reply": reply_text, "note": None}
