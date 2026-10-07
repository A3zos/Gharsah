"""Model #4 — the live "AI teacher" agent (المعلم حمود).

A guided, human-like conversation with the child, in Arabic, like a real teacher:

  greet (كيفك؟) -> name -> age -> why did you come -> why Manara (what you learn is for YOU)
  -> lesson intro (Al-Fatiha) -> tafsir -> fadl -> recitation (listen + repeat) -> plan -> done

* The FLOW is a deterministic state machine, so a session always reaches the end.
* Religious CONTENT comes only from `lesson_content.py` (fixed, reviewed). The LLM is
  used only for warm wording, and for answering the child's interruptions (RAG).
* The child can interrupt at ANY moment ("يا معلم عندي سؤال").
* Works without an API key (scripted wording); with ANTHROPIC_API_KEY it is conversational.
"""
import difflib
import json
import os
import re
import threading
import time
import uuid

from app.services import llm_service
from app.services.lesson_content import LESSON
from app.services.text_utils import normalize_ar

try:
    import anthropic
except ImportError:  # pragma: no cover
    anthropic = None

TEACHER_NAME = "المعلم حمود"
MODEL_NAME = os.environ.get("MANARA_LLM_MODEL", "claude-sonnet-4-5")
AUDIO_URL = "https://everyayah.com/data/Alafasy_128kbps/{surah:03d}{ayah:03d}.mp3"

STAGES = ["greet", "name", "age", "why", "purpose", "lesson_intro", "tafsir", "fadl",
          "recitation", "plan", "done"]
STAGE_LABELS = {
    "greet": "الترحيب", "name": "التعارف", "age": "العمر", "why": "سبب المجيء",
    "purpose": "لماذا منارة", "lesson_intro": "بداية الدرس", "tafsir": "التفسير",
    "fadl": "الفضائل", "recitation": "التلاوة", "plan": "خطة الحفظ", "done": "النهاية",
}
TEXT_STAGES = {"greet", "name", "age", "why"}

PERSONA = f"""أنت "{TEACHER_NAME}"، معلّم قرآن رجل لطيف يتحدث مع طفل عمره 6-12 سنة في منصة "منارة".
تتصرف مثل معلّم إنسان حقيقي: دافئ، صبور، مبتسم، تشجّع الطفل دائمًا، وتناديه باسمه إذا عرفته.
اللغة: عربية بسيطة جدًا قريبة من لهجة الأطفال، وجمل قصيرة (جملتان إلى ثلاث جمل على الأكثر). لا رموز ولا قوائم ولا إيموجي.
قواعد صارمة:
- لا تخترع أي آية أو حديث أو حكم شرعي. اعتمد فقط على "السياق المرجعي" و"الحقائق" المرفقة لأي معلومة دينية.
- إن كان السؤال فقهيًا أو عقديًا حساسًا أو لا يوجد له سياق، قل بلطف إنك ستسأل معلّمًا مختصًا وتخبره، ولا تجتهد.
- اكتب الكلام الذي ستقوله بصوتك فقط، دون عناوين ولا شرح لما تفعل."""

_CONTINUE_WORDS = ["اكمل", "كمل", "كمّل", "تابع", "نكمل", "يلا", "يالله", "هيا", "تمام", "نعم", "ايوه",
                   "اي نعم", "جاهز", "حاضر", "طيب", "ok", "okay", "next", "التالي", "ابدا", "ابدأ", "خلاص", "موافق", "شكرا", "شكراً"]
_SKIP_WORDS = ["تخطي", "تخطى", "تجاوز", "الي بعده", "التالية", "skip"]
_Q_START = ["هل", "ما", "ماذا", "لماذا", "ليش", "كيف", "متى", "اين", "أين", "من ", "ايش", "شو", "وش", "علاش",
            "what", "why", "how", "when", "where", "who", "is ", "are ", "can "]
_FILLER = ["احب", "أحب", "احب ان", "اريد", "أريد", "ابغى", "ابي", "بدي", "اتعلم", "أتعلم", "عن", "اهتم", "بـ", "انا", "أنا",
           "مهتم", "مهتمة", "بال", "شيء", "شي", "اشياء", "أشياء", "اللي", "الي", "احب اتعلم", "تعلم"]


