"""المعلم عبدالله — hadith path. Same idea as the Quran teacher (agent_service):
a deterministic flow so a session always finishes; religious CONTENT is fixed
(hadith_content.py); the LLM only words social turns and answers interruptions.

greet -> name -> intro (choose a hadith) -> text -> meaning -> example -> memorize
-> quiz -> action (includes the child's own "project") -> done
"""
import random
import threading
import time
import uuid

from app.services import llm_service
from app.services import voice_persona as vp
from app.services import progress
from app.services import child_profile
from app.services import pilot_config
from app.services import session_store
from app.services import flag_log
from app.services.agent_service import (
    TEACHER_NAME, _n, _llm, is_continue, is_skip, is_question, is_stop, similarity, llm_available,
    _update_child_notes, has_bad_language, has_emotion, FAST_MODEL_NAME, _v, _llm_bad_language_check,
    _random_nickname, _llm_emotion_check, wants_something_else, is_recitation_correct, declines_lesson,
    start_moderation_checks,
)
from app.services.hadith_content import HADITH_LESSONS
from app.services import hadith_autogen
from app.services.hadith_nawawi import NAWAWI_HIDDEN
from app.services.recitation_compare import compare as _cmp, feedback_ar as _fb

_EXTRA_GO = ["مستعد", "مستعده", "مستعدة", "جاهزه", "جاهزة", "سأفعل", "ساعمل", "اعمل"]

def _go(text):
    tn = _n(text)
    return is_continue(text) or (len(tn.split()) <= 3 and any(_n(w) in tn.split() for w in _EXTRA_GO))

# razan's request (2026-09-27): "عمل اليوم" (action) and "المشروع" (project)
# are ONE merged step -- the child states, in their own words, their personal
# takeaway/commitment from THIS hadith right after seeing the day's suggested
# action, and that becomes "their project" (saved via progress.save_project).
STAGES = ["greet", "intro", "text", "words", "meaning", "example", "memorize", "quiz", "action", "done"]
STAGE_LABELS = {"greet": "الترحيب", "intro": "اختيار الحديث", "text": "الحديث",
                "words": "معاني الكلمات", "meaning": "المعنى", "example": "مثال", "memorize": "الحفظ", "quiz": "سؤال",
                "action": "عمل اليوم", "done": "النهاية"}
TEXT_STAGES = {"greet"}
CONTINUE_Q = ["أكمل", "عندي سؤال"]

# response-variety templates (Abdulaziz's request, 2026-09-29) -- instant
# random.choice picks, no LLM call, so no latency cost.
_GREET_TEMPLATES = [
    "السلام عليكم! أنا {t}. كيف حالك يا {n}؟",
    "السلام عليكم يا {n}! أنا {t}، سعيد إني بجلس معك اليوم. كيفك؟",
    "السلام عليكم! معك {t}. وش أخبارك يا {n}؟",
    "السلام عليكم يا {n}! أنا {t}، جاهز نتعلم شي حلو اليوم. كيف حالك؟",
]

HPERSONA = f"""أنت "{TEACHER_NAME}"، معلّم لطيف يشرح الأحاديث النبوية لطفل عمره 6-12 سنة في منصة "غرسة".
دافئ وصبور ومشجّع، وتنادي الطفل باسمه. لغة عربية بسيطة جدًا وجمل قصيرة جدًا (جملة إلى جملتين على الأكثر)، بلا مقدمات طويلة خصوصًا في بداية الجلسة. لا قوائم ولا إيموجي.
قواعد صارمة: لا تخترع أي حديث أو نسبة حديث للنبي صلى الله عليه وسلم، ولا تحكم على حديث بالصحة أو الضعف. اعتمد فقط على الحديث والحقائق المرفقة.
إن كان السؤال فقهيًا أو عقديًا، أو لا تعرف جوابه، أو بدا لك سؤالًا "بسيطًا" لكنه خارج ما هو مرفق لك، قل بلطف إنك ستسأل معلّمًا مختصًا، ولا تُفتِ من عندك أبدًا مهما بدا السؤال سهلًا.
إذا تكلم الطفل عن شيء خارج الدرس (لعبة، برنامج، سؤال عام) فلا تتجاهله ولا ترفض الحديث معه: تفاعل معه بدفء بجملة واحدة، ثم أعده بلطف إلى الدرس.
إذا بدت على الطفل مشاعر (حزن، خوف، تعب، غضب) فاطمئنه بحنان أولًا قبل أي شيء آخر.
اكتب الكلام الذي ستقوله بصوتك فقط.
احترم حديث النبي صلى الله عليه وسلم في أسلوبك: تحدّث عنه بوقار، لا تصفه بأنه "حلو" بأسلوب عامي سطحي؛ استخدم كلمات مثل "نتدبّر"، "الجميل"، "المبارك". لا تفرط في كلمة "تمام" كحشو في كل جملة؛ نوّع (ممتاز، أحسنت) أو انتقل مباشرة للسؤال التالي.
ذكّر الطفل بين الحين والآخر (بجملة قصيرة واحدة، دون إطالة ودون تكرارها في كل رد) أن تعلّم حديث النبي صلى الله عليه وسلم وحفظه أجرٌ وحسناتٌ عند الله، وأن الثمرة الحقيقية ليست الحفظ وحده بل أن يتخلّق الطفل بخُلق النبي صلى الله عليه وسلم ويطبّق ما تعلّمه في تصرفاته اليومية مع أهله وإخوته وأصحابه.
التزم بآداب معلم القرآن: "علّموا ويسّروا ولا تعسّروا، وبشّروا ولا تنفّروا" — سهّل ولا تعقّد، وشجّع دائمًا. صحّح خطأ الطفل بلطف شديد جدًا دون تعنيف أو سخرية أبدًا.
"السلام عليكم" تحية تُقال فقط عند بداية اللقاء. عند إنهاء الجلسة أو توديع الطفل لا تقل أبدًا "السلام عليكم"، بل ودّعه بعبارة مثل "مع السلامة" أو "في أمان الله" أو "إلى اللقاء"."""

