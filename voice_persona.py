"""Teacher persona by the child's gender: boy -> المعلم عبدالله, girl -> المعلمة سارة.
All scripted lines are written for the male teacher; for a girl we adapt the wording
(teacher name, feminine self-references, feminine address). Religious content is untouched."""
import re

MALE_NAME = "المعلم عبدالله"
FEMALE_NAME = "المعلمة سارة"

_ADJ = r"(?:جاهز|مستعد|سعيد|فخور|مسرور|متحمس)"

# Session's fallback address before a real name is known (razan's follow-up,
# 2026-09-29: she noticed it's always "يا بطل"/"يا بطلة" and asked for some
# variety instead of always the same word). Defined here, not in
# agent_service.py, because this is also the one module that knows how to
# feminize a scripted word for a girl (see adapt() below) -- every word
# added here must follow the plain "+ة" pattern _NICK assumes below, or get
# its own explicit regex case the way "أحسنت" does.
NICKNAMES = ["بطل", "نجم", "شاطر", "فنان"]
_NICK = "(?:" + "|".join(NICKNAMES) + ")"

def is_girl(gender) -> bool:
    return str(gender or "").strip().lower() in ("girl", "female", "f", "بنت", "أنثى", "انثى")

def teacher_name(girl: bool) -> str:
    return FEMALE_NAME if girl else MALE_NAME

def adapt(text: str, girl: bool, protect=()) -> str:
    """protect: exact strings (Quran/hadith/tafsir text) that must never be altered."""
    if not text:
        return text
    keep = {}
    t = text
    for i, p in enumerate(sorted({x for x in protect if x and len(x) > 3}, key=len, reverse=True)):
        if p in t:
            k = f"⁣{i}⁣"
            keep[k] = p
            t = t.replace(p, k)
    # razan's testing (2026-10-01): "دي" (Egyptian Arabic for "this") kept
    # surfacing in LLM-generated replies despite _DIALECT_BOY/_DIALECT_GIRL
    # below already explicitly forbidding Egyptian dialect by name -- ordinary
    # instruction-adherence drift under the model, same class of issue as the
    # fixups below. Applied here, before the girl-only branch (and before the
    # function used to return early for a boy), so it covers BOTH teachers --
    # razan asked for the word removed تمامًا, not just from one of them. "دي"
    # only exists in Arabic as this Egyptian demonstrative (never a
    # prefix/suffix of an unrelated word), so a bare word-boundary replace is
    # safe everywhere; it runs after the protect-swap above, so it can never
    # touch the Quran/hadith/tafsir text itself.
    t = re.sub(r"(?<!\w)دي(?!\w)", "هذي", t)
    if not girl:
        for k, v in keep.items():
            t = t.replace(k, v)
        return t
    t = t.replace(MALE_NAME, FEMALE_NAME)
    t = t.replace("أنا المعلم ", "أنا المعلمة ")
    t = re.sub(r"يا (" + _NICK + r")(?![ةهـ\w])", lambda m: f"يا {m.group(1)}ة", t)
    t = re.sub(r"يا صديقي(?![ةهـ\w])", "يا صديقتي", t)
    # "أحسنت" is a fixed congratulatory word (never ambiguous with a 1st/3rd-person
    # verb the way "كنت"/"تقدر"/"تكون" can be — see agent_service._v), so it's safe
    # to fix everywhere here rather than at each call site. Without the kasra the
    # TTS voice defaults to reading it as masculine (razan: "ركز في نطق الحركات
    # خصوصا اخر الحركات" — the final vowel is exactly what carries the gender here).
    t = re.sub(r"أحسنت(?![ِ\w])", "أحسنتِ", t)
    # only fixed scripted phrases (never generic words, so Quran/hadith/tafsir text is not touched)
    t = re.sub(r"(أنا|أنت|هل أنت|هل انت|وأنا)\s+(" + _ADJ + r")(?![ةهـ\w])", lambda m: m.group(1) + " " + m.group(2) + "ة", t)
    t = re.sub(r"(?<![\w])(" + _ADJ + r")(\s+جدًا|\s+جدا|\s*؟)", lambda m: m.group(1) + "ة" + m.group(2), t)
    for k, v in keep.items():
        t = t.replace(k, v)
    return t

def adapt_quick(q: str, girl: bool) -> str:
    """Quick-reply buttons: short exact strings."""
    if girl and re.fullmatch(_ADJ, (q or "").strip()):
        return q.strip() + "ة"
    return adapt(q, girl)

_DIALECT_BOY = ("\nاللهجة: تحدث فقط باللهجة السعودية (النجدية الواضحة السهلة على الأطفال)، ولا تستخدم الفصحى الثقيلة ولا أي لهجة عربية أخرى (لا شامية ولا مصرية). "
    "استخدم كلمات مثل: أبغى/أبي بدل أريد، وش بدل ماذا، كذا بدل هكذا، الحين بدل الآن، زين بدل جيد، ليه بدل لماذا، وايد/كثير بدل جدًا، تبي بدل تريد، خلاص/تمام، يا بطل. "
    "حافظ على وقار الحديث عن القرآن والحديث الشريف رغم اللهجة، ولا تُدخل اللهجة على النص القرآني أو الحديث نفسه (يبقيان كما هما دائمًا)، هي فقط في كلامك أنت مع الطفل.")
_DIALECT_GIRL = ("\nاللهجة: تحدثي فقط باللهجة السعودية (النجدية الواضحة السهلة على الأطفال)، ولا تستخدمي الفصحى الثقيلة ولا أي لهجة عربية أخرى (لا شامية ولا مصرية). "
    "استخدمي كلمات مثل: أبغى/أبي بدل أريد، وش بدل ماذا، كذا بدل هكذا، الحين بدل الآن، زين بدل جيد، ليه بدل لماذا، وايد/كثير بدل جدًا، تبين بدل تريدين، خلاص/تمام، يا بطلة. "
    "حافظي على وقار الحديث عن القرآن والحديث الشريف رغم اللهجة، ولا تُدخلي اللهجة على النص القرآني أو الحديث نفسه (يبقيان كما هما دائمًا)، هي فقط في كلامك أنتِ مع الطفلة.")

def persona(base: str, girl: bool) -> str:
    """LLM system prompt for the chosen teacher, including a strict per-gender
    dialect. Updated 2026-09-26 (razan): both the male and female teacher now
    speak the SAME Saudi/Najdi dialect (only the grammar differs: masculine vs
    feminine forms) — girls used to hear Shami while boys heard Saudi, but
    razan asked to unify them so both teachers sound consistent with each
    other. Still never mixed with another dialect, never plain fusha, so the
    TTS voice reads natural, consistent speech."""
    if not girl:
        return base + _DIALECT_BOY
    p = base.replace(MALE_NAME, FEMALE_NAME).replace("معلّم قرآن رجل", "معلّمة قرآن امرأة").replace("معلّم لطيف", "معلّمة لطيفة")
    return p + "\nأنتِ امرأة والطفلة بنت: تحدثي بصيغة المؤنث عن نفسك (سعيدة، معلّمتك) وخاطبي الطفلة بصيغة المؤنث (يا بطلة، أنتِ)." + _DIALECT_GIRL
