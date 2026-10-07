"""Model #4 — the live "AI teacher" agent (المعلم عبدالله).

A guided, human-like conversation with the child, in Arabic, like a real teacher:

  greet (كيفك؟) -> name -> surah selection
  -> lesson intro (Al-Fatiha) -> tafsir -> fadl -> recitation (listen + repeat)
  -> tajweed (simple recitation rules) -> plan -> done

(age/why-did-you-come/why-Manara used to sit between name and surah selection —
removed per razan's request to shorten the flow and match the hadith path,
which never had them. None of the three collected anything used elsewhere.)

* The FLOW is a deterministic state machine, so a session always reaches the end.
* Religious CONTENT comes only from `lesson_content.py` (fixed, reviewed). The LLM is
  used only for warm wording, and for answering the child's interruptions (RAG).
* The child can interrupt at ANY moment ("يا معلم عندي سؤال").
* Works without an API key (scripted wording); with ANTHROPIC_API_KEY it is conversational.
"""
import concurrent.futures
import difflib
import json
import os
import random
import re
import threading
import time
import uuid

from app.services import llm_service
from app.services.lesson_content import LESSON, TAJWEED_RULES, tajweed_for_lesson
from app.services import quran_data
from app.services import pilot_config
from app.services.recitation_compare import compare as _cmp, feedback_ar as _fb
from app.services.text_utils import normalize_ar
from app.services import voice_persona as vp
from app.services import progress
from app.services import child_profile
from app.services import session_store
from app.services import error_log
from app.services import flag_log

try:
    import anthropic
except ImportError:  # pragma: no cover
    anthropic = None

TEACHER_NAME = "المعلم عبدالله"
# Sonnet is used for real reasoning (answering the child's own questions against the
# retrieved context). The much shorter "warm wording" calls that fire on almost every
# stage transition use a faster/cheaper model instead, since they only rephrase an
# already-correct scripted fallback and don't need Sonnet-level reasoning — this cuts
# both response latency and API cost noticeably.
MODEL_NAME = os.environ.get("MANARA_LLM_MODEL", "claude-sonnet-4-5")
FAST_MODEL_NAME = os.environ.get("MANARA_LLM_FAST_MODEL", "claude-haiku-4-5")
AUDIO_URL = "https://everyayah.com/data/Alafasy_128kbps/{surah:03d}{ayah:03d}.mp3"

STAGES = ["greet", "surah", "lesson_intro", "tafsir", "fadl",
          "recitation", "tajweed", "plan", "done"]
STAGE_LABELS = {
    "greet": "الترحيب",
    "surah": "اختيار السورة", "lesson_intro": "بداية الدرس", "tafsir": "التفسير",
    "fadl": "الفضائل", "recitation": "التلاوة", "tajweed": "أحكام التجويد", "plan": "خطة الحفظ", "done": "النهاية",
}
TEXT_STAGES = {"greet", "surah"}

PERSONA = f"""أنت "{TEACHER_NAME}"، معلّم قرآن رجل لطيف يتحدث مع طفل عمره 6-12 سنة في منصة "غرسة".
تتصرف مثل معلّم إنسان حقيقي: دافئ، صبور، مبتسم، تشجّع الطفل دائمًا، وتناديه باسمه إذا عرفته.
اللغة: عربية بسيطة جدًا قريبة من لهجة الأطفال، وجمل قصيرة جدًا (جملة واحدة إلى جملتين على الأكثر لكل رد، خصوصًا في بداية الجلسة والتعارف). لا تُطل الكلام أبدًا، وادخل في السؤال مباشرة دون مقدمات طويلة. لا رموز ولا قوائم ولا إيموجي.
اكتب كل جملة بلا أي تشكيل أو حركات إطلاقًا (بدون فتحة أو ضمة أو كسرة أو سكون أو تنوين) — اكتب الحروف فقط كما تُكتب عادة، ودع نظام الصوت يتولى النطق. التزم حرفيًا بتعليمات اللهجة المذكورة أدناه في كل جملة تقولها؛ لا تكتب بالفصحى.
احترام القرآن في أسلوبك: تحدّث عن القرآن والآيات بوقار واحترام يليق بكلام الله، لا بأسلوب عامي طفولي. لا تصف السورة أو الآية بأنها "حلوة" أو "جميلة" بأسلوب سطحي؛ استخدم بدلاً من ذلك كلمات مثل "نتدبّر"، "نتأمل"، "المباركة"، "العظيمة". لا تفرط في استخدام كلمة "تمام" كحشو في كل جملة؛ نوّع في كلماتك (مثل: ممتاز، أحسنت، جيد جدًا) أو انتقل مباشرة للسؤال التالي بدون كلمة حشو.
ذكّر الطفل بين الحين والآخر (بجملة قصيرة واحدة، دون إطالة ودون تكرارها في كل رد) أن حفظ كلام الله وتعلّمه أجرٌ وحسناتٌ عظيمة عند الله، وأن الثمرة الحقيقية للقرآن ليست الحفظ وحده بل أن يقوّم القرآن سلوك الطفل وأخلاقه، وأن يعمل بما تعلّمه من آيات وسور في تصرفاته اليومية.
التزم بآداب معلم القرآن المعروفة: "علّموا ويسّروا ولا تعسّروا، وبشّروا ولا تنفّروا" — اجعل التعلّم سهلًا لا معقّدًا، وشجّع الطفل دائمًا. إذا أخطأ الطفل في التلاوة أو الإجابة، صحّح له بلطف شديد جدًا دون تعنيف أو تسخيف أو سخرية أبدًا؛ الرفق بالمتعلم من صفات معلم القرآن الحقيقي.
قواعد صارمة:
- لا تخترع أي آية أو حديث أو حكم شرعي. اعتمد فقط على "السياق المرجعي" و"الحقائق" المرفقة لأي معلومة دينية.
- إن كان السؤال فقهيًا أو عقديًا حساسًا، أو لا يوجد له سياق مرفق، أو بدا لك سؤالًا "بسيطًا" لكنه خارج ما هو مرفق لك — قل بلطف إنك ستسأل معلّمًا مختصًا وتخبره، ولا تجتهد ولا تُفتِ من عندك أبدًا مهما بدا السؤال سهلًا.
- إذا تكلم الطفل عن شيء خارج الدرس (لعبة، برنامج كرتون، سؤال عام لا علاقة له بالدرس) فلا تتجاهله ولا ترفض الحديث معه: تفاعل معه بدفء بجملة واحدة قصيرة، ثم أعده بلطف شديد إلى الدرس دون توبيخ أو تسخيف لما قاله.
- إذا بدت على الطفل مشاعر (حزن، خوف، تعب، غضب) فاطمئنه بحنان أولًا قبل أي شيء آخر، ولا تكمل الدرس وكأن شيئًا لم يكن.
- اكتب الكلام الذي ستقوله بصوتك فقط، دون عناوين ولا شرح لما تفعل.
- ممنوع منعًا نهائيًا أن تقول أو تُلمّح إلى أنك نموذج ذكاء اصطناعي، أو "Claude"، أو من شركة Anthropic، أو أي شركة تقنية، وممنوع ذكر أي شيء عن كيف تم تدريبك أو بياناتك أو أنك برنامج. إن سألك الطفل أو أي شخص "هل أنت روبوت؟" أو "من صنعك؟" أو ما شابه، أجب بثقة ولطف إنك {TEACHER_NAME} من منصة غرسة، وحوّل الحديث بلطف إلى الدرس.
- "السلام عليكم" تحية تُقال فقط عند بداية اللقاء. عند إنهاء الجلسة أو توديع الطفل لا تقل أبدًا "السلام عليكم"، بل ودّعه بعبارة مثل "مع السلامة" أو "في أمان الله" أو "إلى اللقاء"."""

# response-variety templates (Abdulaziz's request, 2026-09-29: replies
# shouldn't feel like a fixed script) -- all still instant random.choice picks,
# no LLM call, so none of this costs any latency; same technique already used
# for _CLOSING_TEMPLATES below.
_GREET_TEMPLATES = [
    "السلام عليكم! أنا {t}. كيف حالك يا {n}؟",
    "السلام عليكم يا {n}! أنا {t}، وايد سعيد إني بجلس معك اليوم. كيفك؟",
    "السلام عليكم! معك {t}. وش أخبارك يا {n} اليوم؟",
    "السلام عليكم يا {n}! أنا {t}، جاهز نبدأ درسنا الحلو. كيف حالك؟",
]
_PRAISE_TEMPLATES = [
    "ما شاء الله! تلاوتك ممتازة يا {n}. ",
    "رائع يا {n}! نطقك واضح وزين. ",
    "أحسنت يا {n}! تلاوة جميلة فعلاً. ",
    "ممتاز يا {n}! استمر على كذا. ",
]

_CONTINUE_WORDS = ["اكمل", "اكملي", "كمل", "كملي", "كمّل", "كمّلي", "تابع", "تابعي", "استمر", "استمري",
    "نكمل", "يلا", "يالله", "هيا", "تمام", "نعم", "ايوه",
    "اي نعم", "جاهز", "حاضر", "طيب", "جاهزة", "جاهزه", "مستعدة", "مستعده", "مستعد", "ok", "okay", "next", "التالي", "ابدا", "ابدأ", "خلاص", "موافق", "شكرا", "شكراً"]
_SKIP_WORDS = ["تخطي", "تخطى", "تجاوز", "الي بعده", "التالية", "skip"]
# the child wants to end the lesson NOW, from any stage (not just the closing
# "done" stage) — e.g. "لا تكمل" while mid-lesson. Multi-word phrases match as a
# substring (specific enough to be safe); single ambiguous words (like "بس" or
# "خلاص", which also show up as filler in longer sentences) only count when the
# whole message is just that word or two, so they don't misfire mid-sentence.
_STOP_PHRASES = ["لا تكمل", "ما تكمل", "لا نكمل", "ما نكمل", "لا أبي أكمل", "لا ابي اكمل", "ما أبي أكمل", "ما ابي اكمل",
    "لا اريد اكمل", "لا أريد أن أكمل", "ما اريد اكمل", "ما اريد ان اكمل", "ما بدي اكمل", "ما بديش اكمل",
    "ابي اتوقف", "أبي أتوقف", "بدي اتوقف", "اريد التوقف", "أريد التوقف",
    "توقف الدرس", "وقف الدرس", "اوقف الدرس", "بكفي كذا", "خلاص بس", "بس خلاص", "كفايه اليوم", "كفاية اليوم",
    "اكتفي بهذا القدر", "بدي اقف", "ابي اقف", "متعبه ما اريد", "متعب ما اريد", "متعبه لا اريد", "متعب لا اريد",
    # razan's follow-up (2026-09-29): her own real test phrase -- "انا تعبانه،
    # لا اريد الاكمال، اكتفي وبعدين نكمل" -- did NOT stop the lesson (see
    # _CONTINUE_TRIGGER and _STOP_ANYTIME_WORDS below for the two root-cause
    # fixes; these extra phrases are a belt-and-suspenders substring match for
    # the same "finish later" idea however else it might be worded).
    "بعدين نكمل", "نكمل بعدين", "لاحقا نكمل", "نكمل لاحقا", "بكمل بعدين", "اكمل بعدين", "اكمل لاحقا",
    # razan's second follow-up test (2026-09-29, during recitation): after the
    # emotion check-in ("تعبانه! اوكي نستريح ولا نكمل؟") she replied "لا، اريد
    # الخروج" ("no, I want to exit") -- a completely different concept from
    # "لا اريد أكمل" (nothing above mentions leaving/exiting at all), so it fell
    # through both is_stop() and has_emotion() and got scored as a failed
    # recitation attempt instead, which is exactly what "forced her to
    # continue" -- the teacher kept asking her to retry the ayah. These cover
    # "I want to exit/leave" as its own stop concept, independent of "اكمل".
    "اريد الخروج", "أريد الخروج", "ابي الخروج", "أبي الخروج", "ابغى الخروج", "أبغى الخروج",
    "اريد اطلع", "أريد اطلع", "ابي اطلع", "أبي أطلع", "ابغى اطلع", "أبغى أطلع",
    "بدي اطلع", "ودي اطلع", "خلني اطلع", "خليني اطلع"]
