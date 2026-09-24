# الضوابط · Guardrails (non-negotiable)

Reliability of religious content is the **top judging criterion**. Any violation here is a release blocker.

## ١. النص الشرعي · Religious text
1. The AI **never generates, completes, paraphrases, translates or "corrects"** Quran or hadith text — not in speech, not on screen, not in logs used as content.
2. **Quran** comes only from the verified Tanzil asset in the app, referenced by `surah:ayah`. Audio comes only from the approved reciter recordings. **Never TTS an ayah.**
3. **Hadith** comes only from a vetted source with takhrij and grading, approved by a sharia reviewer. Until then the app shows the placeholder «[نص حديث برّ الوالدين — يُعتمد لاحقًا من مصدر موثّق مع التخريج]». The teacher must not recite or summarize a hadith that isn't in the approved set.
4. **Surah facts** (مكية/مدنية، عدد الآيات، سبب النزول) come only from a verified dataset with its source. Where scholars differ (e.g. whether a surah is Makki or Madani), don't state one opinion as fact — omit it or state it as reviewed.
5. The teacher does **not issue fatwas** or answer religious questions freely. If the child asks something outside the script → a kind line like «سؤال جميل! اسأل بابا أو ماما أو معلّمك» and continue.
6. Teacher lines (praise, instructions, counting) are **pre-approved templates** with slots (child name, count, ayah number). New lines go through review before shipping.

## ٢. التقييم · No judging the child
7. **Presence only.** The teacher never says a recitation was right or wrong, never scores it, never shows a grade. The only condition to advance is that the child repeated 3 times.
8. Tone: warm, encouraging, never shaming, never comparing the child to others.

## ٣. خصوصية الطفل · Child privacy (Google Play "Designed for Families")
9. The child gives **no personal data** (enters only a pairing code). The child's first name comes from the parent's profile.
10. **Prefer on-device processing** for all live audio (presence detection, short answers). Live mic audio is **not stored** and **not sent** to third parties.
11. The only stored audio is the child's **project report** (frame 22), saved to Firebase Storage for the parent, with a retention/deletion policy.
12. Any third-party AI service must be declared in Play Data Safety and must not train on children's data. Get approval before adding one.
13. No analytics identifiers or ads in the child experience.

## ٤. الأمان · Safety
14. No open-ended chat, no web access, no free-form generation shown to the child.
15. If the child says something concerning, the teacher does not engage with it — continue the lesson kindly; (escalation to the parent is a product decision, TBD).
