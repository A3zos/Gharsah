# غَرْسة — Design reference for Flutter

This folder is the approved UI design, exported from the design canvas. It is the visual source of truth.

## How to use (for Claude Code)

- `screens/NN-Name.png` — what each screen must look like (390px wide phone frame, rendered @2x). **Open the PNG before building a screen.**
- `html/NN-Name.html` — the exact source of that screen: every color, font size, radius, spacing, shadow and Arabic string. Read it for precise values; do not guess from the PNG.
  The HTML is a design mockup (React-based component format), NOT code to port. Rebuild it as idiomatic Flutter widgets using `lib/theme/app_theme.dart` tokens.
- `DESIGN_NOTES.md` — the designer's behavior notes (lesson flow, mic behavior, dashboard accordion, growth stages). These are requirements.
- Demo data in the mockups (names like عبدالله/سارة, numbers, code ٤٧٢٩١٨) is placeholder — real data comes from Firestore.
- Hadith text in the mockups is a placeholder; never ship it as real hadith (see CLAUDE.md guardrails).

## Screen map

| # | File | Screen | Frame height |
|---|---|---|---|
| 01 | `01-Main` | ١ · شاشة البداية — الآية | 844px |
| 02 | `02-Auth` | ٢ · الترحيب — مسارا الدخول | 844px |
| 03 | `03-Login` | ٣ · تسجيل دخول — تبويبان | 844px |
| 04 | `04-Signup` | ٤ · إنشاء حساب | 844px |
| 05 | `05-Packages` | ٥ · تبويب الباقات (تمرير) | 1400px |
| 06 | `06-PlayConfirm` | ٦ · تأكيد الاشتراك — Google Play | 844px |
| 07 | `07-AddChild` | ٨ · إضافة ابن — البيانات | 844px |
| 08 | `08-Schedule` | ٩ · جدول التعلّم | 920px |
| 09 | `09-ScheduleCustom` | ١٠ · الجدول — وقت مخصّص لكل يوم | 1240px |
| 10 | `10-AvatarPicker` | ١١ · اختيار الشخصية | 844px |
| 11 | `11-PairingCode` | ١٢ · رمز الربط | 844px |
| 12 | `12-Dashboard` | ١٣ · لوحة التحكم — صفحة عبدالله | 1090px |
| 13 | `13-DashProjects` | ١٤ · المشاريع (بطاقة مفتوحة) — التسجيلات | 1850px |
| 14 | `14-DashSurahs` | ١٥ · السور (بطاقة مفتوحة) | 1630px |
| 15 | `15-DashHadith` | ١٦ · الأحاديث (بطاقة مفتوحة) | 1380px |
| 16 | `16-DashAyat` | ١٧ · الآيات (بطاقة مفتوحة) | 1340px |
| 17 | `17-StudentHome` | ١٨ · رئيسية الطفل (تمرير) | 1200px |
| 18 | `18-L1Intro` | ١٩ · المكالمة — الآيات باستماع متواصل | 880px |
| 19 | `19-L6SurahDone` | ٢٠ · أتممت السورة — لحظة حيّة | 880px |
| 20 | `20-L7Hadith` | ٢١ · الحديث (استماع متواصل) | 880px |
| 21 | `21-L8Project` | ٢٢ · تكليف المشروع صوتيًا (٥ حالات) | 880px |
| 22 | `22-L9Record` | ٢٣ · حصة الغد — تقرير المشروع صوتيًا (٥ حالات) | 880px |
| 23 | `23-L10Done` | ٢٤ · أكملت حصة اليوم — لحظة حيّة | 920px |

Frames taller than 844px are scrolling screens (the full scroll content is shown).
Frames 13–17 are one screen (Dashboard) with a different accordion card open in each.
Frames 09–10 are one screen (Schedule) with «تخصيص وقت لكل يوم» collapsed / expanded.