_STOP_EXACT = ["توقف", "توقفي", "قف", "قفي", "وقفي", "اوقفي", "كفى", "بس", "خلاص", "كفايه", "كفاية", "stop", "إيقاف", "ايقاف",
    # short standalone reply to the emotion check-in, or said on its own mid-lesson
    "اطلع", "أطلع", "اطلعني", "أطلعني", "الخروج", "خروج"]

# same idea as _STOP_EXACT, but NOT limited to a short 1-2-word message: "اكتفي"
# ("I'll settle for/stop at this much") is unambiguous enough in this app's
# domain (a Quran/hadith lesson) that it's safe to catch anywhere in a longer
# sentence too -- razan's real test phrase used it buried in an 8-word
# sentence ("انا تعبانه، لا اريد الاكمال، اكتفي وبعدين نكمل"), well past
# _STOP_WITH_EMOTION_MAX_WORDS, and "اكتفي" itself isn't even in _STOP_EXACT.
_STOP_ANYTIME_WORDS = ["اكتفي", "اكتفيت", "يكفيني"]

# a bare "stop" word (any of _STOP_EXACT) said together with a tired/sad/scared
# word in the SAME message — e.g. "انا تعبانه وقفي" — should end the session
# right away rather than only getting the sympathetic _emotion_reply (see
# has_emotion()/_EMOTION_WORDS below). Kept to a slightly longer cap than the
# bare-word check below since "انا تعبانه وقفي" is 3 words.
_STOP_WITH_EMOTION_MAX_WORDS = 6

# generalised fallback for is_stop(): a negation word ("لا"/"ما"/"مو"/"مب"/"مش")
# followed within a few words by a "continue" verb ("اكمل"/"كمل"/"نكمل"/...) means
# "I don't want to continue", however it's phrased. Speech-to-text output varies a
# lot in real use (extra/missing filler words, slightly different wording than any
# fixed phrase in _STOP_PHRASES), so this catches variants the fixed list misses —
# e.g. "انا متعبه ما اريد اكمل" or "ما بقدر اكمل هلق" — without needing every exact
# wording enumerated. Kept narrow (must see an actual continue-verb nearby) so it
# doesn't misfire on unrelated negative sentences.
_NEG_WORDS = {"لا", "ما", "مو", "مب", "مش"}
# "الاكمال"/"اكمال" (razan's follow-up, 2026-09-29): her test phrase said "لا
# اريد الاكمال" -- the gerund/noun form ("completing"), not the bare verb
# "اكمل" this set only had before. Real speech-to-text output mixes verb and
# noun forms freely, so both are covered now.
_CONTINUE_TRIGGER = {"اكمل", "اكملي", "كمل", "كملي", "نكمل", "تكمل", "نتابع", "تابعي", "استمر", "استمري",
    "الاكمال", "اكمال", "الإكمال", "إكمال"}

def _neg_continue(tn: str) -> bool:
    words = tn.split()
    for i, w in enumerate(words):
        if w in _NEG_WORDS and any(cw in words[i + 1:i + 4] for cw in _CONTINUE_TRIGGER):
            return True
    return False

# greet-stage-only (found during live QA testing, 2026-09-30): is_stop() below
# is themed entirely around STOPPING something already under way (a negation
# word next to a "continue" verb like "اكمل"/"نكمل"), so it never fires for a
# flat refusal to begin AT ALL, worded with a lesson verb instead -- e.g. "ما
# ابي احفظ اليوم خالص" said as the very first message of the session. That
# message was silently stored as the child's "mood" and the lesson started
# anyway. Same negation-window technique as _neg_continue, just with lesson-
# starting verbs as the trigger set instead of continuation verbs.
_LESSON_VERB_TRIGGER = {"احفظ", "احفظي", "ادرس", "ادرسي", "اتعلم", "اتعلمي", "اذاكر", "اذاكري",
    "اقرا", "اقرأ", "اقراء", "نحفظ", "نتعلم", "ندرس"}

def declines_lesson(text: str) -> bool:
    tn = _n(text)
    if not tn:
        return False
    words = tn.split()
    for i, w in enumerate(words):
        if w in _NEG_WORDS and any(cw in words[i + 1:i + 4] for cw in _LESSON_VERB_TRIGGER):
            return True
    return False

def _phrase_in_words(phrase_words: list, msg_words: list) -> bool:
    """True if phrase_words appears as a contiguous run inside msg_words.
    Found while testing razan's follow-up (2026-09-29): the old check (`_n(p)
    in tn`, a raw string-substring test) let an unrelated word that merely
    ENDS with the same letters as a stop-phrase's first word cause a false
    match -- e.g. "تمام يلا نكمل" ("great, come on, let's continue!") contains
    the raw substring "لا نكمل" (the tail of "يلا" + " نكمل"), which used to
    wrongly match the "لا نكمل" entry in _STOP_PHRASES and end the lesson on
    a message that was the opposite of a stop request. Matching whole words
    in sequence instead of raw characters fixes this without weakening any
    real match (every _STOP_PHRASES entry is itself whole words)."""
    n, m = len(phrase_words), len(msg_words)
    if n == 0 or n > m:
        return False
    return any(msg_words[i:i + n] == phrase_words for i in range(m - n + 1))

def is_stop(text: str) -> bool:
    tn = _n(text)
    if not tn:
        return False
    words = tn.split()
    if any(_phrase_in_words(_n(p).split(), words) for p in _STOP_PHRASES):
        return True
    if _neg_continue(tn):
        return True
    if any(_n(w) in words for w in _STOP_ANYTIME_WORDS):
        return True
    if len(words) <= 2 and any(_n(w) in words for w in _STOP_EXACT):
        return True
    if len(words) <= _STOP_WITH_EMOTION_MAX_WORDS \
            and any(_n(w) in words for w in _STOP_EXACT) \
            and any(_n(w) in words for w in _EMOTION_WORDS):
        return True
    return False
_Q_START = ["هل", "ما", "ماذا", "لماذا", "ليش", "كيف", "متى", "اين", "أين", "من ", "ايش", "شو", "وش", "علاش",
    "what", "why", "how", "when", "where", "who", "is ", "are ", "can "]
_FILLER = ["احب", "أحب", "احب ان", "اريد", "أريد", "ابغى", "ابي", "بدي", "اتعلم", "أتعلم", "عن", "اهتم", "بـ", "انا", "أنا",
    "مهتم", "مهتمة", "بال", "شيء", "شي", "اشياء", "أشياء", "اللي", "الي", "احب اتعلم", "تعلم"]

# child says something unkind / a bad word: we never scold, we redirect gently (see
# _bad_language_reply). Keep this list conservative (clearly rude/insulting words a
# child might actually type or say), not an exhaustive profanity filter.
_BAD_WORDS = ["غبي", "غبيه", "غبية", "احمق", "أحمق", "حمار", "كلب", "خرا", "تبا", "تبًا", "لعنة", "ملعون",
    "احقر", "وسخ", "قذر", "ابله", "أبله", "stupid", "idiot", "shut up", "hate you", "اكرهك", "أكرهك"]

# child shows a feeling mid-session (razan: testers will probe this — the
# teacher must acknowledge it warmly, not plow straight back into the lesson
# content). Deliberately conservative word list, exact-word matched (see
# has_emotion), so it never misfires on an unrelated sentence that happens to
# contain a similar substring.
_EMOTION_WORDS = ["حزين", "حزينه", "حزينة", "زعلان", "زعلانه", "زعلانة", "خايف", "خايفه", "خايفة",
    "خائف", "خائفه", "خائفة", "تعبان", "تعبانه", "تعبانة", "متعب", "متعبه", "متعبة", "متضايق", "متضايقه", "متضايقة",
    "ابكي", "بابكي", "وحيد", "وحيده", "وحيدة", "غضبان", "غضبانه", "غضبانة", "زعلت", "خفت"]

