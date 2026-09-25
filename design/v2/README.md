# design-v2 — التصميم المحدَّث (ويب + جوال) من Claude Design

مصدرها: مشروع Claude Design الخاص بغَرْسة (نسخة 25 سبتمبر 2026). هذا هو **المرجع الأساسي لنسخة الويب**،
ويتقدّم على design/html عند أي تعارض.

كل ملف `*.dc.html` إطار واحد: التنسيق كله inline، والقيم الديناميكية بصيغة `{{ … }}`
ومنطق الحالة في `<script type="text/x-dc">` أسفل الملف (للقراءة فقط — لا يُشغَّل).
`canvas.json` يبيّن ترتيب الإطارات ومجموعاتها على اللوحة، و`NavMap.dc.html` خريطة التنقل بين الشاشات.

## إطارات الويب (سطح المكتب)
| الملف | الشاشة |
|---|---|
| WebLanding.dc.html | الصفحة الرئيسية (سطح المكتب) |
| WebLandingMobile.dc.html | الصفحة الرئيسية (جوال) |
| ParentWebDash.dc.html | لوحة وليّ الأمر (ويب) |
| ParentWebChildren.dc.html | «أبنائي» (ويب) |
| ParentWebAddChild.dc.html | إضافة ابن (ويب) |
| ParentWebPlans.dc.html | الباقات (ويب — «اشترك من التطبيق») |
| LessonDesktop.dc.html | الحصة الحيّة على سطح المكتب |
| LessonTablet.dc.html | الحصة الحيّة على التابلت |

## إطارات مشتركة / جوال
Main, Auth, Login, Signup, ForgotPass, LegalPage, Packages, PlayConfirm,
AddChild, Schedule, ScheduleCustom, AvatarPicker, PairingCode, ParentalGate, Settings, MyChildren,
Dashboard, DashboardMaryam, DashProjects, DashSurahs, DashHadith, DashAyat, ReviewList,
StudentHome, StudentHomeDay2, ChildProfile, ExitConfirm,
L1Intro, L6SurahDone, L7Hadith, L8Project, L9Record, L10Done.

## حالات الخطأ والحواف
SAutoplayBlocked (المتصفح منع التشغيل التلقائي)، SMicDenied (رفض إذن الميكروفون)، SOffline،
SCodeExpired (انتهاء رمز الربط)، SNewCode، SSessionEnd.