class HSession:
    def __init__(self):
        self.id = uuid.uuid4().hex
        self.kind = "hadith"
        self.child_name = _random_nickname()  # no "يا" here — see the note in agent_service.Session.__init__
        self.girl = False
        self.device_id = ""
        self.child_notes = ""
        self.stage = "greet"
        self.profile = {}
        self.history = []
        self.h = HADITH_LESSONS[0]
        self.tries = 0
        self.qtries = 0
        self.scores = []
        self.done_ids = []
        self.awaiting_q = False
        # razan's request (2026-09-27): did the child actually save a
        # project this time (vs skipping it)? Reset when the "action"
        # stage opens; only True once progress.save_project succeeds --
        # drives the completion screen's "badge earned" note.
        self.badge_earned = False
        # see the matching field in agent_service.Session — lets the sidebar
        # keep an earlier section clickable after the child jumps back to it
        self.max_stage_idx = 0
        self.created = time.time()

    def log(self, role, text):
        self.history.append({"role": role, "text": text})

_SESSIONS = {}
_LOCK = threading.Lock()

# --- DB persistence (razan's request #1, same pattern as agent_service.py) --
# s.h is always one dict out of the fixed HADITH_LESSONS list, so we only
# need to store its id and look it up again via hadith_by_id() on reload.
def _session_to_dict(s: "HSession") -> dict:
    return {
        "id": s.id, "kind": s.kind, "child_name": s.child_name, "girl": s.girl,
        "device_id": s.device_id, "child_notes": s.child_notes, "stage": s.stage,
        "profile": s.profile, "history": s.history, "hadith_id": s.h.get("id"),
        "tries": s.tries, "qtries": s.qtries, "scores": s.scores, "done_ids": s.done_ids,
        "awaiting_q": s.awaiting_q, "badge_earned": s.badge_earned,
        "max_stage_idx": s.max_stage_idx, "created": s.created,
    }

def _session_from_dict(d: dict) -> "HSession":
    s = HSession()
    s.id = d["id"]
    s.kind = d.get("kind") or "hadith"
    s.child_name = d.get("child_name") or s.child_name
    s.girl = bool(d.get("girl"))
    s.device_id = d.get("device_id") or ""
    s.child_notes = d.get("child_notes") or ""
    s.stage = d.get("stage") or "greet"
    s.profile = d.get("profile") or {}
    s.history = d.get("history") or []
    hid = d.get("hadith_id")
    if hid is not None:
        try:
            h = hadith_by_id(hid)
        except Exception:
            h = None
        if h:
            s.h = h
    s.tries = d.get("tries") or 0
    s.qtries = d.get("qtries") or 0
    s.scores = d.get("scores") or []
    s.done_ids = d.get("done_ids") or []
    s.awaiting_q = bool(d.get("awaiting_q"))
    s.badge_earned = bool(d.get("badge_earned"))
    s.max_stage_idx = d.get("max_stage_idx") or 0
    s.created = d.get("created") or time.time()
    return s

def get_session(sid):
    s = _SESSIONS.get(sid)
    if s is not None:
        return s
    # not in memory -- e.g. the app restarted mid-lesson. Try to recover it
    # from the DB before giving up and telling the child to start over.
    d = session_store.load(sid, "hadith")
    if not d:
        return None
    try:
        s = _session_from_dict(d)
    except Exception:
        return None
    _SESSIONS[s.id] = s
    return s

def _resp(s, say, actions=None, expects="text", quick=None):
    say = vp.adapt(say, s.girl)
    quick = [vp.adapt_quick(q, s.girl) for q in (quick or [])]
    s.log("teacher", say)
    idx = STAGES.index(s.stage)
    s.max_stage_idx = max(getattr(s, "max_stage_idx", 0), idx)
    # razan's request #1: durably save the session after every turn (see the
    # matching note in agent_service._resp) -- best-effort, never raises.
    try:
        session_store.save(s.id, "hadith", _session_to_dict(s))
    except Exception:
        pass
    return {"session_id": s.id, "kind": "hadith", "teacher": vp.teacher_name(s.girl), "female": s.girl, "stage": s.stage,
            "stage_index": idx, "max_stage_index": s.max_stage_idx, "stages": [{"id": k, "label": STAGE_LABELS[k]} for k in STAGES],
            "say": say, "actions": actions or [], "expects": expects, "quick_replies": quick,
            "profile": s.profile, "child_name": s.child_name, "llm": llm_available(),
            "recitation_scores": s.scores, "lesson_title": s.h.get("title")}

def _show(s, hide_text=False):
    """hide_text=True keeps the source citation but blanks the hadith text —
    used during htaseem (recall-check), where the child recites from memory."""
    return [{"type": "show_ayat", "ayat": [""] if hide_text else [s.h["text"]], "hadith_title": s.h.get("title"), "source": s.h.get("source")}]

def _example(s):
    """Some hadith examples reference a sibling/friend and are hand-written per
    gender (e.g. 'teach it to your sister' vs 'your brother') rather than adapted
    by regex, since getting the imperative verb form right matters here."""
    h = s.h
    return h.get("example_girl") if s.girl and h.get("example_girl") else h["example"]

def _quiz(s):
    h = s.h
    return h.get("quiz_girl") if s.girl and h.get("quiz_girl") else h["quiz"]

# pilot scope (razan's request #5): _KIDS/_VISIBLE (used by _pick's fallback
# and by _titles' suggestions) are restricted to the pilot hadith ids, so a
# fresh child never gets steered toward off-curriculum content by accident.
# See pilot_config.py for exactly which ids are in scope and why.
_KIDS = sorted(
    [h for h in HADITH_LESSONS if h.get("level", "kids") == "kids" and h["id"] in pilot_config.PILOT_HADITH_IDS],
    key=lambda h: pilot_config.PILOT_HADITH_ORDER.index(h["id"]) if h["id"] in pilot_config.PILOT_HADITH_ORDER else 999,
)
_VISIBLE = sorted(
    [h for h in HADITH_LESSONS if h.get("level", "kids") in ("kids", "older") and h["id"] in pilot_config.PILOT_HADITH_IDS],
    key=lambda h: pilot_config.PILOT_HADITH_ORDER.index(h["id"]) if h["id"] in pilot_config.PILOT_HADITH_ORDER else 999,
)