# --------------------------------------------------------------------------- utils
def _n(text: str) -> str:
    """Aggressive normalisation for matching/scoring (no diacritics, unified letters)."""
    t = normalize_ar(text or "").lower()
    for a, b in (("أ", "ا"), ("إ", "ا"), ("آ", "ا"), ("ى", "ي"), ("ة", "ه"), ("ؤ", "و"), ("ئ", "ي")):
        t = t.replace(a, b)
    t = re.sub(r"[^\w\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()

def _v(s, m: str, f: str) -> str:
    """Pick the masculine/feminine word form for a fixed (non-LLM) scripted
    phrase, based on the child's gender. vp.adapt() only safely generalises a
    few adjectives/nicknames (see voice_persona.py) — verbs like "استمع" or
    "راجع" are grammatically ambiguous in other contexts (e.g. "تقدر"/"كنت"
    can be 3rd-person or 1st-person too), so those are branched explicitly
    at the point they're written instead of pattern-matched afterward."""
    return f if getattr(s, "girl", False) else m

def is_question(text: str) -> bool:
    t = (text or "").strip()
    if "؟" in t or "?" in t:
        return True
    tn = _n(t) + " "
    if "؟" not in t and "?" not in t and (tn.startswith("ما شاء") or tn.startswith("ماشاء")
        or any(w in tn for w in ("حلو", "جميل", "رائع", "ممتاز", "اعجب", "احببت", "يعجب", "روعه"))):
        return False
    return any(tn.startswith(_n(w) + " ") if not w.endswith(" ") else tn.startswith(_n(w)) for w in _Q_START)

# words that open a genuine REQUEST rather than a question (no "هل/ما/كيف..."
# and no "؟") -- e.g. "ابي ارجع اسمع تفسير الآية" (found during live QA
# testing, 2026-09-30: is_question() missed this exact phrase, so the only
# escape hatch out of the mandatory recitation-repeat drill never opened, and
# the child's request was scored as a failed recitation attempt instead).
# Deliberately a short, specific list (not the much broader _FILLER, which
# includes "انا"/"أنا" and would misfire on ordinary sentences) so this only
# catches a clear "I want .../I'd like ..." opener.
_DESIRE_START = ["ابي", "أبي", "ابغى", "أبغى", "بدي", "ودي", "اريد", "أريد"]

def wants_something_else(text: str) -> bool:
    """True if the child is asking for something other than the current drill
    (help, to go back, to hear an explanation again, ...), phrased as a desire
    rather than a grammatical question -- and it isn't already a continue/skip
    reply. Used alongside is_question() as the escape hatch out of the
    recitation-repeat drill."""
    tn = _n(text)
    if not tn or is_continue(text) or is_skip(text):
        return False
    words = tn.split()
    if not any(words[0] == _n(w) for w in _DESIRE_START):
        return False
    return len(words) >= 2

def is_continue(text: str) -> bool:
    tn = _n(text)
    if not tn or len(tn.split()) > 5:
        return False
    return any(_n(w) in tn.split() or _n(w) == tn for w in _CONTINUE_WORDS)

def is_skip(text: str) -> bool:
    tn = _n(text)
    return any(_n(w) in tn for w in _SKIP_WORDS)

def has_bad_language(text: str) -> bool:
    tn = _n(text)
    return any(_n(w) in tn.split() or _n(w) in tn for w in _BAD_WORDS)

def has_emotion(text: str) -> bool:
    tn = _n(text)
    return any(_n(w) in tn.split() for w in _EMOTION_WORDS)

def similarity(heard: str, target: str) -> float:
    a, b = _n(heard), _n(target)
    if not a or not b:
        return 0.0
    char = difflib.SequenceMatcher(None, a, b).ratio()
    aw, bw = a.split(), b.split()
    word = difflib.SequenceMatcher(None, aw, bw).ratio()
    return round(max(char, (char + word) / 2), 3)

# the fuzzy 0.72 bar on similarity() alone is too lenient for one specific,
# common real mistake: swapping in a REAL word from a nearby ayah of the same
# surah in place of the correct one (e.g. "الصمد" -> "الأحد" in الإخلاص).
# That still clears 0.72 (and even a much higher aggregate bar -- tried
# raising the flat threshold first, but a single wrong word out of six or
# more still scores 0.9+ overall) because the rest of the ayah/surah matches
# perfectly. Found live during QA testing, 2026-09-30: this exact
# substitution was accepted as "أحسنت! تلاوة جميلة".
#
# The reliable signal isn't the aggregate score, it's THIS word specifically:
# when heard/target have the same word count (nothing added or dropped) but
# aren't identical, check each mismatched word PAIR on its own. Genuine
# speech-to-text noise or a recitation (qira'at) variant of the same word
# stays close at the character level (e.g. "مالك"/"ملك" ~0.86, a dropped
# diacritic-turned-letter ~0.8+); swapping in a different real word does not
# (e.g. "الأحد"/"الصمد" ~0.6, despite sharing the "ال" prefix and last
# letter). 0.8 sits between the two in testing against both cases.
_WORD_SUBSTITUTION_MIN = 0.80

def is_recitation_correct(heard: str, target: str, sc: float, base_threshold: float = 0.72) -> bool:
    """base_threshold defaults to the Quran path's 0.72; hadith_agent.py's
    memorize-stage check (previously a bare `sc >= 0.7`) passes 0.7 to keep
    its own, slightly different, existing bar unchanged -- only the new
    same-word-count substitution guard is shared between the two paths."""
    hw, tw = _n(heard).split(), _n(target).split()
    if hw and tw and len(hw) == len(tw) and hw != tw:
        for a, b in zip(hw, tw):
            if a != b and difflib.SequenceMatcher(None, a, b).ratio() < _WORD_SUBSTITUTION_MIN:
                return False
    return sc >= base_threshold

def _clean_topic(text: str) -> str:
    words = [w for w in re.sub(r"[؟?!.,،]", " ", text or "").split() if _n(w) not in {_n(f) for f in _FILLER}]
    topic = " ".join(words).strip() or (text or "").strip()
    return topic[:40]

# --------------------------------------------------------------------------- LLM
_client = None
LAST_ERROR = {"msg": None}

def llm_available() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY")) and anthropic is not None

def _llm(system: str, user: str, max_tokens: int = 180, model: str = None):
    """One Claude call. Returns text, or None if there's no key / any failure
    (callers always have a scripted fallback, so the session never breaks).
    timeout/max_tokens kept tight (razan: replies felt slow) — every reply here
    is meant to be one or two short sentences (see PERSONA), so 180 tokens is
    already generous, and on a slow API day we'd rather fail over to the
    scripted fallback in ~8s than make the child wait 14s for nothing.

    The system prompt (vp.persona(PERSONA, girl)) is IDENTICAL on every single
    call for a given gender — it never varies per child or per turn — so it's
    marked cache_control=ephemeral: Anthropic reuses the already-processed
    version instead of re-reading it from scratch each time, which cuts both
    latency and cost on every call after the first. This only actually kicks
    in once the system block is above Anthropic's minimum cacheable length
    (varies by model); below that it's silently a no-op, never an error."""
    global _client
    if not llm_available():
        return None
    try:
        if _client is None:
            _client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"], timeout=8.0)
        msg = _client.messages.create(
            model=model or MODEL_NAME, max_tokens=max_tokens,
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(b.text for b in msg.content if b.type == "text").strip()
        LAST_ERROR["msg"] = None
        return text or None
    except Exception as e:
        LAST_ERROR["msg"] = (type(e).__name__ + ": " + str(e))[:300]
        # razan's request #2: keep a durable record too, not just the single
        # most-recent, in-memory-only LAST_ERROR (wiped on every restart).
        error_log.record("agent_service._llm", e)
        return None

_MODERATION_SYSTEM = ("أنت مرشّح سلامة داخلي لتطبيق تعليمي ديني للأطفال (6-12 سنة). "
    "مهمتك الوحيدة: هل رسالة الطفل التالية تحتوي كلامًا غير لائق أو مسيئًا أو خارجًا عن الأدب "
    "(شتيمة، إهانة، كلمة نابية، تهديد، إساءة لشخص)؟ أجب بكلمة واحدة فقط، بدون أي شرح: نعم أو لا.")

_EMOTION_MODERATION_SYSTEM = ("أنت مرشّح داخلي لتطبيق تعليمي ديني للأطفال (6-12 سنة). "
    "مهمتك الوحيدة: هل رسالة الطفل التالية تعبّر عن مشاعر سلبية أو ضيق (حزن، خوف، وحدة، شعور بعدم الحب أو "
    "الاهتمام، تعب نفسي، غضب، قلق) ولو بشكل غير مباشر أو بدون كلمة مفتاحية صريحة؟ أجب بكلمة واحدة فقط، بدون أي شرح: نعم أو لا.")

def _llm_emotion_check(text: str) -> bool:
    """Second-opinion safety net on top of the fixed _EMOTION_WORDS list (found
    during live QA testing, 2026-09-30): that list is exact-word-match only, so
    an indirect/unlisted phrasing of real distress -- e.g. "حسيت اني ما حد
    يحبني بصراحة" ("I felt like nobody loves me") -- contains none of the
    listed words and sails straight through undetected, getting scored as a
    failed recitation attempt instead of getting the warm _emotion_reply this
    kind of message clearly needs. Mirrors _llm_bad_language_check exactly:
    same cheap/fast model, same 3-token answer, same short-message skip, same
    fail-safe (never blocks or slows the session down on an API hiccup --
    worst case it silently falls back to keyword-only detection)."""
    if not llm_available() or len(text.split()) < 2:
        return False
    try:
        out = _llm(_EMOTION_MODERATION_SYSTEM, text, max_tokens=3, model=FAST_MODEL_NAME)
        return bool(out) and out.strip().startswith("نعم")
    except Exception:
        return False

def _llm_bad_language_check(text: str) -> bool:
    """Second-opinion safety net on top of the fixed _BAD_WORDS list (production-
    readiness review, 2026-09-29). The keyword list is exact-match only, so a
    misspelling, a word not on the list, or dialect slang sails straight through
    it undetected -- this catches more of those by asking the model directly.

    Deliberately cheap and narrow to limit the latency/cost this adds to every
    non-trivial free-text turn: fast model, 3-token answer, and skipped entirely
    for very short messages (one word is almost always a scripted-flow reply
    like 'نعم' or 'تمام', never worth a model call). Fails SAFE, not loud: no
    API key, a timeout, or any unexpected output all just return False, so on a
    bad day this silently falls back to keyword-only detection instead of ever
    blocking or slowing down the session.

    Note for whoever tunes this later: this does add one extra model call to
    most ordinary free-text turns that previously made zero calls (a plain
    scripted stage). That trade-off (child-safety coverage vs. reply latency)
    was made deliberately here, but it's easy to disable by short-circuiting
    this function to `return False` if it ever proves too slow in practice."""
    if not llm_available() or len(text.split()) < 2:
        return False
    try:
        out = _llm(_MODERATION_SYSTEM, text, max_tokens=3, model=FAST_MODEL_NAME)
        return bool(out) and out.strip().startswith("نعم")
    except Exception:
        return False

# razan's own-judgment improvement round (2026-09-30), addressing the 6/10
# "response latency" metric from my own evaluation: "بعد إضافة فحص المشاعر
# الثاني صار في بعض الحالات ٣ نداءات LLM متتالية (لغة بذيئة + مشاعر + الرد
# نفسه) قبل ما يرد". The bad-language and emotion LLM checks are each other's
# independent second opinions -- neither's result depends on the other -- so
# there is no reason to run them one after another and pay their latency
# twice. This submits both to a small background thread pool up front and
# only blocks on each one the first time its answer is actually needed,
# so their wall-clock overlaps instead of stacking (~max(t1, t2) instead of
# t1 + t2). A free, instant word-list hit still short-circuits its own LLM
# call entirely, exactly like the original `word_check(text) or
# _llm_check(text)` -- this only changes when/how the LLM calls run, never
# whether they run.
_MODERATION_POOL = concurrent.futures.ThreadPoolExecutor(max_workers=8, thread_name_prefix="moderation")

class ModerationChecks:
    def __init__(self, text: str):
        self._bad_word_hit = has_bad_language(text)
        self._emotion_word_hit = has_emotion(text)
        self._bad_future = None if self._bad_word_hit else _MODERATION_POOL.submit(_llm_bad_language_check, text)
        self._emotion_future = None if self._emotion_word_hit else _MODERATION_POOL.submit(_llm_emotion_check, text)

    def bad_language(self) -> bool:
        if self._bad_word_hit:
            return True
        try:
            return bool(self._bad_future.result(timeout=10))
        except Exception:
            return False  # same fail-safe as the underlying checks: never blocks the session

    def emotional(self) -> bool:
        if self._emotion_word_hit:
            return True
        try:
            return bool(self._emotion_future.result(timeout=10))
        except Exception:
            return False

def start_moderation_checks(text: str) -> "ModerationChecks":
    return ModerationChecks(text)

def _history_text(s, n: int = 6) -> str:
    return "\n".join(f"{'المعلّم' if h['role'] == 'teacher' else 'الطفل'}: {h['text']}" for h in s.history[-n:])

def _say(s, goal: str, fallback: str, facts: str = "", max_tokens: int = 180) -> str:
    """Warm wording for a social turn that genuinely needs live generation
    (right now: explaining THIS surah's specific tafsir simply — content that
    actually varies per lesson, so it can't be a fixed template). Falls back
    to the scripted line. Uses the fast model.

    max_tokens defaults to 180 (fine for a short 1-2 sentence social reply),
    but callers explaining MULTIPLE ayat (tafsir) must pass a larger value
    scaled to how many ayat are being explained — 180 is only enough for the
    first one or two before the reply gets cut off mid-explanation."""
    notes = f"ملاحظات من جلسات سابقة عن شخصية الطفل (استخدمها لتكييف أسلوبك معه بلطف، دون ذكرها له مباشرة): {s.child_notes}\n" if getattr(s, "child_notes", "") else ""
    user = (f"اسم الطفل: {s.child_name}\n{notes}ما نعرفه عنه: {json.dumps(s.profile, ensure_ascii=False)}\n"
            f"آخر الحوار:\n{_history_text(s)}\n\n"
            + (f"الحقائق المسموح بها:\n{facts}\n\n" if facts else "")
            + f"مهمتك الآن: {goal}\nاكتب ما ستقوله للطفل فقط.")
    return _llm(vp.persona(PERSONA, s.girl), user, max_tokens=max_tokens, model=FAST_MODEL_NAME) or fallback

# Closing-lesson lines used to be generated live (an LLM call on every single
# lesson's end, just to reword a fixed idea: thank the child, make du'a, remind
# them of the memorization plan, ask what's next). That's pure latency for
# zero real benefit — the content never depended on anything but the child's
# name and the tail question, so a handful of pre-written variants picked at
# random gives the same warmth and variety with no network call at all.
_CLOSING_TEMPLATES = [
    "بارك الله فيك يا {n}! {student} اليوم. لا تنسَ خطة الحفظ. {tail}",
    "ما شاء الله يا {n}، مجهود جميل اليوم! ادعُ الله أن يثبّت ما حفظته في قلبك، ولا تنسَ خطة المراجعة. {tail}",
    "أحسنت يا {n}! الله يبارك فيك ويعينك على حفظ كتابه. راجع خطة الحفظ بانتظام حتى يثبت معك. {tail}",
    "جزاك الله خيرًا يا {n} على مجهودك اليوم! أسأل الله أن ينفعك بما تعلمت، ولا تنسَ المراجعة حسب الخطة. {tail}",
    "الله يبارك فيك يا {n}! اليوم كان يومًا جميلًا معك. حافظ على خطة الحفظ فالمراجعة تثبّت ما حفظناه. {tail}",
]

def _closing_line(s, tail: str) -> str:
    student = _v(s, "كنت طالبًا رائعًا", "كنتِ طالبة رائعة")
    return random.choice(_CLOSING_TEMPLATES).format(n=s.child_name, student=student, tail=tail)

def answer_interruption(s, question: str) -> str:
    try:
        context = llm_service.retrieve_context(question)
    except Exception:
        context = ""
    L = s.lesson
    facts = (f"درس اليوم: {L['title']}\nالتفسير: " + " / ".join(L["tafsir"]) + ("\nالفضل: " + L["fadl"] if L.get("fadl") else ""))
    # (found during live QA testing, 2026-09-30): without an explicit note of
    # WHERE the child actually is in the lesson right now, the model has no
    # way to know recitation is already under way, and kept re-suggesting
    # "نبدأ نتعلم سورة كذا" ("let's START learning surah X") after answering an
    # off-topic question mid-recitation -- as if the lesson hadn't started yet.
    progress_note = ""
    if s.stage == "recitation":
        progress_note = ("\nملاحظة مهمة عن موقع الطفل الآن: الطفل في منتصف تلاوة/حفظ هذا الدرس فعلاً، وليس قبل البدء به. "
            "إذا اقترحت العودة للدرس بعد إجابتك، قل شيئًا مثل 'نكمل التلاوة' أو 'نرجع لآيتنا'، ولا تقل أبدًا 'نبدأ نتعلم سورة كذا' أو ما يوحي بأن الدرس لم يبدأ بعد.")
    # razan/Abdulaziz (2026-09-29): "أي أسئلة خارج الدرس حاول تجاوبها عادي بس
    # قوله خلينا نكمل الدرس" -- off-topic chatter (a game, a cartoon, general
    # talk) must NOT be funnelled into the strict "defer to a specialist
    # teacher" religious-Q&A instruction below; it should get a warm, normal,
    # brief reply from the model's own general knowledge, then a gentle nudge
    # back to the lesson. Only an actual religious/lesson question without
    # enough grounded context still gets the "I'll ask a specialist" deferral
    # -- we never want the model inventing fiqh from nothing.
    #
    # (found during live QA testing, 2026-09-30): a question about the APP
    # ITSELF (its sections/features) was falling into that same "general
    # knowledge, one warm line" bucket, and the model has no real knowledge of
    # the app's actual screens -- it was answering fluently anyway, i.e.
    # inventing section names. That's not "general knowledge", it's
    # unconfirmed product detail, so it gets its own explicit instruction not
    # to invent specifics, same spirit as the religious-deferral rule above.
    user = (f"اسم الطفل: {s.child_name}\nكلام الطفل (قد يكون سؤالًا دينيًا متعلقًا بالدرس، أو سؤالًا عن تطبيق غرسة نفسه، أو مجرد حديث عابر خارج الدرس مثل لعبة أو كرتون أو سؤال عام): {question}\n\n"
            f"السياق المرجعي من قاعدة المعرفة:\n{context}\n\n{facts}{progress_note}\n\n"
            "إن كان كلامه سؤالًا دينيًا أو متعلقًا بالدرس: أجب بلطف وباختصار اعتمادًا على ما سبق فقط، وإن لم يكفِ السياق فقل بلطف إنك ستسأل معلّمًا مختصًا ولا تخترع جوابًا من عندك. "
            "إن كان سؤالًا عن تطبيق غرسة نفسه (أقسامه، ميزاته، شكل واجهته): ليس لديك معلومات مؤكدة عن تفاصيل التطبيق وشاشاته، فلا تخترع أو تسمِّ أي قسم أو ميزة محددة لست متأكدًا منها؛ أجب بعبارة عامة ودودة لا تذكر أسماء أقسام (مثل: 'التطبيق فيه أشياء حلوة كثيرة، جرّب تتفرج عليها بنفسك!')، ثم أعده بلطف للدرس. "
            "إن كان كلامه خارج الدرس تمامًا (لعبة، كرتون، حديث عام لا علاقة له بالقرآن أو الحديث): لا تحوّله لسؤال ديني ولا تقل إنك ستسأل معلّمًا مختصًا؛ تفاعل معه بدفء بجملة واحدة قصيرة من معلوماتك العامة، ثم اقترح عليه بلطف أن نكمل الدرس.")
    # model cascading: a question the RAG actually found a specific match for
    # is basically "summarize this trusted passage for a child" — well within
    # the fast model's ability, and much quicker. A question with NO match is
    # exactly the case where the model has to exercise judgment (is this
    # answerable at all from the lesson facts, or should it defer to a human
    # teacher?) so that one still goes to the stronger model. Same safety
    # system prompt either way — this only changes which model reads it.
    has_match = bool(context) and not context.startswith("(لا يوجد")
    text = _llm(vp.persona(PERSONA, s.girl), user, model=FAST_MODEL_NAME if has_match else None)
    if text:
        return text
    if context and not context.startswith("(لا يوجد"):
        return "سؤال حلو يا " + s.child_name + "! هذا ما وجدته لك: " + context.split("\n\n")[0]
    qn = _n(question)
    if any(w in qn for w in ("فاتحه", "سوره", "معني", "تفسير")):
        return "سؤال حلو! باختصار: " + " ".join(_short(x) for x in s.lesson["tafsir"][:2])
    return "يا " + s.child_name + "، خلّنا نكمل درسنا الجميل، ونرجع لسؤالك بعدين إن شاء الله."

def _bad_language_reply(s, text: str) -> str:
    """The child used a rude/hurtful word. Abdulaziz's request (via razan,
    2026-09-29): "اي كلمات بذيئة الطفل يقولها قوله انه غلط" -- tell the child
    plainly that it's wrong, not just silently pivot away from it. Still never
    shames or scolds the CHILD himself (the WORD/behaviour is named as wrong,
    never "you are bad"), and still redirects gently toward good manners
    (Islamic adab) afterward."""
    n = s.child_name
    fallback = (f"يا {n}، هذي الكلمة مو حلوة وما نقولها، خصوصًا واحنا نتعلم القرآن والحديث. "
                "نبيّنا صلى الله عليه وسلم علّمنا أن نختار أطيب الكلام دائمًا. تعال نكمل درسنا الجميل.")
    return _llm(
        vp.persona(PERSONA, s.girl),
        f"قال الطفل ({n}) كلامًا غير مهذب أو جارحًا: \"{text}\". وضّح له بلطف وبثبات أن هذه الكلمة أو هذا الأسلوب غير مناسب "
        "ولا يُقال (صف الكلمة/الفعل بأنه غير مناسب، وليس الطفل نفسه -- لا تصفه هو بأنه سيئ، ولا توبّخه، ولا تُخجله، ولا تكرر الكلمة حرفيًا)، "
        "مستندًا إلى قيمة إسلامية بسيطة (مثل حديث: المسلم من سلم المسلمون من لسانه ويده)، بجملة أو جملتين فقط، ثم أعده بلطف إلى الدرس.",
        # razan's testing (2026-10-01): this and _emotion_reply below are the
        # two LLM-generated replies she flagged for dialect/gender-agreement
        # drift (girl teacher reading as Shami-ish, a stray masculine
        # imperative) -- despite vp.persona()'s dialect block already
        # explicitly banning Shami/Egyptian by name. These two replies are
        # comfort/correction moments (a child was just upset or just corrected),
        # fire only occasionally (not on every turn, unlike the moderation
        # CHECKS in ModerationChecks above, which stay on FAST_MODEL_NAME since
        # THAT latency was razan's own-judgment fix on 2026-09-30), and are
        # exactly where getting the tone/dialect/grammar right matters most --
        # so using the stronger default model here (better instruction
        # adherence) is a trade worth making even at a bit more latency/cost.
        # Easy to revert to FAST_MODEL_NAME if that latency turns out to matter
        # more in practice than the occasional dialect slip.
        max_tokens=150,
    ) or fallback

def _emotion_reply(s, text: str) -> str:
    """The child showed a feeling (sad/scared/tired/upset) mid-session. Never
    plow straight back into the lesson — acknowledge it with warmth first."""
    n = s.child_name
    fallback = f"يا {n}، أنا معك ولا تقلق. خذ نفسًا عميقًا، والله معك دائمًا. جاهز نكمل درسنا، أم تحب نرتاح دقيقة؟"
    return _llm(
        vp.persona(PERSONA, s.girl),
        f"عبّر الطفل ({n}) عن مشاعر (حزن أو خوف أو تعب أو غضب) بقوله: \"{text}\". لا تتجاهل مشاعره ولا تكمل الدرس مباشرة. "
        "اطمئنه بحنان ودفء شديدين بجملة أو جملتين فقط، وبإمكانك تذكيره بلطف أن الله معه ويحبه، ثم اسأله برفق هل يريد أن نكمل أم يحتاج دقيقة.",
        # see the matching note in _bad_language_reply just above -- same
        # reasoning, stronger default model for this occasional, tone-critical reply.
        max_tokens=150,
    ) or fallback

def _extract_name(text: str) -> str:
    t = re.sub(r"[؟?!.,،]", " ", text or "")
    words = [w for w in t.split() if _n(w) not in {"اسمي", "انا", "اسم", "اسمى", "يعني", "هو", "ان", "انه", "بس"}]
    return (" ".join(words[:2]) or (text or "").strip())[:20] or "بطل"

_AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
_AGE_WORDS = {"ست": 6, "سبع": 7, "ثمان": 8, "تسع": 9, "عشر": 10, "احد": 11, "اثن": 12, "ثني": 12}

def _extract_age(text: str):
    m = re.search(r"\d{1,2}", (text or "").translate(_AR_DIGITS))
    if m:
        return int(m.group(0))
    tn = _n(text)
    for k, v in _AGE_WORDS.items():
        if k in tn:
            return v
    return None

# --------------------------------------------------------------------------- personality notes (cross-session)
_NOTES_SYSTEM = ("أنت مساعد يحلّل، لصالح معلّم قرآن، سلوك وشخصية طفل أثناء درس تعليمي ديني، "
                 "لمساعدته على فهم الطفل بشكل أفضل في الجلسات القادمة. لا تصدر أحكامًا سلبية على الطفل، "
                 "وركّز فقط على أسلوب تعلّمه واحتياجاته ونقاط قوته.")

def _update_child_notes(s):
    """Best-effort: summarize this session's personality/behaviour signals and merge
    them with any prior notes for this device. Runs on a background thread so it
    never adds latency to the child's own response. Never raises."""
    try:
        if not s.device_id or not llm_available():
            return
        prev = child_profile.get_notes(s.device_id) or {}
        prev_notes = (prev.get("notes") or "").strip()
        transcript = _history_text(s, n=40)
        user = (f"اسم الطفل: {s.child_name}\nملاحظات سابقة عن شخصيته (إن وُجدت): {prev_notes or 'لا يوجد'}\n\n"
                f"نص هذه الجلسة:\n{transcript}\n\n"
                "لخّص في 3 إلى 5 جمل قصيرة جدًا شخصية الطفل وسلوكه وأسلوبه في التعلّم "
                "(مثال: خجول، متحمس، يحتاج تشجيعًا، يحب الأسئلة، سريع الحفظ)، بدمج الملاحظات السابقة مع ما لاحظته الآن. "
                "اكتب الملخص المُحدَّث فقط، دون مقدمات.")
        summary = _llm(_NOTES_SYSTEM, user, max_tokens=220, model=FAST_MODEL_NAME)
        if summary:
            child_profile.save_notes(s.device_id, s.child_name, summary, (prev.get("sessions_count") or 0) + 1)
    except Exception:
        pass

def _random_nickname() -> str:
    """Picked once per session (see Session.__init__/TaseemSession.__init__),
    not re-rolled every turn -- razan's follow-up (2026-09-29): she noticed
    the teacher always says "يا بطل"/"يا بطلة" before a real name is known,
    and asked for some variety. Rolling a new one per session (rather than
    per message) keeps a single conversation calling the child one
    consistent nickname throughout -- "يا بطل... يا نجم..." mid-chat would
    read as inconsistent, not warm. See voice_persona.NICKNAMES for the
    list (that module also needs it, to feminize whichever one is chosen)."""
    return random.choice(vp.NICKNAMES)

# --------------------------------------------------------------------------- sessions
class Session:
    def __init__(self):
        self.id = uuid.uuid4().hex
        # NOTE: no "يا" prefix here — every scripted line interpolates this as
        # "يا {child_name}" itself, so a stored "يا بطل" produced a visible
        # "يا يا بطل" double-vocative in any message sent before the child has
        # given their name (e.g. a stop/emotion reply at the very first stage
        # — exactly what razan hit). vp.adapt()'s nickname->feminine regex
        # still matches fine either way, since it matches on the final text.
        self.child_name = _random_nickname()
        self.girl = False
        self.device_id = ""
        self.child_notes = ""
        self.stage = "greet"
        self.profile = {}
        self.history = []
        self.lesson = LESSON
        self.ayah_idx = 0
        self.tries = 0
        # recitation now has two phases (razan: 5 reps + correctness check per
        # ayah, then the whole surah recited correctly twice at the end):
        # final_mode marks that all ayat were drilled individually and we're
        # now in the whole-surah double-recitation checkpoint; final_pass_count
        # counts how many of those 2 full, correct passes are done so far.
        self.final_mode = False
        self.final_pass_count = 0
        self.scores = []
        self.awaiting_q = False
        # surah numbers fully finished THIS session (razan, 2026-09-26: used
        # as a fallback for _next_pilot_surah when there's no device_id to
        # persist to, e.g. an anonymous session — without this, auto-advance
        # couldn't tell a surah just finished a moment ago is already done).
        self.done_surahs = set()
        # highest stage index reached this session — never decreases, even when
        # s.stage moves BACKWARD (child clicked an earlier section in the
        # sidebar); this is what the sidebar uses to decide which earlier
        # sections stay clickable, so revisiting one never re-locks it
        self.max_stage_idx = 0
        self.created = time.time()

    def log(self, role: str, text: str):
        self.history.append({"role": role, "text": text})

_SESSIONS = {}
_LOCK = threading.Lock()

def _gc():
    cutoff = time.time() - 6 * 3600
    for k in [k for k, v in _SESSIONS.items() if v.created < cutoff]:
        _SESSIONS.pop(k, None)
    while len(_SESSIONS) > 500:
        _SESSIONS.pop(min(_SESSIONS, key=lambda k: _SESSIONS[k].created), None)
    session_store.gc()  # razan's request #1: age out the DB copy too, same 6h cutoff

# --- DB persistence (razan's request #1) -----------------------------------
# s.lesson is always either the default LESSON or quran_data.build_lesson(n,
# c) for some (surah_no, chunk) -- both fully reconstructable from just those
# two numbers, so we store them instead of the whole (large) lesson dict.
def _session_to_dict(s: "Session") -> dict:
    return {
        "id": s.id, "child_name": s.child_name, "girl": s.girl, "device_id": s.device_id,
        "child_notes": s.child_notes, "stage": s.stage, "profile": s.profile, "history": s.history,
        "lesson_surah_no": s.lesson.get("surah_no"), "lesson_chunk": s.lesson.get("chunk"),
        "ayah_idx": s.ayah_idx, "tries": s.tries, "final_mode": s.final_mode,
        "final_pass_count": s.final_pass_count, "scores": s.scores, "awaiting_q": s.awaiting_q,
        "done_surahs": list(s.done_surahs), "max_stage_idx": s.max_stage_idx, "created": s.created,
    }

def _session_from_dict(d: dict) -> "Session":
    s = Session()
    s.id = d["id"]
    s.child_name = d.get("child_name") or s.child_name
    s.girl = bool(d.get("girl"))
    s.device_id = d.get("device_id") or ""
    s.child_notes = d.get("child_notes") or ""
    s.stage = d.get("stage") or "greet"
    s.profile = d.get("profile") or {}
    s.history = d.get("history") or []
    surah_no, chunk = d.get("lesson_surah_no"), d.get("lesson_chunk")
    if surah_no is not None and chunk is not None:
        try:
            s.lesson = quran_data.build_lesson(surah_no, chunk)
        except Exception:
            pass
    s.ayah_idx = d.get("ayah_idx") or 0
    s.tries = d.get("tries") or 0
    s.final_mode = bool(d.get("final_mode"))
    s.final_pass_count = d.get("final_pass_count") or 0
    s.scores = d.get("scores") or []
    s.awaiting_q = bool(d.get("awaiting_q"))
    s.done_surahs = set(d.get("done_surahs") or [])
    s.max_stage_idx = d.get("max_stage_idx") or 0
    s.created = d.get("created") or time.time()
    return s

def get_session(sid: str):
    s = _SESSIONS.get(sid)
    if s is not None:
        return s
    # not in memory -- e.g. the app restarted mid-lesson. Try to recover it
    # from the DB before giving up and telling the child to start over.
    d = session_store.load(sid, "quran")
    if not d:
        return None
    try:
        s = _session_from_dict(d)
    except Exception:
        return None
    _SESSIONS[s.id] = s
    return s

def _resp(s: Session, say: str, actions=None, expects="text", quick=None) -> dict:
    say = vp.adapt(say, s.girl)
    quick = [vp.adapt_quick(q, s.girl) for q in (quick or [])]
    s.log("teacher", say)
    idx = STAGES.index(s.stage)
    s.max_stage_idx = max(getattr(s, "max_stage_idx", 0), idx)
    # razan's request #1: every reply passes through here, so this is the one
    # place that durably saves the session after each turn (best-effort --
    # never blocks or breaks the reply if the DB write fails).
    try:
        session_store.save(s.id, "quran", _session_to_dict(s))
    except Exception:
        pass
    return {
        "session_id": s.id, "teacher": vp.teacher_name(s.girl), "female": s.girl, "stage": s.stage,
        "stage_index": idx, "max_stage_index": s.max_stage_idx,
        "stages": [{"id": k, "label": STAGE_LABELS[k]} for k in STAGES],
        "say": say, "actions": actions or [], "expects": expects, "quick_replies": quick,
        "profile": s.profile, "child_name": s.child_name, "llm": llm_available(),
        "recitation_scores": s.scores,
        "lesson_title": s.lesson["title"], "surah_no": s.lesson["surah_no"],
    }

CONTINUE_Q = ["أكمل الدرس", "عندي سؤال"]

def _short(t, n=230):
    """Cut a long verbatim tafsir at a sentence/phrase boundary (no rewording)."""
    t = (t or "").strip()
    if len(t) <= n:
        return t
    cut = max(t.rfind(ch, 0, n) for ch in ("۔", ".", "؛", "،"))
    return (t[:cut + 1] if cut > n // 2 else t[:n].rsplit(" ", 1)[0]).strip()

def _show(s, cur=None, hide_text=False):
    """hide_text=True keeps the reference (surah name/ayah number) but blanks
    out the actual ayah text — used during taseem (recall-check), where the
    whole point is reciting from memory with nothing to read off the screen."""
    L = s.lesson
    ayat = ([""] * len(L["ayat"])) if hide_text else L["ayat"]
    a = {"type": "show_ayat", "ayat": ayat, "first": L.get("first_ayah", 1), "surah_name": L.get("surah_name") or L.get("title")}
    if cur:
        a["current"] = cur
    return a

def _ayat_actions(s):
    L = s.lesson
    f = L.get("first_ayah", 1)
    return [_show(s), {"type": "play_all", "urls": [quran_data.audio_url(L["surah_no"], f + i) for i in range(len(L["ayat"]))]}]

# --------------------------------------------------------------------------- stage openers
def _open_stage(s: Session, prefix: str = "") -> dict:
    """What the teacher says on ENTERING the current stage."""
    n, st = s.child_name, s.stage

    if st == "greet":
        # Fixed scripted line (no LLM call: this is the very first thing the child
        # hears, so it must be instant and 100% correct -- right teacher name/gender,
        # correct grammar -- rather than depend on a network round-trip that can be
        # slow or occasionally get the gender/wording wrong), but picked at random
        # from a few variants instead of the one exact sentence every single time
        # (Abdulaziz's request, 2026-09-29: shouldn't feel like a script). The
        # child's real name is already known here now -- see start() -- so the very
        # first line can use it directly instead of a generic "يا بطل" placeholder.
        say = random.choice(_GREET_TEMPLATES).format(t=vp.teacher_name(s.girl), n=n)
        return _resp(s, say, expects="text", quick=["الحمد لله بخير", "تمام"])

    if st == "surah":
        # pilot scope (razan): only these 3 surahs are actively offered right
        # now — see pilot_config.py. Anything else the child asks for is
        # redirected gently rather than taught (see handle()). The order shown
        # here follows pilot_config.PILOT_SURAH_ORDER (razan, 2026-09-27), so
        # that one file alone controls the order everywhere it's offered.
        names = [quran_data.surah_name(n_s) for n_s in pilot_config.PILOT_SURAH_ORDER]
        say = (f"{prefix}أهلاً يا {n}! {_v(s, 'تقدر', 'تقدري')} تسألني بأي وقت. عندنا اليوم ثلاث سور نتعلمها معًا: "
               + "، و".join(names) + f". أي واحدة منها تحب أن نبدأ بها؟")
        return _resp(s, say, expects="text", quick=names)

    if st == "lesson_intro":
        L = s.lesson
        if L.get("curated"):
            say = (f"{prefix}اليوم نتعلم أعظم سورة في القرآن يا {n}: سورة الفاتحة. سبع آيات قصيرة وجميلة، وسنتعلم معناها وفضلها ثم نقرؤها معًا. "
                   "استمع أولًا إلى الآيات بصوت الشيخ العفاسي.")
        else:
            a, b = L["first_ayah"], L["first_ayah"] + len(L["ayat"]) - 1
            part = "" if L["chunks"] == 1 else f" (الجزء {L['chunk'] + 1} من {L['chunks']})"
            say = (f"{prefix}اليوم نتعلم {L['title']} يا {n}، الآيات من {a} إلى {b}{part}. سنسمعها ثم نتعلم معناها ثم نقرؤها معًا. "
                   "استمع أولًا إلى الآيات بصوت الشيخ العفاسي.")
        return _resp(s, say, actions=_ayat_actions(s), expects="continue", quick=CONTINUE_Q)

    if st == "tafsir":
        L = s.lesson
        if L.get("curated"):
            body = " ".join(f"في الآية {i + 1}: {t}" for i, t in enumerate(L["tafsir"]))
        else:
            f0 = L["first_ayah"]
            verbatim = " ".join(f"في الآية {f0 + i}: {_short(t)}" for i, t in enumerate(L["tafsir"]))
            # 180 tokens (the _say default) is only enough for ~1-2 ayat before Claude
            # truncates mid-explanation — that's exactly the "بس يفسر الآية الأولى" bug.
            # Scale the budget to how many ayat are actually being explained this turn.
            n_ayat = max(1, len(L["tafsir"]))
            body = _say(s, "اشرح للطفل معنى هذه الآيات بكلمات بسيطة جدًا، آية بعد آية، بنفس المعنى الوارد في التفسير المرفق فقط دون أي إضافة أو حكم من عندك. اشرح كل آية من الآيات المذكورة، لا تتوقف عند الآية الأولى فقط.",
                verbatim, facts="\n".join(f"الآية {f0 + i}: {_short(t)}" for i, t in enumerate(L["tafsir"])),
                max_tokens=min(1024, 220 + 160 * n_ayat))
        say = f"{prefix}نتعلّم الآن معنى الآيات. {body} هل عندك سؤال، أم نكمل؟"
        return _resp(s, say, actions=[{"type": "set_step", "step": 3}], expects="continue", quick=CONTINUE_Q)

    if st == "fadl":
        if not s.lesson.get("fadl"):  # no reviewed fadl text for this surah: skip, never invent one
            s.stage = "recitation"
            return _open_stage(s, prefix)
        say = f"{prefix}وما فضل هذه السورة؟ {s.lesson['fadl']} هل عندك سؤال، أم نبدأ التلاوة؟"
        return _resp(s, say, actions=[{"type": "set_step", "step": 1}], expects="continue", quick=["ابدأ التلاوة", "عندي سؤال"])

    if st == "recitation":
        # resume from a saved partial position if the child stopped mid-chunk
        # last time (0 when there's no saved progress, same as before)
        s.ayah_idx = progress.partial_ayah(s.device_id, s.lesson["surah_no"], s.lesson["chunk"])
        s.tries = 0
        # a saved position can legitimately be "past the last ayah" if the
        # child stopped during the final whole-surah double-recitation check
        # (added per razan's request) rather than mid-ayah — resume there,
        # never index s.lesson["ayat"] out of range.
        if s.ayah_idx >= len(s.lesson["ayat"]):
            return _start_final_recitation(s, prefix)
        s.final_mode = False
        s.final_pass_count = 0
        return _recite_prompt(s, first=(s.ayah_idx == 0), prefix=prefix)

    if st == "tajweed":
        rules = tajweed_for_lesson(s.lesson["ayat"])
        body = " ".join(
            f"{r['name']}: {r['desc']} كما في كلمة «{r['example']}» في سورتنا اليوم." if r.get("example")
            else f"{r['name']}: {r['desc']}"
            for r in rules
        )
        say = (f"{prefix}أحسنت يا {n}! قبل أن نحفظ الدرس، تعال نتعلّم أحكام تجويد من نفس سورتنا اليوم. "
               f"{body} هل عندك سؤال، أم نكمل؟")
        return _resp(s, say, actions=[{"type": "set_step", "step": 4}], expects="continue", quick=["نكمل", "عندي سؤال"])

    if st == "plan":
        plan = " ".join(f"{i + 1}) {p}" for i, p in enumerate(s.lesson["plan"]))
        say = f"{prefix}رائع يا {n}! هذه خطة حفظك: {plan} هل عندك أي سؤال قبل أن ننتهي؟"
        return _resp(s, say, actions=[{"type": "set_step", "step": 5}], expects="continue", quick=["لا، شكرًا", "عندي سؤال"])

    more = s.lesson.get("has_more")
    if more:
        tail = "هل نكمل الآيات التالية، أم تكتفي اليوم؟"
        quick = ["نكمل الآيات التالية", "أكتفي اليوم"]
    else:
        # razan (2026-09-26): once this surah is truly finished, tell the
        # child by name what's next instead of a generic "سورة أخرى؟" —
        # the teacher already knows which pilot surah comes next.
        nxt = _next_pilot_surah(s)
        if nxt is not None:
            nxt_name = quran_data.surah_name(nxt)
            tail = f"أنهينا سورة {s.lesson['surah_name']} بحمد الله! هل تحب أن ننتقل الآن إلى سورة {nxt_name}، أم تكتفي اليوم؟"
            quick = [f"نعم، سورة {nxt_name}", "أكتفي اليوم"]
        else:
            tail = "ما شاء الله، أتممت السور الثلاث جميعًا! هل تحب مراجعة إحداها، أم تكتفي اليوم؟"
            quick = ["مراجعة سورة", "أكتفي اليوم"]
    say = _closing_line(s, tail)
    threading.Thread(target=_update_child_notes, args=(s,), daemon=True).start()
    r = _resp(s, say, expects="continue", quick=quick)
    # razan's request (2026-09-27): same "congratulations" completion screen
    # as the hadith path (see hadith_agent.py) -- fired once when the surah
    # lesson state machine reaches "done". No project/badge concept on the
    # Quran path, so badge_earned is simply omitted here.
    r["lesson_complete"] = True
    return r

def _recite_prompt(s: Session, first=False, prefix="") -> dict:
    i = s.ayah_idx
    intro = prefix + (f"والآن وقت التلاوة يا {s.child_name}! سأسمّعك كل آية، و{_v(s, 'تردّدها', 'تردّديها')} خلفي خمس مرات حتى نتقنها معًا، ثم ننتقل للآية التالية. " if first else "")
    L = s.lesson
    num = L.get("first_ayah", 1) + i
    listen_v, repeat_v = _v(s, "استمع", "استمعي"), _v(s, "ردّدها", "ردّديها")
    # varied phrasing (Abdulaziz's request, 2026-09-29) -- this exact line
    # repeats once per ayah, the single most-repeated scripted line in a whole
    # session, so it's the highest-value spot to de-script. Still instant
    # random.choice, no LLM call.
    say = f"{intro}" + random.choice([
        f"{listen_v} للآية {num}، ثم {repeat_v} بصوتك.",
        f"تعال {listen_v} للآية {num} الحين، وبعدها {repeat_v}.",
        f"{listen_v} جيدًا للآية {num}، وجرّب {repeat_v} بصوتك الجميل.",
    ])
    actions = [{"type": "play_ayah", "ayah": num, "text": L["ayat"][i],
                "url": quran_data.audio_url(L["surah_no"], num)},
               _show(s, i + 1),
               {"type": "set_step", "step": 0}]
    return _resp(s, say, actions=actions, expects="repeat", quick=["تخطّي الآية", "أعد الآية", "عندي سؤال"])

def _final_recitation_prompt(s: Session, prefix: str = "") -> dict:
    """The whole-surah checkpoint after every ayah has been drilled
    individually (razan's request #1): the child must recite the ENTIRE
    surah from memory, correctly, twice in a row."""
    pass_no = s.final_pass_count + 1
    say = f"{prefix}{_v(s, 'سمّعني', 'سمّعيني')} السورة كاملة من حفظك (المرة {pass_no} من 2)."
    actions = _ayat_actions(s) + [{"type": "set_step", "step": 0}]
    return _resp(s, say, actions=actions, expects="repeat", quick=["أعد الاستماع", "عندي سؤال"])

def _start_final_recitation(s: Session, prefix: str = "") -> dict:
    s.final_mode = True
    # razan (2026-09-26): resume at whatever pass count was already saved
    # last time (0 for a genuinely fresh start -- mark_done() clears this
    # once the checkpoint is truly finished, so a stale "2" can never leak
    # into a fresh attempt), instead of always restarting both required
    # passes from zero after leaving mid-checkpoint.
    s.final_pass_count = progress.final_pass_count(s.device_id, s.lesson["surah_no"], s.lesson["chunk"])
    s.tries = 0
    if s.final_pass_count > 0:
        intro = (prefix + f"أحسنت يا {s.child_name}! أنهينا آيات السورة كل آية على حدة. "
                 f"وسبق أن أتممت {s.final_pass_count} من أصل 2 من التلاوة الكاملة، "
                 f"{_v(s, 'فكمل', 'فكملي')} معي بقية المرات. ")
    else:
        intro = (prefix + f"أحسنت يا {s.child_name}! أنهينا آيات السورة كل آية على حدة. "
                 f"والآن سأُسمعك السورة كاملة، ثم أريدك أن {_v(s, 'تسمّعها', 'تسمّعيها')} لي من حفظك كاملة، مرتين متتاليتين، بتجويد ولغة صحيحة. ")
    return _final_recitation_prompt(s, intro)

def _next_pilot_surah(s: Session):
    """Next pilot surah (in pilot_config.PILOT_SURAH_ORDER) this device has
    NOT fully finished yet, or None if all pilot surahs are done. razan
    (2026-09-26): once a surah's recitation + lesson are fully finished, the
    teacher should know it and move straight into the next one, instead of
    asking the child to pick again from the full list every time."""
    for n_s in pilot_config.PILOT_SURAH_ORDER:
        if n_s in getattr(s, "done_surahs", ()) or progress.surah_done(s.device_id, n_s):
            continue
        return n_s
    return None

def _advance(s: Session, prefix: str = "") -> dict:
    s.stage = STAGES[min(STAGES.index(s.stage) + 1, len(STAGES) - 1)]
    return _open_stage(s, prefix)

def jump_stage(s: Session, stage: str) -> dict:
    """Child tapped an earlier section in the sidebar (e.g. jumping from
    'التلاوة' back to 'الفضائل') to review it. Only a stage already reached
    this session (index <= max_stage_idx) is allowed — this can never skip
    AHEAD of where the child actually is. Moving s.stage backward never
    lowers max_stage_idx, so nothing already unlocked gets re-locked."""
    if stage not in STAGES or STAGES.index(stage) > getattr(s, "max_stage_idx", 0):
        stage = s.stage
    if stage == "fadl" and not s.lesson.get("fadl"):
        stage = "recitation"
    s.stage = stage
    if stage == "recitation":
        # re-entering a stage already visited this session: keep the child's
        # CURRENT ayah position instead of re-deriving it from the DB partial
        # marker (that marker is only meant for a brand-new session resuming
        # after the child stopped early last time — see _open_stage above)
        s.tries = 0
        if s.ayah_idx >= len(s.lesson["ayat"]):
            return _start_final_recitation(s)
        s.final_mode = False
        s.final_pass_count = 0
        return _recite_prompt(s, first=(s.ayah_idx == 0))
    return _open_stage(s)

def _next_ayah(s: Session, prefix: str) -> dict:
    s.ayah_idx += 1
    s.tries = 0
    # razan (2026-09-26): save the resume point THE MOMENT each ayah is
    # mastered, not only when the child explicitly says a stop phrase. This
    # way, however the child actually leaves (an in-app "back" button, closing
    # the app, anything that doesn't send an explicit stop message) the real
    # progress made so far is never lost -- worst case they redrill the ONE
    # ayah they hadn't finished yet, never one already mastered.
    progress.save_partial(s.device_id, s.lesson["surah_no"], s.lesson["chunk"], s.ayah_idx)
    if s.ayah_idx >= len(s.lesson["ayat"]):
        return _start_final_recitation(s, prefix)
    return _recite_prompt(s, prefix=prefix)

def _expects(s: Session) -> str:
    return "text" if s.stage in TEXT_STAGES else ("repeat" if s.stage == "recitation" else "continue")

def _stop_session(s: Session) -> dict:
    """The child wants to end the lesson now, before it naturally finishes.
    Save whatever real progress exists (only a true full chunk recitation
    counts as "done" — this only saves the resume point within it) and end
    warmly, confirming to the child that their progress is kept."""
    n = s.child_name
    if s.stage == "recitation" and s.ayah_idx > 0:
        progress.save_partial(s.device_id, s.lesson["surah_no"], s.lesson["chunk"], s.ayah_idx)
    say = f"تمام يا {n}، ولا يهمك. تقدمك محفوظ عندنا، وزر 'رجوع' فوق الشاشة يرجعك للخلف. نكمل من نفس المكان في أي وقت إن شاء الله. إلى اللقاء!"
    return _resp(s, say, expects="none")

def _reopen(s: Session, ans: str, tail: str = "") -> dict:
    """Answer an interruption, then gently return to where the teacher was."""
    if s.stage == "recitation":
        r = _recite_prompt(s)
        r["say"] = ans + " والآن نرجع للتلاوة. " + r["say"]
    elif s.stage == "greet":
        # _open_stage("greet") always returns the fixed opening "السلام عليكم..."
        # line, meant to be said ONCE at session start — replaying it here (e.g. a
        # child asking a question before even answering "كيف حالك؟") would sound
        # like the session restarted. Just re-ask the same question instead.
        r = _resp(s, ans + f" بس قبل ما نكمل، كيف حالك يا {s.child_name}؟", expects="text",
            quick=["الحمد لله بخير", "تمام"])
        return r
    elif s.stage in TEXT_STAGES:
        r = _open_stage(s)
        r["say"] = ans + " " + r["say"]
    else:
        r = _resp(s, ans + (" " + tail if tail else " هل نكمل الدرس؟"), expects="continue", quick=CONTINUE_Q)
        return r
    s.history[-1]["text"] = r["say"]
    return r

# --------------------------------------------------------------------------- public API
def start(child_name: str = "", gender: str = "", device_id: str = "") -> dict:
    with _LOCK:
        _gc()
        s = Session()
        s.girl = vp.is_girl(gender)
        s.device_id = device_id or ""
        # razan (2026-09-29, per Abdulaziz): the frontend/backend already knows
        # and sends the child's real name -- no reason to ask "ما اسمك؟" as its
        # own separate stage anymore (removed from STAGES above), that felt
        # like a scripted intake form rather than a teacher who already knows
        # who they're talking to. Use it when a real name was actually given
        # (not the router's own placeholder default "يا بطل"); otherwise keep
        # the warm "بطل" fallback Session() already starts with.
        name = (child_name or "").strip()
        if name and name not in ("يا بطل", "بطل"):
            s.child_name = name
            s.profile["name"] = s.child_name
        if s.device_id:
            try:
                row = child_profile.get_notes(s.device_id)
                if row and row.get("notes"):
                    s.child_notes = row["notes"]
            except Exception:
                pass
        _SESSIONS[s.id] = s
    return _open_stage(s)

def handle(s: Session, text: str) -> dict:
    text = (text or "").strip()
    n = s.child_name
    if not text:
        return _resp(s, "لم أسمعك جيدًا يا " + n + "، هل تعيد من فضلك؟", expects=_expects(s))
    s.log("child", text)
    st = s.stage
    tn = _n(text)

    # razan's own-judgment latency improvement (2026-09-30): fire both
    # independent LLM second-opinion checks up front so their latency
    # overlaps instead of stacking -- see start_moderation_checks. Each
    # .bad_language()/.emotional() call below behaves exactly like the old
    # `word_check(text) or _llm_check(text)` it replaces.
    mod = start_moderation_checks(text)

    # ---- the child says something rude/hurtful: redirect gently, never scold
    if mod.bad_language():
        flag_log.record(s.device_id, "quran", "bad_language", s.child_name, text)  # razan's request #8
        say = _bad_language_reply(s, text)
        return _resp(s, say, expects=_expects(s), quick=CONTINUE_Q if st not in TEXT_STAGES else None)

    # ---- the child raises a hand: "يا معلم عندي سؤال"
    if _n("عندي سؤال") in tn or _n("لدي سؤال") in tn or tn in (_n("سؤال"), _n("اسأل"), _n("ممكن اسأل"), _n("أستاذ"), _n("يا معلم")):
        if len(tn.split()) <= 5:
            s.awaiting_q = True
            return _resp(s, f"تفضّل يا {n}، أنا أسمعك. ما هو سؤالك؟", expects="text")
    if s.awaiting_q:
        s.awaiting_q = False
        return _reopen(s, answer_interruption(s, text))

    # ---- the child refuses today's lesson outright, at the very first
    # message (razan's own-judgment testing round, 2026-09-30): checked here,
    # BEFORE the emotion check below, because a flat refusal like "ما ابي
    # احفظ اليوم خالص" reliably also reads as emotionally negative to
    # _llm_emotion_check -- so this deterministic, more specific signal was
    # never actually reached (dead code) once that check ran first. Moving it
    # up here doesn't change any other check's priority (bad language/raise-
    # hand/is_stop above still run first, exactly as before).
    if st == "greet" and declines_lesson(text):
        return _resp(s, f"ولا يهمك يا {n}، خذ راحتك اليوم. نقدر نحفظ في وقت ثاني يريحك أكثر إن شاء الله. إلى اللقاء!", expects="none")

    # ---- the child wants to stop the lesson now, from any stage -- except
    # "done", where the lesson has already finished (razan's testing,
    # 2026-09-30): _stop_session's wording ("تقدمك محفوظ... نكمل من نفس
    # المكان") is written for an UNFINISHED lesson, and "اكتفي" (one of the
    # _STOP_ANYTIME_WORDS) is also the "done" stage's own closing quick-reply
    # ("أكتفي اليوم"), whose dedicated, correct reply below this stage's own
    # branch never fired because this generic check ran first.
    if st != "done" and is_stop(text):
        return _stop_session(s)

    # ---- the child shows a feeling (sad/scared/tired/upset), unprompted —
    # checked AFTER is_stop so an actual stop request (e.g. "متعبة ما أريد
    # أكمل") still ends the session instead of only getting sympathy
    if mod.emotional():
        flag_log.record(s.device_id, "quran", "emotion", s.child_name, text)  # razan's request #8
        return _resp(s, _emotion_reply(s, text), expects="continue", quick=["جاهز نكمل", "أعطني دقيقة"])

    # ---- recitation: the child repeats an ayah
    if st == "recitation":
        # ---- the whole-surah double-recitation checkpoint (razan's request
        # #1, second half): every ayah was already drilled individually, now
        # the child must recite the ENTIRE surah correctly twice in a row.
        if getattr(s, "final_mode", False):
            if is_skip(text):
                s.final_mode = False
                progress.mark_done(s.device_id, "quran", f"{s.lesson['surah_no']}:{s.lesson['chunk']}")
                if not s.lesson.get("has_more"):
                    s.done_surahs.add(s.lesson["surah_no"])
                return _advance(s, "لا بأس، ننتقل لما بعد التلاوة. ")
            if _n("اعد الاستماع") in tn or (_n("اعد") in tn and len(text.split()) <= 3):
                return _final_recitation_prompt(s)
            full_target = " ".join(s.lesson["ayat"])
            sc = similarity(text, full_target)
            if (is_question(text) or wants_something_else(text)) and sc < 0.5:
                return _reopen(s, answer_interruption(s, text))
            s.tries += 1
            if is_recitation_correct(text, full_target, sc):
                s.final_pass_count += 1
                s.tries = 0
                # razan (2026-09-26): save this checkpoint pass immediately,
                # same reasoning as _next_ayah above -- leaving right after
                # pass 1 of 2 (any way, not just an explicit stop phrase)
                # must resume at pass 2, never restart both from zero.
                progress.save_final_pass(s.device_id, s.lesson["surah_no"], s.lesson["chunk"], s.final_pass_count)
                if s.final_pass_count >= 2:
                    progress.mark_done(s.device_id, "quran", f"{s.lesson['surah_no']}:{s.lesson['chunk']}")
                    if not s.lesson.get("has_more"):
                        s.done_surahs.add(s.lesson["surah_no"])
                    s.final_mode = False
                    return _advance(s, f"ما شاء الله يا {n}! أتممت تلاوة السورة كاملة مرتين بإتقان. ")
                return _final_recitation_prompt(s, f"أحسنت يا {n}! تلاوة ممتازة. ")
            fb = _fb(_cmp(full_target, text), n, s.girl) if sc >= 0.3 else ""
            prefix_fb = (fb + " " if fb else
                         ("قريب جدًا! لنحاول السورة كاملة مرة أخرى. " if sc >= 0.45 else
                          "لا بأس، خذ وقتك ونحاول السورة كاملة مرة أخرى. "))
            return _final_recitation_prompt(s, prefix_fb)

        if is_skip(text):
            return _next_ayah(s, "لا بأس، ننتقل للآية التالية. ")
        if "اعد" in tn and len(text.split()) <= 3:
            s.tries = 0
            return _recite_prompt(s)
        target = s.lesson["ayat"][s.ayah_idx]
        sc = similarity(text, target)
        if (is_question(text) or wants_something_else(text)) and sc < 0.5:
            return _reopen(s, answer_interruption(s, text))
        # NOTE: the old "is_continue -> skip straight to next ayah" shortcut
        # was removed here on purpose. Razan's new requirement is that every
        # ayah gets a mandatory 5-repeat drill AND a correctness check before
        # moving on, and letting a filler word like "تمام"/"يلا" jump straight
        # to the next ayah would bypass that requirement entirely.
        s.tries += 1
        correct = is_recitation_correct(text, target, sc)
        if s.tries < 5:
            # still inside the mandatory 5-repeat drill: always ask for another
            # repeat, whether or not this particular attempt was correct.
            if correct:
                prefix_fb = random.choice(_PRAISE_TEMPLATES).format(n=n)
            else:
                fb = _fb(_cmp(target, text), n, s.girl) if sc >= 0.3 else ""
                prefix_fb = fb + " " if fb else ("قريب جدًا! لنحاول مرة أخرى معًا. " if sc >= 0.45 else "لا بأس، سنحاول مرة أخرى ببطء. ")
            r = _recite_prompt(s)
            r["say"] = f"{prefix_fb}(المحاولة {s.tries} من 5) " + r["say"]
            s.history[-1]["text"] = r["say"]
            return r
        # reached (or passed) the 5th repeat: this is the real gate. If it's
        # correct now, move on; if it's still wrong, razan asked for MORE
        # attempts rather than moving on regardless — so tries keeps growing
        # past 5 until the child gets it right, no hard cap.
        if correct:
            s.scores.append({"ayah": s.lesson.get("first_ayah", 1) + s.ayah_idx, "score": sc, "tries": s.tries})
            return _next_ayah(s, f"ما شاء الله! أتممت الآية بخمس محاولات وبنطق سليم يا {n}. ")
        fb = _fb(_cmp(target, text), n, s.girl) if sc >= 0.3 else ""
        r = _recite_prompt(s)
        r["say"] = (fb + " " if fb else "لا بأس، خذ وقتك، نحتاج نتقنها أكثر قبل ما نكمل. ") + "(محاولة إضافية) " + r["say"]
        s.history[-1]["text"] = r["say"]
        return r

    # ---- surah choice
    if st == "surah":
        n_s = quran_data.find_surah(text)
        if n_s is None:
            if is_question(text) and len(text.split()) >= 2:
                return _reopen(s, answer_interruption(s, text))
            # razan's request (2026-09-30): this fallback used to hardcode only
            # 2 of the 3 pilot surahs ("الإخلاص أو سورة الفلق"), missing الناس,
            # and couldn't track pilot_config.PILOT_SURAH_ORDER if it ever
            # changed. Build it the same dynamic way _open_stage()'s "surah"
            # stage and the "done" stage's redirect (below) already do, so
            # there's a single source of truth for the order everywhere.
            names = "، أو ".join(quran_data.surah_name(n_s) for n_s in pilot_config.PILOT_SURAH_ORDER)
            return _open_stage(s, f"لم أفهم اسم السورة، قل مثلًا: {names}. ")
        if n_s not in pilot_config.PILOT_SURAHS:
            # a real surah, just outside the pilot's active scope right now
            # (razan's request #5) — redirect gently instead of teaching it.
            return _open_stage(s, f"سورة {quran_data.surah_name(n_s)} جميلة، ورح نتعلمها قريبًا في الدروس القادمة إن شاء الله! ")
        s.lesson = quran_data.build_lesson(n_s, progress.next_quran_chunk(s.device_id, n_s))
        s.ayah_idx, s.tries = 0, 0
        s.profile["surah"] = s.lesson["surah_name"]
        return _advance(s)

    # ---- after a lesson: continue / another surah / stop
    if st == "done":
        if any(w in tn for w in (_n("اكتفي"), _n("مع السلامه"), _n("وداعا"))) or tn in (_n("لا"), _n("لا شكرا"), _n("شكرا")):
            return _resp(s, f"بارك الله فيك يا {n}! في أمان الله.", expects="none")
        if s.lesson.get("has_more") and (is_continue(text) or _n("التاليه") in tn or _n("نكمل") in tn):
            s.lesson = quran_data.build_lesson(s.lesson["surah_no"], s.lesson["chunk"] + 1)
            s.ayah_idx, s.tries, s.stage = 0, 0, "lesson_intro"
            return _open_stage(s, "أحسنت! ")
        pick = quran_data.find_surah(text)
        if pick is not None and pick not in pilot_config.PILOT_SURAHS and not is_question(text):
            names = "، أو ".join(quran_data.surah_name(n_s) for n_s in pilot_config.PILOT_SURAH_ORDER)
            return _resp(s, f"سورة {quran_data.surah_name(pick)} جميلة، ورح نتعلمها قريبًا في الدروس القادمة إن شاء الله! هل تحب سورة أخرى من: {names}، أم تكتفي اليوم؟",
                expects="continue", quick=["سورة أخرى", "أكتفي اليوم"])
        if pick is not None and not is_question(text):
            s.lesson = quran_data.build_lesson(pick, progress.next_quran_chunk(s.device_id, pick))
            s.ayah_idx, s.tries, s.stage = 0, 0, "lesson_intro"
            return _open_stage(s, "")
        if _n("اخري") in tn or _n("غيرها") in tn or _n("سوره") in tn or is_continue(text):
            nxt = _next_pilot_surah(s)
            if nxt is not None:
                # razan (2026-09-26): auto-advance straight into the next
                # not-yet-finished pilot surah instead of re-asking the
                # child to pick again from the full list.
                finished_name = s.lesson.get("surah_name", "")
                s.lesson = quran_data.build_lesson(nxt, progress.next_quran_chunk(s.device_id, nxt))
                s.ayah_idx, s.tries, s.stage = 0, 0, "lesson_intro"
                s.profile["surah"] = s.lesson["surah_name"]
                return _open_stage(s, f"ما شاء الله يا {n}! أنهيت سورة {finished_name} بنجاح. ")
            s.stage = "surah"
            return _open_stage(s, "")
        return _resp(s, answer_interruption(s, text) + " هل نكمل؟", expects="continue",
            quick=(["نكمل الآيات التالية"] if s.lesson.get("has_more") else []) + ["سورة أخرى", "أكتفي اليوم"])

    # ---- the personal questions
    if st == "greet":
        # declines_lesson() is now checked earlier (see above, before the
        # emotion check) -- reaching here means the child is just answering
        # normally.
        s.profile["mood"] = text
        return _advance(s)

    # ---- content stages: continue / question
    if is_question(text) or not (is_continue(text) or is_skip(text)):
        if st == "done":
            return _resp(s, answer_interruption(s, text), expects="none")
        return _reopen(s, answer_interruption(s, text))
    if st == "done":
        return _resp(s, "إلى اللقاء يا " + n + "!", expects="none")
    return _advance(s)

# --------------------------------------------------------------------------- "تسميع" (recall check)
# Separate, deliberately simple flow razan asked for: a day (not the same
# session) after a surah/chunk is fully learned, the child can come back and
# recite it again FROM MEMORY (no listen-first) so we can score how well it
# stuck. It reuses the recitation similarity/feedback helpers above but keeps
# its own tiny session store — it isn't a conversational lesson (no name/age/
# why), so it doesn't belong in the Session/STAGES machinery above.
_TASEEM_SESSIONS = {}

class TaseemSession:
    def __init__(self, device_id: str, gender: str, surah_no: int, chunk: int):
        self.id = uuid.uuid4().hex
        self.device_id = device_id or ""
        self.girl = vp.is_girl(gender)
        self.child_name = _random_nickname()  # see the matching note in Session.__init__
        self.lesson = quran_data.build_lesson(surah_no, chunk)
        self.ayah_idx = 0
        self.tries = 0
        self.scores = []
        self.created = time.time()

# razan's request #1 follow-up: taseem sessions are short (a single
# recall-check sitting), so this was left out of the first round as lower
# priority -- added now on request, same pattern as the main Session above.
def _taseem_to_dict(s: "TaseemSession") -> dict:
    return {
        "id": s.id, "device_id": s.device_id, "girl": s.girl, "child_name": s.child_name,
        "lesson_surah_no": s.lesson.get("surah_no"), "lesson_chunk": s.lesson.get("chunk"),
        "ayah_idx": s.ayah_idx, "tries": s.tries, "scores": s.scores, "created": s.created,
    }

def _taseem_from_dict(d: dict) -> "TaseemSession":
    surah_no, chunk = d.get("lesson_surah_no"), d.get("lesson_chunk")
    s = TaseemSession(d.get("device_id") or "", "girl" if d.get("girl") else "boy", surah_no, chunk)
    s.id = d["id"]
    s.child_name = d.get("child_name") or s.child_name
    s.ayah_idx = d.get("ayah_idx") or 0
    s.tries = d.get("tries") or 0
    s.scores = d.get("scores") or []
    s.created = d.get("created") or time.time()
    return s

def get_taseem_session(sid: str):
    s = _TASEEM_SESSIONS.get(sid)
    if s is not None:
        return s
    d = session_store.load(sid, "taseem")
    if not d:
        return None
    try:
        s = _taseem_from_dict(d)
    except Exception:
        return None
    _TASEEM_SESSIONS[s.id] = s
    return s

def _taseem_persist(s: "TaseemSession"):
    try:
        session_store.save(s.id, "taseem", _taseem_to_dict(s))
    except Exception:
        pass

def _taseem_resp(s: TaseemSession, say: str, actions=None, expects="text", quick=None) -> dict:
    _taseem_persist(s)  # razan's request #1 follow-up: durable, same as the main Session
    L = s.lesson
    stages = [{"id": str(i), "label": f"الآية {L.get('first_ayah', 1) + i}"} for i in range(len(L["ayat"]))]
    return {
        "session_id": s.id, "kind": "taseem", "teacher": vp.teacher_name(s.girl), "female": s.girl,
        "stage_index": min(s.ayah_idx, len(stages) - 1), "stages": stages,
        "say": vp.adapt(say, s.girl), "actions": actions or [], "expects": expects,
        "quick_replies": [vp.adapt_quick(q, s.girl) for q in (quick or [])],
        "lesson_title": s.lesson["title"], "surah_no": s.lesson["surah_no"], "recitation_scores": s.scores,
    }

def _taseem_prompt(s: TaseemSession, first: bool = False) -> dict:
    i = s.ayah_idx
    num = s.lesson.get("first_ayah", 1) + i
    intro = (f"والآن وقت التسميع! {_v(s, 'سمّع', 'سمّعي')} الآيات من حفظك بدون أن أقرأها لك أولًا، "
              f"ونشوف كم {_v(s, 'تتذكر', 'تتذكرين')}. ") if first else ""
    say = f"{intro}{_v(s, 'سمّع', 'سمّعي')} الآية {num} من حفظك."
    actions = [_show(s, i + 1, hide_text=True)]
    return _taseem_resp(s, say, actions=actions, expects="repeat", quick=["تخطّي الآية", "أعد الآية"])

def _taseem_finish(s: TaseemSession) -> dict:
    avg = round(sum(x["score"] for x in s.scores) / len(s.scores), 2) if s.scores else 0.0
    progress.mark_done(s.device_id, "quran_taseem", f"{s.lesson['surah_no']}:{s.lesson['chunk']}", avg)
    pct = round(avg * 100)
    if pct >= 85:
        line = "ما شاء الله، تسميعك ممتاز! السورة ثابتة في حفظك."
    elif pct >= 60:
        line = f"أحسنت، تسميع جيد! {_v(s, 'راجع', 'راجعي')} الآيات اللي {_v(s, 'نسيتها', 'نسيتيها')} شوي {_v(s, 'وتكون', 'وتكوني')} أقوى."
    else:
        line = f"لا بأس، هذا طبيعي! {_v(s, 'راجع', 'راجعي')} السورة مرة كمان اليوم و{_v(s, 'ارجع', 'ارجعي')} {_v(s, 'سمّعها', 'سمّعيها')} بعد يوم."
    say = f"{line} درجتك في هذا التسميع: {pct} من 100."
    return _taseem_resp(s, say, expects="none")

def start_taseem(device_id: str, gender: str, surah_no: int, chunk: int) -> dict:
    s = TaseemSession(device_id, gender, surah_no, chunk)
    _TASEEM_SESSIONS[s.id] = s
    return _taseem_prompt(s, first=True)

def handle_taseem(s: TaseemSession, text: str) -> dict:
    text = (text or "").strip()
    if not text:
        return _taseem_resp(s, f"لم أسمعك جيدًا، هل {_v(s, 'تعيد', 'تعيدين')}؟", expects="repeat")
    # razan's own-judgment improvement round (2026-09-30): handle_taseem had
    # none of the safety checks the main lesson flow (handle(), above) has --
    # a child who got upset or used a hurtful word mid recall-check was just
    # scored/repeated like any other attempt. Mirrors handle()'s same two
    # checks (same reply helpers, since they only need s.child_name/s.girl,
    # which TaseemSession has). Kept intentionally minimal -- no
    # awaiting_q/raise-hand or stop-session here, since taseem has no such
    # concepts: it's a single short recall sitting with no persisted "stopped"
    # state to return to.
    if has_bad_language(text) or _llm_bad_language_check(text):
        flag_log.record(s.device_id, "quran_taseem", "bad_language", s.child_name, text)
        return _taseem_resp(s, _bad_language_reply(s, text), expects="repeat", quick=["تخطّي الآية", "أعد الآية"])
    if has_emotion(text) or _llm_emotion_check(text):
        flag_log.record(s.device_id, "quran_taseem", "emotion", s.child_name, text)
        return _taseem_resp(s, _emotion_reply(s, text), expects="repeat", quick=["تخطّي الآية", "أعد الآية"])
    if is_skip(text) or (is_continue(text) and len(text.split()) <= 2):
        s.ayah_idx += 1
        s.tries = 0
        if s.ayah_idx >= len(s.lesson["ayat"]):
            return _taseem_finish(s)
        return _taseem_prompt(s)
    if "اعد" in _n(text) and len(text.split()) <= 3:
        s.tries = 0
        return _taseem_prompt(s)
    target = s.lesson["ayat"][s.ayah_idx]
    sc = similarity(text, target)
    s.tries += 1
    # razan's own-judgment improvement round (2026-09-30): same word-substitution
    # blind spot already fixed in the main recitation flow (is_recitation_correct)
    # and in hadith's memorize stage -- a real wrong word could still pass here
    # if the rest of the ayah was said correctly.
    ok = is_recitation_correct(text, target, sc)
    if ok or s.tries >= 2:
        s.scores.append({"ayah": s.lesson.get("first_ayah", 1) + s.ayah_idx, "score": sc, "tries": s.tries})
        s.ayah_idx += 1
        s.tries = 0
        if s.ayah_idx >= len(s.lesson["ayat"]):
            r = _taseem_finish(s)
        else:
            r = _taseem_prompt(s)
        if ok:
            r["say"] = "ما شاء الله! " + r["say"]
        return r
    r = _taseem_prompt(s)
    fb = _fb(_cmp(target, text), s.child_name, s.girl) if sc >= 0.3 else _v(s, "حاول مرة أخرى.", "حاولي مرة أخرى.")
    r["say"] = fb + " " + r["say"]
    return r
