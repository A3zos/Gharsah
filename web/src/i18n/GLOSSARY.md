# غَرْسة — translation glossary (ar → en / id)

Use these words everywhere, in every locale file. Arabic is the source of truth. The tone is warm,
simple and friendly for children and parents, not formal. Translate the meaning, not word for word,
and never add a claim the Arabic doesn't make.

**Never translated by us or by any AI:** Quran text and hadith text. They stay Arabic (Uthmani,
right-to-left) in every language. Translations of ayat come only from QuranEnc (en: Saheeh
International; id: the Ministry of Religious Affairs translation). Translations of hadith come only
from HadeethEnc. They are fetched by script, verbatim, with the source shown.

## Product owner's glossary (2026-10-03)

| Arabic                        | English                                     | Indonesian                                                     |
| ----------------------------- | ------------------------------------------- | -------------------------------------------------------------- |
| غَرْسة                        | Gharsah                                     | Gharsah                                                        |
| وليّ الأمر                    | Parent                                      | Orang tua                                                      |
| الطفل / الابن                 | Child                                       | Anak                                                           |
| يا بطل                        | champ                                       | jagoan                                                         |
| المعلم عبدالله / المعلمة سارة | Teacher Abdullah / Teacher Sarah            | Ustaz Abdullah / Ustazah Sarah                                 |
| حصة / درس                     | Lesson                                      | Pelajaran                                                      |
| سورة / آية / آيات             | Surah / Ayah / Ayat                         | Surah / Ayat / Ayat                                            |
| حديث / الأحاديث               | Hadith / Hadiths                            | Hadis / Hadis-hadis                                            |
| القرآن الكريم                 | the Holy Quran                              | Al-Qur'an                                                      |
| النبي ﷺ                       | the Prophet ﷺ                               | Nabi Muhammad ﷺ                                                |
| تسميع / ترديد                 | Recite / Repeat after                       | Setoran / Menirukan                                            |
| حفظ                           | Memorize                                    | Hafalan                                                        |
| رمز الربط                     | Link code                                   | Kode tautan                                                    |
| الباقة / الباقة التجريبية     | Plan / Free trial plan                      | Paket / Paket uji coba gratis                                  |
| لوحة ولي الأمر                | Parent dashboard                            | Dasbor orang tua                                               |
| النمو / التقدّم               | Growth / Progress                           | Perkembangan / Kemajuan                                        |
| لوحة الصدارة                  | Leaderboard                                 | Papan peringkat                                                |
| مباشر                         | Live                                        | Langsung                                                       |
| اسألني                        | Ask me                                      | Tanya aku                                                      |
| بر الوالدين / الصدق / الحِلم  | Kindness to parents / Honesty / Forbearance | Berbakti kepada orang tua / Kejujuran / Sabar dan lemah lembut |
| ريال                          | SAR                                         | SAR                                                            |

## Added from the app (recurring terms)

| Arabic                                | English                                         | Indonesian                                   |
| ------------------------------------- | ----------------------------------------------- | -------------------------------------------- |
| الرئيسية                              | Home                                            | Beranda                                      |
| تسجيل الدخول / دخول                   | Sign in / Enter                                 | Masuk / Masuk                                |
| إنشاء حساب                            | Create account (link: "Create one")             | Buat akun                                    |
| تسجيل الخروج                          | Sign out                                        | Keluar                                       |
| نسيت كلمة المرور؟                     | Forgot your password?                           | Lupa kata sandi?                             |
| البريد الإلكتروني / كلمة المرور       | Email / Password                                | Email / Kata sandi                           |
| أبنائي                                | My children                                     | Anak-anak saya                               |
| ملفّي                                 | My profile                                      | Profil saya                                  |
| الإعدادات                             | Settings                                        | Pengaturan                                   |
| حصة اليوم                             | Today's lesson                                  | Pelajaran hari ini                           |
| المشروع / مشروع الأسبوع / مشروع اليوم | Project / This week's project / Today's project | Proyek / Proyek minggu ini / Proyek hari ini |
| تسجيل (صوتي)                          | Recording                                       | Rekaman                                      |
| حكاه بصوته                            | Told it in his own voice                        | Menceritakannya dengan suaranya sendiri      |
| ملاحظة المعلّم                        | Teacher's note                                  | Catatan ustaz                                |
| مراجعة / مراجعة الأسبوع               | Review / Weekly review                          | Murajaah / Murajaah pekan ini                |
| التفسير / التفسير الميسّر             | Tafsir / Al-Tafsir Al-Muyassar                  | Tafsir / Tafsir Al-Muyassar                  |
| التلاوة / القارئ                      | Recitation / Reciter                            | Bacaan (tilawah) / Qari                      |
| أيام متتالية                          | -day streak                                     | hari berturut-turut                          |
| بذرة / غَرْسة (stage) / شجرة          | Seed / Sapling / Tree                           | Benih / Tunas / Pohon                        |
| مسار النمو                            | Growth path                                     | Jalur perkembangan                           |
| الإنجازات                             | Achievements                                    | Pencapaian                                   |
| قريبًا                                | Coming soon                                     | Segera hadir                                 |
| مجانًا                                | Free                                            | Gratis                                       |
| متاحة الآن                            | Available now                                   | Tersedia sekarang                            |
| الباقة الشهرية / السنوية              | Monthly plan / Yearly plan                      | Paket bulanan / Paket tahunan                |
| جزء عمّ                               | Juz' Amma                                       | Juz 'Amma                                    |
| بيانات توضيحية                        | Sample data                                     | Data contoh                                  |
| قيد المراجعة الشرعية                  | Under Sharia review                             | Sedang ditinjau secara syar'i                |
| المصدر                                | Source(s)                                       | Sumber                                       |

## Surah names (standard transliteration, both languages)

Al-Fatihah · Al-Ikhlas · Al-Falaq · An-Nas. In running text: "Surah Al-Ikhlas" / "Surah Al-Ikhlas".

## Numbers, plurals, direction

- Digits: Arabic-Indic in ar (as today), Latin in en / id (`formatNumber`, `fill`).
- Count phrases: `countPhrase(lang, n, { one, two, few, many })`. Arabic keeps its rules; en / id
  use `Intl.PluralRules`. Every locale has all four forms, with «{n}» where the number goes.
- Direction: ar = rtl; en / id = ltr. Quran and hadith blocks stay rtl in every language. Code / OTP
  boxes and email fields stay ltr.