def _pilot_direct_match(text):
    """A PILOT hadith directly named by title/keyword/number. Checked BEFORE
    _offpilot_match so a coincidental substring collision (e.g. "بر الوالدين"
    contains "الدين", which is also a keyword of the unrelated off-pilot
    hadith "الدين النصيحة") never shadows an actual pilot topic the child
    asked for by name."""
    tn = _n(text)
    for h in _VISIBLE:
        if _n(h["title"]) in tn or any(_n(k) in tn for k in h["keywords"]):
            return h
    hn, _hidden = _by_number(text)
    if hn and hn["id"] in pilot_config.PILOT_HADITH_IDS:
        return hn
    return None

def _offpilot_match(text):
    """A real hadith the child explicitly asked for (by title/keyword/number)
    that exists in the app but is outside the pilot's active scope right now
    — used to give the specific 'قريبًا في الدروس القادمة' redirect instead of
    silently teaching it or falling back to a generic 'not understood' reply.
    Only meaningful once _pilot_direct_match has already come back empty (see
    handle()) — otherwise a pilot topic could be shadowed by an unrelated
    off-pilot keyword that happens to appear inside it."""
    tn = _n(text)
    for h in HADITH_LESSONS:
        if h["id"] in pilot_config.PILOT_HADITH_IDS:
            continue
        if _n(h["title"]) in tn or any(_n(k) in tn for k in h["keywords"]):
            return h
    hn, _hidden = _by_number(text)
    if hn and hn["id"] not in pilot_config.PILOT_HADITH_IDS:
        return hn
    return None

