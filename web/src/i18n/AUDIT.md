# Phase 1 audit — hard-coded Arabic in web/src

Arabic string literals and JSX text per file (tests excluded; the core locale files
ar.json / en.json / id.json not counted). Counted with a script on 2026-10-03.

**Total: 979 literals in 73 files.**

| File                                     | Strings | Phase / note                                       |
| ---------------------------------------- | ------: | -------------------------------------------------- |
| `lesson/teacherLines.ts`                 |      88 | 4/5 · live lesson UI + teacher lines               |
| `routes/parent/children-new.tsx`         |      74 | 3 · parent area (+ admin)                          |
| `lesson/server/testing/fakeServer.ts`    |      67 | test fixture (server replies in Arabic) — not UI   |
| `components/admin/AdminView.tsx`         |      48 | 3 · parent area (+ admin)                          |
| `components/lesson/LessonView.tsx`       |      46 | 4/5 · live lesson UI + teacher lines               |
| `components/parent/DashDetail.tsx`       |      42 | 3 · parent area (+ admin)                          |
| `routes/child/profile.tsx`               |      38 | 4 · child area                                     |
| `routes/child/home.tsx`                  |      36 | 4 · child area                                     |
| `routes/child/weekly-review.tsx`         |      31 | 4 · child area                                     |
| `routes/parent/dashboard.tsx`            |      31 | 3 · parent area (+ admin)                          |
| `routes/child/review.tsx`                |      29 | 4 · child area                                     |
| `routes/parent/children.tsx`             |      28 | 3 · parent area (+ admin)                          |
| `routes/parent/child-code.tsx`           |      24 | 3 · parent area (+ admin)                          |
| `routes/parent/settings.tsx`             |      23 | 3 · parent area (+ admin)                          |
| `routes/child/lesson.tsx`                |      22 | 4 · child area                                     |
| `lesson/server/serverLesson.ts`          |      21 | 4/5 · live lesson UI + teacher lines               |
| `components/ui/SchedulePickers.tsx`      |      20 | 3 · parent area (+ admin)                          |
| `routes/auth/signup.tsx`                 |      18 | 2 · landing + auth                                 |
| `routes/parent/plans.tsx`                |      17 | 3 · parent area (+ admin)                          |
| `data/children.ts`                       |      16 | 3 · parent area (+ admin)                          |
| `components/child/teacherCharacter.ts`   |      14 | 4 · child area                                     |
| `routes/legal.tsx`                       |      14 | 2 · landing + auth                                 |
| `data/authFailure.ts`                    |      13 | 2 · landing + auth                                 |
| `components/parent/ParentShell.tsx`      |      12 | 3 · parent area (+ admin)                          |
| `lesson/server/api.ts`                   |      12 | 4/5 · live lesson UI + teacher lines               |
| `content/review.ts`                      |      11 | 4 · child area                                     |
| `routes/auth/forgot-password.tsx`        |      11 | 2 · landing + auth                                 |
| `routes/auth/login.tsx`                  |      11 | 2 · landing + auth                                 |
| `data/stats.ts`                          |      10 | 3 · parent area (+ admin)                          |
| `components/lesson/ServerLessonView.tsx` |       9 | 4/5 · live lesson UI + teacher lines               |
| `components/states/SSessionEnd.tsx`      |       9 | 4 · child area                                     |
| `components/lesson/VoiceCall.tsx`        |       8 | 4/5 · live lesson UI + teacher lines               |
| `components/parent/RecordingRow.tsx`     |       8 | 3 · parent area (+ admin)                          |
| `components/states/SCodeExpired.tsx`     |       8 | 2 · landing + auth                                 |
| `content/avatars.ts`                     |       8 | 3 · parent area (+ admin)                          |
| `components/child/Leaderboard.tsx`       |       7 | 4 · child area                                     |
| `components/parent/GrowthHero.tsx`       |       6 | 3 · parent area (+ admin)                          |
| `data/student.ts`                        |       6 | 4 · child area                                     |
| `components/child/GrowthPath.tsx`        |       5 | 4 · child area                                     |
| `components/lesson/ServerLessonCall.tsx` |       5 | 4/5 · live lesson UI + teacher lines               |
| `components/parent/Recordings.tsx`       |       5 | 3 · parent area (+ admin)                          |
| `data/planProgress.ts`                   |       5 | 3 · parent area (+ admin)                          |
| `components/child/ChildShell.tsx`        |       4 | 4 · child area                                     |
| `components/landing/LivePhone.tsx`       |       4 | 2 · landing + auth                                 |
| `components/ui/LeaveGuard.tsx`           |       4 | 3 · parent area (+ admin)                          |
| `data/auth.ts`                           |       4 | 2 · landing + auth                                 |
| `lib/plural.ts`                          |       4 | 4 · child area                                     |
| `components/parent/SignOut.tsx`          |       3 | 3 · parent area (+ admin)                          |
| `data/pairing.ts`                        |       3 | 3 · parent area (+ admin)                          |
| `data/parent.ts`                         |       3 | 3 · parent area (+ admin)                          |
| `lesson/agent.ts`                        |       3 | 4/5 · live lesson UI + teacher lines               |
| `components/landing/LandingDesktop.tsx`  |       2 | 2 · landing + auth                                 |
| `components/landing/LandingMobile.tsx`   |       2 | 2 · landing + auth                                 |
| `components/ui/Stepper.tsx`              |       2 | 3 · parent area (+ admin)                          |
| `content/library.ts`                     |       2 | content lookups by Arabic title                    |
| `lesson/hadith.ts`                       |       2 | hadith placeholder / approval text (content)       |
| `lib/arabicDigits.ts`                    |       2 | digit tables — not UI                              |
| `root.tsx`                               |       2 | 2 · landing + auth                                 |
| `routes/landing.tsx`                     |       2 | 2 · landing + auth                                 |
| `routes/not-found.tsx`                   |       2 | 2 · landing + auth                                 |
| `components/lesson/Mushaf.tsx`           |       1 | 4/5 · live lesson UI + teacher lines               |
| `components/parent/ParentData.tsx`       |       1 | 3 · parent area (+ admin)                          |
| `components/ui/BackButton.tsx`           |       1 | 3 · parent area (+ admin)                          |
| `components/ui/ConfirmSheet.tsx`         |       1 | 3 · parent area (+ admin)                          |
| `components/ui/HomeBar.tsx`              |       1 | 2 · landing + auth                                 |
| `content/languages.ts`                   |       1 | the language's own name («العربية»)                |
| `content/verified.ts`                    |       1 | reference label built from the verified Quran meta |
| `data/submissions.ts`                    |       1 | 3 · parent area (+ admin)                          |
| `dev/childPreview.ts`                    |       1 | DEV-only sample data                               |
| `lesson/stages.ts`                       |       1 | 4/5 · live lesson UI + teacher lines               |
| `lesson/testing/fakes.ts`                |       1 | 4/5 · live lesson UI + teacher lines               |
| `lesson/voice/recitationVerifier.ts`     |       1 | 4/5 · live lesson UI + teacher lines               |
| `routes/admin.tsx`                       |       1 | —                                                  |

Not moved to locale keys (by design): Quran and hadith content, the brand «غَرْسة», content
lookups / regexes that match the server's Arabic replies, test fixtures, DEV-only sample data,
and the languages' own names in the switcher.