# --------------------------------------------------------------------------- utils
def _n(text: str) -> str:
    """Aggressive normalisation for matching/scoring (no diacritics, unified letters)."""
    t = normalize_ar(text or "").lower()
    for a, b in (("أ", "ا"), ("إ", "ا"), ("آ", "ا"), ("ى", "ي"), ("ة", "ه"), ("ؤ", "و"), ("ئ", "ي")):
        t = t.replace(a, b)
    t = re.sub(r"[^\w\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def is_question(text: str) -> bool:
    t = (text or "").strip()
    if "؟" in t or "?" in t:
        return True
    tn = _n(t) + " "
    if "؟" not in t and "?" not in t and (tn.startswith("ما شاء") or tn.startswith("ماشاء")
            or any(w in tn for w in ("حلو", "جميل", "رائع", "ممتاز", "اعجب", "احببت", "يعجب", "روعه"))):
        return False
    return any(tn.startswith(_n(w) + " ") if not w.endswith(" ") else tn.startswith(_n(w)) for w in _Q_START)


def is_continue(text: str) -> bool:
    tn = _n(text)
    if not tn or len(tn.split()) > 5:
        return False
    return any(_n(w) in tn.split() or _n(w) == tn for w in _CONTINUE_WORDS)


def is_skip(text: str) -> bool:
    tn = _n(text)
    return any(_n(w) in tn for w in _SKIP_WORDS)


def similarity(heard: str, target: str) -> float:
    a, b = _n(heard), _n(target)
    if not a or not b:
        return 0.0
    char = difflib.SequenceMatcher(None, a, b).ratio()
    aw, bw = a.split(), b.split()
    word = difflib.SequenceMatcher(None, aw, bw).ratio()
    return round(max(char, (char + word) / 2), 3)


def _clean_topic(text: str) -> str:
    words = [w for w in re.sub(r"[؟?!.,،]", " ", text or "").split() if _n(w) not in {_n(f) for f in _FILLER}]
    topic = " ".join(words).strip() or (text or "").strip()
    return topic[:40]


# --------------------------------------------------------------------------- LLM
_client = None


def llm_available() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY")) and anthropic is not None


def _llm(system: str, user: str, max_tokens: int = 300):
    """One Claude call. Returns text, or None if there's no key / any failure
    (callers always have a scripted fallback, so the session never breaks)."""
    global _client
    if not llm_available():
        return None
    try:
        if _client is None:
            _client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"], timeout=25.0)
        msg = _client.messages.create(
            model=MODEL_NAME, max_tokens=max_tokens, system=system,
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(b.text for b in msg.content if b.type == "text").strip()
        return text or None
    except Exception:
        return None


def _history_text(s, n: int = 6) -> str:
    return "\n".join(f"{'المعلّم' if h['role'] == 'teacher' else 'الطفل'}: {h['text']}" for h in s.history[-n:])


def _say(s, goal: str, fallback: str, facts: str = "") -> str:
    """Warm wording for a social turn. Falls back to the scripted line."""
    user = (f"اسم الطفل: {s.child_name}\nما نعرفه عنه: {json.dumps(s.profile, ensure_ascii=False)}\n"
            f"آخر الحوار:\n{_history_text(s)}\n\n"
            + (f"الحقائق المسموح بها:\n{facts}\n\n" if facts else "")
            + f"مهمتك الآن: {goal}\nاكتب ما ستقوله للطفل فقط.")
    return _llm(PERSONA, user) or fallback


def answer_interruption(s, question: str) -> str:
    try:
        context = llm_service.retrieve_context(question)
    except Exception:
        context = ""
    facts = (f"درس اليوم: {LESSON['title']}\nالتفسير: " + " / ".join(LESSON["tafsir"]) + "\nالفضل: " + LESSON["fadl"])
    user = (f"اسم الطفل: {s.child_name}\nسؤال الطفل: {question}\n\n"
            f"السياق المرجعي من قاعدة المعرفة:\n{context}\n\n{facts}\n\n"
            "أجب عن سؤاله بلطف وباختصار اعتمادًا على ما سبق فقط. إن لم يكفِ السياق فقل إنك ستسأل معلّمًا مختصًا.")
    text = _llm(PERSONA, user)
    if text:
        return text
    if context and not context.startswith("(لا يوجد"):
        return "سؤال حلو يا " + s.child_name + "! هذا ما وجدته لك: " + context.split("\n\n")[0]
    qn = _n(question)
    if any(w in qn for w in ("فاتحه", "سوره", "معني", "تفسير")):
        return "سؤال حلو! باختصار: " + " ".join(LESSON["tafsir"][:2])
    return "سؤال حلو يا " + s.child_name + "! سأسأل معلّمًا مختصًا وأخبرك بالجواب بإذن الله."


def _extract_name(text: str) -> str:
    t = re.sub(r"[؟?!.,،]", " ", text or "")
    words = [w for w in t.split() if _n(w) not in {"اسمي", "انا", "اسم", "اسمى", "يعني", "هو", "ان", "انه", "بس"}]
    return (" ".join(words[:2]) or (text or "").strip())[:20] or "يا بطل"


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


# --------------------------------------------------------------------------- sessions
class Session:
    def __init__(self):
        self.id = uuid.uuid4().hex
        self.child_name = "يا بطل"
        self.stage = "greet"
        self.profile = {}
        self.history = []
        self.ayah_idx = 0
        self.tries = 0
        self.scores = []
        self.awaiting_q = False
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


def get_session(sid: str):
    return _SESSIONS.get(sid)


def _resp(s: Session, say: str, actions=None, expects="text", quick=None) -> dict:
    s.log("teacher", say)
    return {
        "session_id": s.id, "teacher": TEACHER_NAME, "stage": s.stage,
        "stage_index": STAGES.index(s.stage), "stages": [{"id": k, "label": STAGE_LABELS[k]} for k in STAGES],
        "say": say, "actions": actions or [], "expects": expects, "quick_replies": quick or [],
        "profile": s.profile, "child_name": s.child_name, "llm": llm_available(),
        "recitation_scores": s.scores,
    }


CONTINUE_Q = ["أكمل الدرس", "عندي سؤال"]


def _ayat_actions():
    return [{"type": "show_ayat", "ayat": LESSON["ayat"]},
            {"type": "play_all", "urls": [AUDIO_URL.format(surah=LESSON["surah_no"], ayah=i + 1) for i in range(len(LESSON["ayat"]))]}]


# --------------------------------------------------------------------------- stage openers
def _open_stage(s: Session, prefix: str = "") -> dict:
    """What the teacher says on ENTERING the current stage."""
    n, st = s.child_name, s.stage

    if st == "greet":
        say = _say(s, "رحّب بالطفل بحرارة (السلام عليكم ورحمة الله)، عرّف بنفسك أنك المعلم حمود، ثم اسأله: كيف حالك اليوم؟",
                   "السلام عليكم ورحمة الله وبركاته! أهلًا وسهلًا بك، أنا المعلم حمود، سعيد جدًا أنك جئت اليوم. كيف حالك يا بطل؟")
        return _resp(s, say, expects="text", quick=["الحمد لله بخير", "تمام"])

    if st == "name":
        say = _say(s, "علّق على رده على سؤال (كيف حالك) بلطف ودعاء قصير، ثم اسأله: ما اسمك؟",
                   f"{prefix}الحمد لله، سعدت بذلك! أخبرني يا صديقي، ما اسمك؟")
        return _resp(s, say, expects="text")

    if st == "age":
        say = _say(s, "قل له: تشرفت بمعرفتك، ثم اسأله: كم عمرك يا " + n + "؟",
                   f"{prefix}تشرّفت بمعرفتك يا {n}! اسم جميل. كم عمرك يا {n}؟")
        return _resp(s, say, expects="text", quick=["6", "7", "8", "9", "10", "11", "12"])

    if st == "why":
        say = _say(s, "علّق على عمره بلطف، ثم اسأله: ما الذي جاء بك اليوم؟ وماذا تحب أن نتعلم معًا؟",
                   f"{prefix}ما شاء الله! ما الذي جاء بك اليوم يا {n}؟ وماذا تحب أن نتعلم معًا؟")
        return _resp(s, say, expects="text", quick=["أريد أحفظ القرآن", "أبي يريدني", "لا أعرف"])

    if st == "purpose":
        say = (f"{prefix}أحسنت يا {n}. أتعرف لماذا سجّلناك في منارة؟ لأن ما تتعلمه هنا هو لنفسك أنت، "
               "ليس لأجلي ولا لأجل أهلك ولا لأجل درجات. القرآن يبقى في قلبك ويكبر معك، ويجعلك قويًا وقريبًا من الله، ولك أجر كل حرف تقرؤه. "
               "وأنا أنتظرك في كل خطوة، وتستطيع أن تقاطعني في أي وقت وتقول: يا معلم عندي سؤال. هل أنت جاهز أن نبدأ؟")
        return _resp(s, say, expects="continue", quick=["جاهز", "عندي سؤال"])

    if st == "lesson_intro":
        say = (f"{prefix}اليوم نتعلم أعظم سورة في القرآن يا {n}: سورة الفاتحة. سبع آيات قصيرة وجميلة، وسنتعلم معناها وفضلها ثم نقرؤها معًا. "
               "استمع أولًا إلى الآيات بصوت الشيخ العفاسي.")
        return _resp(s, say, actions=_ayat_actions(), expects="continue", quick=CONTINUE_Q)

    if st == "tafsir":
        say = f"{prefix}نتعلّم الآن معنى الآيات. " + " ".join(f"في الآية {i + 1}: {t}" for i, t in enumerate(LESSON["tafsir"])) + " هل عندك سؤال، أم نكمل؟"
        return _resp(s, say, actions=[{"type": "set_step", "step": 3}], expects="continue", quick=CONTINUE_Q)

    if st == "fadl":
        say = f"{prefix}وما فضل هذه السورة؟ {LESSON['fadl']} هل عندك سؤال، أم نبدأ التلاوة؟"
        return _resp(s, say, actions=[{"type": "set_step", "step": 1}], expects="continue", quick=["ابدأ التلاوة", "عندي سؤال"])

    if st == "recitation":
        s.ayah_idx, s.tries = 0, 0
        return _recite_prompt(s, first=True, prefix=prefix)

    if st == "plan":
        plan = " ".join(f"{i + 1}) {p}" for i, p in enumerate(LESSON["plan"]))
        say = f"{prefix}رائع يا {n}! هذه خطة حفظك: {plan} هل عندك أي سؤال قبل أن ننتهي؟"
        return _resp(s, say, actions=[{"type": "set_step", "step": 5}], expects="continue", quick=["لا، شكرًا", "عندي سؤال"])

    say = _say(s, "اختم الجلسة بتشجيع الطفل والدعاء له وتذكيره بخطة الحفظ وأنك بانتظاره في الجلسة القادمة.",
               f"بارك الله فيك يا {n}! كنت طالبًا رائعًا اليوم. لا تنسَ خطة الحفظ، وأنا بانتظارك في الجلسة القادمة بإذن الله. في أمان الله!")
    return _resp(s, say, expects="none")


def _recite_prompt(s: Session, first=False, prefix="") -> dict:
    i = s.ayah_idx
    intro = prefix + (f"والآن وقت التلاوة يا {s.child_name}! سأسمّعك كل آية وتردّدها بعدي. " if first else "")
    say = f"{intro}استمع للآية {i + 1}، ثم ردّدها بصوتك."
    actions = [{"type": "play_ayah", "ayah": i + 1, "text": LESSON["ayat"][i],
                "url": AUDIO_URL.format(surah=LESSON["surah_no"], ayah=i + 1)},
               {"type": "show_ayat", "ayat": LESSON["ayat"], "current": i + 1},
               {"type": "set_step", "step": 0}]
    return _resp(s, say, actions=actions, expects="repeat", quick=["تخطّي الآية", "أعد الآية", "عندي سؤال"])


def _advance(s: Session, prefix: str = "") -> dict:
    s.stage = STAGES[min(STAGES.index(s.stage) + 1, len(STAGES) - 1)]
    return _open_stage(s, prefix)


def _next_ayah(s: Session, prefix: str) -> dict:
    s.ayah_idx += 1
    s.tries = 0
    if s.ayah_idx >= len(LESSON["ayat"]):
        return _advance(s, prefix + "أنهينا كل آيات السورة! ")
    return _recite_prompt(s, prefix=prefix)


def _expects(s: Session) -> str:
    return "text" if s.stage in TEXT_STAGES else ("repeat" if s.stage == "recitation" else "continue")


def _reopen(s: Session, ans: str, tail: str = "") -> dict:
    """Answer an interruption, then gently return to where the teacher was."""
    if s.stage == "recitation":
        r = _recite_prompt(s)
        r["say"] = ans + " والآن نرجع للتلاوة. " + r["say"]
    elif s.stage in TEXT_STAGES or s.stage == "purpose":
        r = _open_stage(s)
        r["say"] = ans + " " + r["say"]
    else:
        r = _resp(s, ans + (" " + tail if tail else " هل نكمل الدرس؟"), expects="continue", quick=CONTINUE_Q)
        return r
    s.history[-1]["text"] = r["say"]
    return r


# --------------------------------------------------------------------------- public API
def start(child_name: str = "") -> dict:
    with _LOCK:
        _gc()
        s = Session()
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

    # ---- the child raises a hand: "يا معلم عندي سؤال"
    if "عندي سؤال" in tn or "لدي سؤال" in tn or tn in ("سؤال", "اسال", "ممكن اسال", "استاذ"):
        if len(tn.split()) <= 5:
            s.awaiting_q = True
            return _resp(s, f"تفضّل يا {n}، أنا أسمعك. ما هو سؤالك؟", expects="text")
    if s.awaiting_q:
        s.awaiting_q = False
        return _reopen(s, answer_interruption(s, text))

    # ---- recitation: the child repeats an ayah
    if st == "recitation":
        if is_skip(text):
            return _next_ayah(s, "لا بأس، ننتقل للآية التالية. ")
        if "اعد" in tn and len(text.split()) <= 3:
            s.tries = 0
            return _recite_prompt(s)
        target = LESSON["ayat"][s.ayah_idx]
        sc = similarity(text, target)
        if is_question(text) and sc < 0.5:
            return _reopen(s, answer_interruption(s, text))
        if is_continue(text) and len(text.split()) <= 2:
            return _next_ayah(s, "")
        s.tries += 1
        if sc >= 0.72:
            s.scores.append({"ayah": s.ayah_idx + 1, "score": sc, "tries": s.tries})
            return _next_ayah(s, f"ما شاء الله! تلاوتك ممتازة يا {n}. ")
        if s.tries >= 2:
            s.scores.append({"ayah": s.ayah_idx + 1, "score": sc, "tries": s.tries})
            return _next_ayah(s, "أحسنت المحاولة! سنراجعها مرة أخرى بإذن الله. ")
        r = _recite_prompt(s)
        r["say"] = ("قريب جدًا! لنحاول مرة أخرى معًا. " if sc >= 0.45 else "لا بأس، سنحاول مرة أخرى ببطء. ") + r["say"]
        s.history[-1]["text"] = r["say"]
        return r

    # ---- the personal questions
    if st == "greet":
        s.profile["mood"] = text
        return _advance(s)
    if st == "name":
        if is_question(text) and len(text.split()) >= 2:
            return _reopen(s, answer_interruption(s, text))
        s.child_name = _extract_name(text)
        s.profile["name"] = s.child_name
        return _advance(s)
    if st == "age":
        age = _extract_age(text)
        if age is None and is_question(text):
            return _reopen(s, answer_interruption(s, text))
        s.profile["age"] = age if age is not None else text
        return _advance(s)
    if st == "why":
        if is_question(text) and len(text.split()) >= 2:
            return _reopen(s, answer_interruption(s, text))
        s.profile["why"] = text
        return _advance(s)

    # ---- content stages: continue / question
    if is_question(text) or not (is_continue(text) or is_skip(text)):
        if st == "done":
            return _resp(s, answer_interruption(s, text), expects="none")
        return _reopen(s, answer_interruption(s, text))
    if st == "done":
        return _resp(s, "إلى اللقاء يا " + n + "!", expects="none")
    return _advance(s)