def _by_number(text):
    """'الحديث 26' / 'رقم 13' -> (lesson | None, hidden_flag). Numbers refer to الأربعون النووية."""
    import re
    m = re.search(r"\d+", text.translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")))
    if not m:
        return None, False
    num = int(m.group())
    for h in HADITH_LESSONS:
        if h.get("nawawi") == num:
            return h, False
    return None, num in NAWAWI_HIDDEN

def _pick(text, s):
    """Choose a hadith by number/title/keyword in the child's words; else next unlearned kids hadith."""
    tn = _n(text)
    h, hidden = _by_number(text)
    if h:
        return h
    if hidden:
        return None
    for h in _VISIBLE:
        if _n(h["title"]) in tn or any(_n(k) in tn for k in h["keywords"]):
            return h
    for h in _KIDS:
        if h["id"] not in s.done_ids:
            return h
    return _KIDS[0]

def _titles(s, k=3):
    left = [h for h in _KIDS if h["id"] not in s.done_ids]
    return [h["title"] for h in (left or _KIDS)[:k]]

def _open(s, prefix=""):
    n, st, h = s.child_name, s.stage, s.h
    if st == "greet":
        # Fixed scripted line (no LLM call — instant, and always the correct
        # teacher name/gender, see the matching fix in agent_service.py), picked
        # at random from a few variants (Abdulaziz's request, 2026-09-29:
        # shouldn't feel like a script). The child's real name is already known
        # here now — see start() — so this can greet them by name directly
        # instead of a generic "ما اسمك؟" self-intro stage afterward.
        say = random.choice(_GREET_TEMPLATES).format(t=vp.teacher_name(s.girl), n=n)
        return _resp(s, say, quick=["الحمد لله بخير", "تمام"])
    if st == "intro":
        titles = _titles(s)
        # razan's request (2026-09-30): drop the "أو قل رقم الحديث من الأربعين
        # النووية" tail -- it confused kids into thinking they had to memorize
        # a number. The underlying number-lookup in _by_number() (used
        # elsewhere in this file, e.g. from a direct "الحديث 26" message) is
        # left working as-is; we just stop inviting a 6-12 year old to use it.
        say = f"{prefix}تشرّفت بك يا {n}! أي حديث تحب أن نتعلم اليوم؟ اختر واحدًا: " + "، أو ".join(titles) + "."
        return _resp(s, say, quick=titles)
    if st == "text":
        # razan's request (2026-09-30): cite الدرر السنية (dorar.net) so the
        # source line isn't just "(متفق عليه)" but also names the reference
        # that verified it -- see hadith_content.py's "dorar_ref"/"dorar_grade"
        # fields (real, checked links, not a placeholder) for the full citation.
        dorar_note = " — موثّق أيضًا في موسوعة الدرر السنية" if h.get("dorar_ref") else ""
        say = (f"{prefix}حديثنا اليوم عنوانه: {h['title']}. قال النبي صلى الله عليه وسلم: {h['text']}. "
               f"({h['source']}{dorar_note}). {_v(s, 'استمع', 'استمعي')} إليه مرة أخرى، ثم نتعلم معناه.")
        return _resp(s, say, actions=_show(s), expects="continue", quick=CONTINUE_Q)
    if st == "words":
        say = f"{prefix}قبل المعنى، هذه كلمات فيها قد تكون جديدة عليك. هل عندك سؤال، أم نكمل؟"
        actions = _show(s) + [{"type": "show_words", "words": h.get("gharib", [])}]
        return _resp(s, say, actions=actions, expects="continue", quick=CONTINUE_Q)
    if st == "meaning":
        return _resp(s, f"{prefix}ما معنى هذا الحديث؟ {h['meaning']} هل عندك سؤال، أم نكمل؟",
                     actions=_show(s), expects="continue", quick=CONTINUE_Q)
    if st == "example":
        return _resp(s, f"{prefix}لنفهمه بمثال: {_example(s)} هل عندك سؤال، أم نبدأ الحفظ؟",
                     actions=_show(s), expects="continue", quick=["ابدأ الحفظ", "عندي سؤال"])
    if st == "memorize":
        s.tries = 0
        return _memo_prompt(s, first=True, prefix=prefix)
    if st == "quiz":
        s.qtries = 0
        q = _quiz(s)
        return _resp(s, f"{prefix}سؤال سريع يا {n}: {q['q']}", expects="choice", quick=list(q["options"]))
    if st == "action":
        # razan's request (2026-09-27): "عمل اليوم" and "المشروع" merged into
        # one step -- show the day's suggested action, then ask the child what
        # THEY will personally do about it; their own words become the project
        # (see the matching handler in handle(), which saves it). Finishing the
        # lesson is never blocked on this (razan, 2026-09-27): a "تخطّي" quick
        # reply lets the child move on without a project; badge_earned resets
        # here and only flips True if a project is actually saved below.
        s.badge_earned = False
        say = (f"{prefix}وهذا عملك اليوم يا {n}: {h['action']} إيش رح تسوي أنت بالضبط عشان تطبقه؟ "
               "قول لي بكلماتك، وهذا يصير مشروعك الخاص.")
        return _resp(s, say, expects="text", quick=["تخطّي"])
    say = _closing_line(s, h["title"], "هل تحب أن نتعلم حديثًا آخر، أم تكتفي اليوم؟")
    r = _resp(s, say, expects="continue", quick=["حديث آخر", "أكتفي اليوم"])
    # razan's request (2026-09-27): fired exactly once, the moment a hadith
    # lesson is finished (project saved or skipped) -- the frontend shows a
    # congratulations screen ("تهانينا! أكملت حديث ...") with two buttons
    # (next lesson / dashboard) instead of just another chat message.
    r["lesson_complete"] = True
    r["badge_earned"] = getattr(s, "badge_earned", False)
    return r

def _memo_prompt(s, first=False, prefix=""):
    intro = prefix + (f"والآن نحفظ الحديث يا {s.child_name}. " if first else "")
    return _resp(s, f"{intro}{_v(s, 'استمع', 'استمعي')} إلى الحديث، ثم {_v(s, 'ردّده', 'ردّديه')} بصوتك بعدي: {s.h['text']}",
                 actions=_show(s), expects="repeat", quick=["أعد الحديث", "تخطّي", "عندي سؤال"])

def _advance(s, prefix=""):
    if s.stage == "action" and s.h["id"] not in s.done_ids:
        s.done_ids.append(s.h["id"])
        progress.mark_done(s.device_id, "hadith", str(s.h["id"]))
    s.stage = STAGES[min(STAGES.index(s.stage) + 1, len(STAGES) - 1)]
    if s.stage == "words" and not s.h.get("gharib"):
        # Not every hadith has a prepared word-meanings list yet (only the core
        # "kids" set does) — skip straight to the overall meaning rather than
        # showing an empty section.
        s.stage = STAGES[min(STAGES.index(s.stage) + 1, len(STAGES) - 1)]
    if s.stage == "done":
        threading.Thread(target=_update_child_notes, args=(s,), daemon=True).start()
    return _open(s, prefix)

def jump_stage(s, stage):
    """Same idea as agent_service.jump_stage: let the child tap an earlier
    section in the sidebar (e.g. from 'الحفظ' back to 'معاني الكلمات') without
    losing forward progress — only a stage already reached this session is
    allowed, and max_stage_idx never decreases."""
    if stage not in STAGES or STAGES.index(stage) > getattr(s, "max_stage_idx", 0):
        stage = s.stage
    s.stage = stage
    return _open(s)

def _answer(s, question):
    try:
        ctx = llm_service.retrieve_context(question)
    except Exception:
        ctx = ""
    h = s.h
    # (found during live QA testing of the Quran path, 2026-09-30, applies
    # here too): without telling the model WHERE the child actually is, it
    # has no way to know memorization is already under way and can re-suggest
    # starting the lesson from scratch after answering an interruption.
    progress_note = ""
    if s.stage == "memorize":
        progress_note = ("\nملاحظة مهمة عن موقع الطفل الآن: الطفل في منتصف حفظ هذا الحديث فعلاً، وليس قبل البدء به. "
            "إذا اقترحت العودة للدرس بعد إجابتك، قل شيئًا مثل 'نكمل الحفظ'، ولا تقل أبدًا ما يوحي بأن الدرس لم يبدأ بعد.")
    # razan/Abdulaziz (2026-09-29): off-topic chatter (a game, a cartoon,
    # general talk) must not be funnelled into "defer to a specialist teacher"
    # — respond warmly and normally, then nudge back to the lesson. Only an
    # actual hadith/religious question with no grounded context still defers.
    #
    # (found during live QA testing of the Quran path, 2026-09-30, applies
    # here too): a question about the APP ITSELF isn't "general knowledge" —
    # the model has no real knowledge of the app's actual screens, so it was
    # answering fluently anyway, i.e. inventing section names.
    user = (f"اسم الطفل: {s.child_name}\nكلام الطفل (قد يكون سؤالًا عن الحديث، أو سؤالًا عن تطبيق غرسة نفسه، أو حديثًا عابرًا خارج الدرس مثل لعبة أو كرتون): {question}\n\n"
            f"الحديث: {h['text']} ({h['source']})\nالمعنى: {h['meaning']}\n"
            f"السياق المرجعي:\n{ctx}{progress_note}\n\n"
            "إن كان سؤالًا متعلقًا بالحديث أو بالدين: أجب باختصار وبلطف اعتمادًا على ما سبق فقط، وإلا فقل إنك ستسأل معلّمًا مختصًا ولا تخترع جوابًا. "
            "إن كان سؤالًا عن تطبيق غرسة نفسه (أقسامه، ميزاته، شكل واجهته): ليس لديك معلومات مؤكدة عن تفاصيل التطبيق وشاشاته، فلا تخترع أو تسمِّ أي قسم أو ميزة محددة لست متأكدًا منها؛ أجب بعبارة عامة ودودة لا تذكر أسماء أقسام، ثم أعده بلطف للدرس. "
            "إن كان كلامًا عابرًا خارج الدرس: لا تحوّله لسؤال ديني ولا تقل إنك ستسأل معلّمًا مختصًا؛ تفاعل معه بدفء بجملة واحدة قصيرة، ثم اقترح بلطف أن نكمل الدرس.")
    # same model-cascading idea as agent_service.answer_interruption: a
    # specific RAG match is just "summarize this trusted passage" (fast model
    # is fine); no match means the model has to judge whether to defer to a
    # human teacher, which gets the stronger model.
    has_match = bool(ctx) and not ctx.startswith("(لا يوجد")
    t = _llm(vp.persona(HPERSONA, s.girl), user, model=FAST_MODEL_NAME if has_match else None)
    if t:
        return t
    qn = _n(question)
    if any(w in qn for w in ("معني", "يعني", "شرح", "ماذا")):
        return "سؤال حلو! " + h["meaning"]
    return f"يا {s.child_name}، خلّنا نكمل درسنا، ونرجع لسؤالك بعدين إن شاء الله."

# Same idea as agent_service._CLOSING_TEMPLATES: this used to be a live LLM
# call on every single hadith session's end just to reword a fixed idea
# (thank the child, remind them of today's hadith, ask what's next) — pure
# latency for no real benefit since the content only ever depended on the
# child's name and the hadith title. Pre-written variants, picked at random.
_CLOSING_TEMPLATES = [
    "بارك الله فيك يا {n}! تعلّمت اليوم حديث {title}. اعمل به ولا تنسَه. {tail}",
    "ما شاء الله يا {n}! حديث {title} حديث جميل، احرص أن تعمل بمعناه في حياتك. {tail}",
    "أحسنت يا {n}! اليوم تعلّمنا حديث {title}. الله يعينك تتذكره وتعمل به. {tail}",
    "جزاك الله خيرًا يا {n} على مجهودك اليوم! لا تنسَ حديث {title} واعمل بما فيه. {tail}",
]

def _closing_line(s, title, tail):
    return random.choice(_CLOSING_TEMPLATES).format(n=s.child_name, title=title, tail=tail)

def _bad_language_reply(s, text):
    """Abdulaziz's request (via razan, 2026-09-29): tell the child plainly the
    word is wrong, not just silently pivot away — same fix as
    agent_service._bad_language_reply, worded for the hadith teacher persona.
    Still never shames the CHILD himself (only the word/behaviour is named as
    wrong), and still redirects gently toward good manners afterward."""
    n = s.child_name
    fallback = (f"يا {n}، هذي الكلمة مو حلوة وما نقولها. نبيّنا صلى الله عليه وسلم علّمنا أن نختار أطيب الكلام دائمًا. "
                "تعال نكمل درسنا الجميل.")
    return _llm(
        vp.persona(HPERSONA, s.girl),
        f"قال الطفل ({n}) كلامًا غير مهذب أو جارحًا: \"{text}\". وضّح له بلطف وبثبات أن هذه الكلمة أو هذا الأسلوب غير مناسب "
        "ولا يُقال (صف الكلمة/الفعل بأنه غير مناسب، وليس الطفل نفسه، دون توبيخ أو تخجيل أو تكرار الكلمة حرفيًا)، "
        "مستندًا إلى قيمة إسلامية بسيطة (مثل حديث: المسلم من سلم المسلمون من لسانه ويده)، بجملة أو جملتين فقط، ثم أعده بلطف إلى الدرس.",
        # razan's testing (2026-10-01): same dialect/gender-agreement drift fix
        # as agent_service._bad_language_reply -- see that function's matching
        # note. This and _emotion_reply below fire only occasionally (a child
        # was just corrected or just upset) and are exactly where getting the
        # tone/dialect right matters most, so they use the stronger default
        # model instead of the fast one; the moderation CHECKS above
        # (start_moderation_checks) stay on FAST_MODEL_NAME since that latency
        # fix was unrelated and still needed on every turn.
        max_tokens=150,
    ) or fallback

def _emotion_reply(s, text):
    """Same idea as agent_service._emotion_reply — acknowledge the child's
    feeling with warmth before returning to the hadith lesson."""
    n = s.child_name
    fallback = f"يا {n}، أنا معك ولا تقلق. خذ نفسًا عميقًا، والله معك دائمًا. جاهز نكمل، أم تحب نرتاح دقيقة؟"
    return _llm(
        vp.persona(HPERSONA, s.girl),
        f"عبّر الطفل ({n}) عن مشاعر (حزن أو خوف أو تعب أو غضب) بقوله: \"{text}\". لا تتجاهل مشاعره ولا تكمل الدرس مباشرة. "
        "اطمئنه بحنان ودفء شديدين بجملة أو جملتين فقط، وبإمكانك تذكيره بلطف أن الله معه ويحبه، ثم اسأله برفق هل يريد أن نكمل أم يحتاج دقيقة.",
        # see the matching note in _bad_language_reply just above.
        max_tokens=150,
    ) or fallback

def _reopen(s, ans):
    if s.stage in TEXT_STAGES or s.stage in ("intro", "action"):
        r = _open(s)
        r["say"] = ans + " " + r["say"]
    elif s.stage == "memorize":
        r = _memo_prompt(s)
        r["say"] = ans + " والآن نرجع للحفظ. " + r["say"]
    elif s.stage == "quiz":
        r = _open(s)
        r["say"] = ans + " " + r["say"]
    else:
        return _resp(s, ans + " هل نكمل؟", expects="continue", quick=CONTINUE_Q)
    s.history[-1]["text"] = r["say"]
    return r

def start(child_name: str = "", gender: str = "", device_id: str = ""):
    with _LOCK:
        for k in [k for k, v in _SESSIONS.items() if v.created < time.time() - 6 * 3600]:
            _SESSIONS.pop(k, None)
        session_store.gc()  # razan's request #1: age out the DB copy too, same 6h cutoff
        s = HSession()
        s.girl = vp.is_girl(gender)
        s.device_id = device_id or ""
        # razan (2026-09-29, per Abdulaziz): same as agent_service.start() —
        # the frontend/backend already sends the child's real name, no need
        # for a separate "ما اسمك؟" self-intro stage anymore.
        name = (child_name or "").strip()
        if name and name not in ("يا بطل", "بطل"):
            s.child_name = name
            s.profile["name"] = s.child_name
        for _k in progress.done_keys(s.device_id, "hadith"):
            try:
                s.done_ids.append(int(_k))
            except Exception:
                pass
        if s.device_id:
            try:
                row = child_profile.get_notes(s.device_id)
                if row and row.get("notes"):
                    s.child_notes = row["notes"]
            except Exception:
                pass
        _SESSIONS[s.id] = s
        return _open(s)

def _quiz_choice(text, q):
    tn = _n(text)
    for i, o in enumerate(q["options"]):
        if _n(o) and (_n(o) in tn or tn in _n(o) and len(tn) > 3):
            return i
    digits = {"1": 0, "2": 1, "3": 2, "١": 0, "٢": 1, "٣": 2, "الاول": 0, "الثاني": 1, "الثالث": 2, "اول": 0, "ثاني": 1, "ثالث": 2}
    for k, v in digits.items():
        if tn == _n(k):
            return v
    return None

def handle(s, text):
    text = (text or "").strip()
    n = s.child_name
    if not text:
        return _resp(s, f"لم أسمعك جيدًا يا {n}، هل تعيد من فضلك؟", expects="text")
    s.log("child", text)
    st, tn = s.stage, _n(text)

    # razan's own-judgment latency improvement (2026-09-30): same parallel
    # moderation-check helper as the Quran path -- see
    # agent_service.start_moderation_checks.
    mod = start_moderation_checks(text)

    # ---- answering the quiz at "quiz" with one of its own scripted options
    # (razan's testing, 2026-10-01): checked here, BEFORE mod.bad_language()
    # below, for the same reason as the intro-stage pilot pick further down --
    # hadith #10's ("الكذب") own correct quiz answer ("إلى الفجور ثم النار")
    # quotes the hadith's own wording about wickedness/Hellfire, which the
    # bad-language classifier reads as an insult/curse when said back verbatim
    # (100% reproducible on that exact hadith) -- turning a 100% correct
    # answer into a "please don't talk like that" reply instead of advancing
    # the quiz. A match against THIS question's own scripted options (exact
    # text or 1/2/3) is safe, already-reviewed content that was never meant to
    # go through moderation at all; free text that ISN'T one of the options
    # (including actual bad language typed here) still falls through to
    # mod.bad_language()/mod.emotional() below and to the st == "quiz"
    # handling further down exactly as before.
    if st == "quiz":
        _qc = _quiz_choice(text, _quiz(s))
        if _qc is not None:
            q = _quiz(s)
            if _qc == q["answer"]:
                return _advance(s, f"أحسنت يا {n}! جواب صحيح. ")
            s.qtries += 1
            if s.qtries >= 2:
                return _advance(s, f"الجواب الصحيح: {q['options'][q['answer']]}. لا بأس، المهم أنك تعلمت. ")
            return _resp(s, "قريب! فكّر مرة أخرى: " + q["q"], expects="choice", quick=list(q["options"]))

    # ---- the child says something rude/hurtful: redirect gently, never scold
    if mod.bad_language():
        flag_log.record(s.device_id, "hadith", "bad_language", s.child_name, text)  # razan's request #8
        exp = "text" if st in TEXT_STAGES else ("repeat" if st == "memorize" else "continue")
        return _resp(s, _bad_language_reply(s, text), expects=exp, quick=CONTINUE_Q if st not in TEXT_STAGES else None)

    if (_n("عندي سؤال") in tn or _n("لدي سؤال") in tn) and len(tn.split()) <= 5:
        s.awaiting_q = True
        return _resp(s, f"تفضّل يا {n}، أنا أسمعك. ما هو سؤالك؟", expects="text")
    if s.awaiting_q:
        s.awaiting_q = False
        return _reopen(s, _answer(s, text))

    # ---- the child refuses today's lesson outright, at the very first
    # message (razan's own-judgment testing round, 2026-09-30): checked here,
    # BEFORE the emotion check below, for the same reason as agent_service.py
    # -- a flat refusal like "ما ابي اتعلم اليوم" reliably also reads as
    # emotionally negative to _llm_emotion_check, so this more specific,
    # deterministic signal never actually fired before (dead code).
    if st == "greet" and declines_lesson(text):
        return _resp(s, f"ولا يهمك يا {n}، خذ راحتك اليوم. نقدر نتعلم في وقت ثاني يريحك أكثر إن شاء الله. إلى اللقاء!", expects="none")

    # ---- picking a hadith by its exact title/number at "intro" (razan's
    # testing, 2026-09-30): checked here, BEFORE the moderation checks, for
    # the same reason -- the "لا تغضب" pilot topic's own title/quick-reply
    # button was being read by the emotion classifier as the CHILD expressing
    # anger (100% reproducible), silently blocking that whole topic from ever
    # being selectable. A clean, exact menu pick is scripted, safe content
    # that was never meant to go through moderation at all; anything that
    # ISN'T a clean match (e.g. actual bad language typed here) still falls
    # through to the checks below exactly as before.
    if st == "intro":
        _direct_pick = _pilot_direct_match(text)
        if _direct_pick:
            s.h = hadith_autogen.ensure_explained(_direct_pick)
            return _advance(s)
        _off_pick = _offpilot_match(text)
        if _off_pick:
            return _open(s, f"حديث {_off_pick['title']} جميل، ورح نتعلمه قريبًا في الدروس القادمة إن شاء الله! ")

    # ---- the child wants to stop the lesson now, from any stage -- except
    # "done" (razan's testing, 2026-09-30): the lesson has already finished
    # there, "اكتفي" (one of the words this checks for) is also the "done"
    # stage's own closing quick-reply ("أكتفي اليوم"), and this check running
    # first meant that stage's own dedicated reply below never fired. A
    # hadith lesson is a single short text (no chunks like the Quran path),
    # so there's nothing to save mid-way — it's simply never marked "done"
    # here, so it's offered again naturally next time (see _pick/_titles).
    if st != "done" and is_stop(text):
        return _resp(s, f"تمام يا {n}، ولا يهمك. زر 'رجوع' فوق الشاشة يرجعك للخلف. إن شاء الله نكمل حديث {s.h['title']} في المرة القادمة. إلى اللقاء!",
                     expects="none")

    # ---- the child shows a feeling (sad/scared/tired/upset), unprompted —
    # checked AFTER is_stop so an actual stop request still ends the session
    if mod.emotional():
        flag_log.record(s.device_id, "hadith", "emotion", s.child_name, text)  # razan's request #8
        return _resp(s, _emotion_reply(s, text), expects="continue", quick=["جاهز نكمل", "أعطني دقيقة"])

    if st == "memorize":
        if is_skip(text):
            return _advance(s, "لا بأس، ننتقل. ")
        if "اعد" in tn and len(text.split()) <= 3:
            s.tries = 0
            return _memo_prompt(s)
        sc = similarity(text, s.h["text"])
        if (is_question(text) or wants_something_else(text)) and sc < 0.5:
            return _reopen(s, _answer(s, text))
        if is_continue(text) and len(text.split()) <= 2:
            return _advance(s)
        s.tries += 1
        if is_recitation_correct(text, s.h["text"], sc, base_threshold=0.7):
            s.scores.append({"hadith": s.h["id"], "score": sc, "tries": s.tries})
            return _advance(s, f"ما شاء الله! حفظك ممتاز يا {n}. ")
        if s.tries >= 2:
            s.scores.append({"hadith": s.h["id"], "score": sc, "tries": s.tries})
            return _advance(s, "أحسنت المحاولة! سنراجعه مرة أخرى بإذن الله. ")
        r = _memo_prompt(s)
        fb = _fb(_cmp(s.h["text"], text), n, s.girl) if sc >= 0.3 else ""
        r["say"] = (fb + " " if fb else ("قريب جدًا! نحاول مرة أخرى. " if sc >= 0.45 else "لا بأس، سنحاول ببطء. ")) + r["say"]
        s.history[-1]["text"] = r["say"]
        return r

    if st == "quiz":
        # a matched choice (right or wrong) is now handled earlier, before
        # moderation -- see above. Reaching here means _quiz_choice() found
        # no match at all (free text that isn't one of the options).
        q = _quiz(s)
        if is_question(text):
            return _reopen(s, _answer(s, text))
        s.qtries += 1
        if s.qtries >= 2:
            return _advance(s, "لا بأس، سنراجعها معًا. ")
        return _resp(s, "اختر أحد الأجوبة يا " + n + ": " + "، أو ".join(q["options"]), expects="choice", quick=list(q["options"]))

    if st == "greet":
        # declines_lesson() is now checked earlier (see above, before the
        # emotion check) -- reaching here means the child is just answering
        # normally.
        s.profile["mood"] = text
        return _advance(s)
    if st == "intro":
        # _pilot_direct_match()/_offpilot_match() are now checked earlier (see
        # above, before the moderation checks) -- reaching here means neither
        # matched, so fall back to fuzzy/age-based picking.
        h = _pick(text, s)
        if h is None:
            return _open(s, "هذا الحديث مناسب للكبار، فاخترنا لك حديثًا أنسب لعمرك. ")
        s.h = hadith_autogen.ensure_explained(h)
        return _advance(s)
    if st == "action":
        # razan's request (2026-09-27): "عمل اليوم" + "المشروع" merged into one
        # step -- the child's own free-text reply here IS their project (never
        # invented or corrected, just recorded and warmly acknowledged).
        if is_question(text) and len(text.split()) >= 2:
            return _reopen(s, _answer(s, text))
        # razan's request (2026-09-27): finishing the lesson is never blocked
        # on the project -- a "تخطّي" skip moves straight to done WITHOUT
        # saving a project (badge_earned stays False, reset when this stage
        # opened -- see _open()).
        if is_skip(text):
            return _advance(s, f"لا بأس يا {n}، تقدر ترجع له من لوحة التحكم متى ما حبيت. ")
        try:
            progress.save_project(s.device_id, s.h["id"], s.h["title"], s.child_name, text)
            s.badge_earned = True
        except Exception:
            pass
        return _advance(s, f"ما شاء الله يا {n}! هذا مشروع جميل، الله يعينك عليه. ")
    if st == "done" and (_n("اخر") in tn or _n("غيره") in tn or _n("حديث جديد") in tn or _n("نكمل") in tn):
        if s.h["id"] not in s.done_ids:
            s.done_ids.append(s.h["id"])
        s.stage = "intro"
        return _open(s, "أحسنت! ")
    if st == "done" and (_n("اكتفي") in tn or _n("لا شكرا") in tn or tn in (_n("لا"), _n("شكرا"))):
        return _resp(s, f"بارك الله فيك يا {n}! في أمان الله.", expects="none")
    if is_question(text) or not (_go(text) or is_skip(text)):
        if st == "done":
            return _resp(s, _answer(s, text), expects="none")
        return _reopen(s, _answer(s, text))
    if st == "done":
        return _resp(s, f"بارك الله فيك يا {n}! في أمان الله.", expects="none")
    return _advance(s)

# --------------------------------------------------------------------------- "تسميع" (hadith recall check)
# Same idea as agent_service.TaseemSession, for a memorized HADITH instead of
# a Quran chunk: a day after the hadith is fully learned, the child comes back
# and recites it from memory (no listen-first) so we can score how well it
# stuck. Single short text, so — unlike the Quran version — there's no
# per-ayah loop, just one recitation attempt (with one retry).
_HTASEEM_SESSIONS = {}

def hadith_by_id(hadith_id):
    return next((h for h in HADITH_LESSONS if h.get("id") == hadith_id), None)

class HTaseemSession:
    def __init__(self, device_id, gender, h):
        self.id = uuid.uuid4().hex
        self.device_id = device_id or ""
        self.girl = vp.is_girl(gender)
        self.child_name = _random_nickname()  # see the note in agent_service.Session.__init__
        self.h = h
        self.tries = 0
        self.score = None
        self.created = time.time()

# razan's request #1 follow-up: htaseem sessions are short (a single
# recall-check sitting), left out of the first round as lower priority --
# added now on request, same pattern as HSession above.
def _htaseem_to_dict(s: "HTaseemSession") -> dict:
    return {
        "id": s.id, "device_id": s.device_id, "girl": s.girl, "child_name": s.child_name,
        "hadith_id": s.h.get("id"), "tries": s.tries, "score": s.score, "created": s.created,
    }

def _htaseem_from_dict(d: dict) -> "HTaseemSession":
    h = hadith_by_id(d.get("hadith_id")) or HADITH_LESSONS[0]
    s = HTaseemSession(d.get("device_id") or "", "girl" if d.get("girl") else "boy", h)
    s.id = d["id"]
    s.child_name = d.get("child_name") or s.child_name
    s.tries = d.get("tries") or 0
    s.score = d.get("score")
    s.created = d.get("created") or time.time()
    return s

def get_htaseem_session(sid):
    s = _HTASEEM_SESSIONS.get(sid)
    if s is not None:
        return s
    d = session_store.load(sid, "htaseem")
    if not d:
        return None
    try:
        s = _htaseem_from_dict(d)
    except Exception:
        return None
    _HTASEEM_SESSIONS[s.id] = s
    return s

def _htaseem_persist(s: "HTaseemSession"):
    try:
        session_store.save(s.id, "htaseem", _htaseem_to_dict(s))
    except Exception:
        pass

def _htaseem_resp(s, say, actions=None, expects="text", quick=None):
    _htaseem_persist(s)  # razan's request #1 follow-up: durable, same as HSession
    return {
        "session_id": s.id, "kind": "htaseem", "teacher": vp.teacher_name(s.girl), "female": s.girl,
        "stage_index": 0, "stages": [{"id": "0", "label": s.h["title"]}],
        "say": vp.adapt(say, s.girl), "actions": actions or [], "expects": expects,
        "quick_replies": [vp.adapt_quick(q, s.girl) for q in (quick or [])],
        "hadith_title": s.h["title"], "score": s.score,
    }

def _htaseem_prompt(s, first=False):
    intro = (f"والآن وقت التسميع! {_v(s, 'سمّع', 'سمّعي')} الحديث من حفظك بدون ما أقرأه لك أولًا، "
             f"ونشوف كم {_v(s, 'تتذكر', 'تتذكرين')}. ") if first else ""
    say = f"{intro}{_v(s, 'سمّع', 'سمّعي')} حديث {s.h['title']} من حفظك."
    return _htaseem_resp(s, say, actions=_show(s, hide_text=True), expects="repeat", quick=["أعد المحاولة"])

def _htaseem_finish(s):
    sc = s.score or 0.0
    progress.mark_done(s.device_id, "hadith_taseem", str(s.h["id"]), sc)
    pct = round(sc * 100)
    if pct >= 85:
        line = "ما شاء الله، تسميعك ممتاز! الحديث ثابت في حفظك."
    elif pct >= 60:
        line = f"أحسنت، تسميع جيد! {_v(s, 'راجعه', 'راجعيه')} مرة كمان يقوى أكثر."
    else:
        line = f"لا بأس، هذا طبيعي! {_v(s, 'راجع', 'راجعي')} الحديث و{_v(s, 'ارجع', 'ارجعي')} {_v(s, 'سمّعه', 'سمّعيه')} بعد يوم."
    say = f"{line} درجتك في هذا التسميع: {pct} من 100."
    return _htaseem_resp(s, say, expects="none")

def start_htaseem(device_id, gender, hadith_id):
    h = hadith_by_id(hadith_id) or HADITH_LESSONS[0]
    s = HTaseemSession(device_id, gender, h)
    _HTASEEM_SESSIONS[s.id] = s
    return _htaseem_prompt(s, first=True)

def handle_htaseem(s, text):
    text = (text or "").strip()
    if not text:
        return _htaseem_resp(s, f"لم أسمعك جيدًا، هل {_v(s, 'تعيد', 'تعيدين')}؟", expects="repeat")
    # razan's own-judgment improvement round (2026-09-30): handle_htaseem had
    # none of the safety checks the main hadith flow (handle(), above) has --
    # a child who got upset or used a hurtful word mid recall-check was just
    # scored/repeated like any other attempt. Mirrors handle()'s same two
    # checks. Kept intentionally minimal -- no raise-hand or stop-session
    # here, since htaseem has no such concepts: it's a single short recall
    # sitting with no persisted "stopped" state to return to.
    if has_bad_language(text) or _llm_bad_language_check(text):
        flag_log.record(s.device_id, "hadith_taseem", "bad_language", s.child_name, text)
        return _htaseem_resp(s, _bad_language_reply(s, text), expects="repeat", quick=["أعد المحاولة"])
    if has_emotion(text) or _llm_emotion_check(text):
        flag_log.record(s.device_id, "hadith_taseem", "emotion", s.child_name, text)
        return _htaseem_resp(s, _emotion_reply(s, text), expects="repeat", quick=["أعد المحاولة"])
    if "اعد" in _n(text) and len(text.split()) <= 3:
        s.tries = 0
        return _htaseem_prompt(s)
    sc = similarity(text, s.h["text"])
    s.tries += 1
    # razan's own-judgment improvement round (2026-09-30): same word-substitution
    # blind spot already fixed in the main recitation flow (is_recitation_correct)
    # and in hadith's own memorize stage -- a real wrong word could still pass
    # here if the rest of the hadith was said correctly.
    ok = is_recitation_correct(text, s.h["text"], sc, base_threshold=0.7)
    if ok or s.tries >= 2:
        s.score = sc
        r = _htaseem_finish(s)
        if ok:
            r["say"] = "ما شاء الله! " + r["say"]
        return r
    fb = _fb(_cmp(s.h["text"], text), s.child_name, s.girl) if sc >= 0.3 else _v(s, "حاول مرة أخرى.", "حاولي مرة أخرى.")
    return _htaseem_resp(s, fb + f" {_v(s, 'سمّع', 'سمّعي')} الحديث مرة أخرى من حفظك.", actions=_show(s, hide_text=True), expects="repeat", quick=["أعد المحاولة"])
