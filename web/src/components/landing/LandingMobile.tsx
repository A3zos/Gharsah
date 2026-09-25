// design/v2 WebLandingMobile (<1024px): sticky top bar with a menu, a single
// column, and the fixed «للأعلى» button.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { paths } from '../../app/paths';
import { cx } from '../../lib/cx';
import { buttonClass } from '../ui/Button';
import { C } from '../ui/color';
import { BookIcon, CodeIcon, MicIcon, PersonIcon, PlayGlyph, SproutMark } from '../ui/icons';
import { Blob } from '../ui/Page';
import { PlayBadge } from './LandingDesktop';
import { DashboardPreview, PhoneMock, SourceIcons } from './shared';

const MENU = [
  ['#m-how', 'كيف تعمل'],
  ['#m-sources', 'مصادرنا'],
  ['#m-privacy', 'الخصوصية'],
  ['#m-plans', 'الباقات'],
] as const;

export function LandingMobile() {
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  return (
    <div className="relative bg-background text-text-dark">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] overflow-hidden">
        <Blob className="-top-[170px] -left-[150px] h-[420px] w-[420px] bg-blob-green-strong" />
      </div>
      <span id="m-top" aria-hidden="true" />
      <div className="relative z-1 flex flex-col">
        <header className="sticky top-0 z-30">
          <div className="flex h-[72px] items-center gap-[10px] border-b border-b-border bg-background/96 px-[20px]">
            <button
              type="button"
              onClick={() => setMenu((m) => !m)}
              aria-label={menu ? 'إغلاق القائمة' : 'فتح القائمة'}
              aria-expanded={menu}
              aria-controls="landing-menu"
              className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-px-15 border-[1.5px] border-input-border bg-surface p-0"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {menu ? (
                  <path
                    d="M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5"
                    stroke={C.textDark}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                ) : (
                  <path
                    d="M4 7 H20 M4 12 H20 M4 17 H20"
                    stroke={C.textDark}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </button>
            <SproutMark size={30} seed={false} />
            <span className="grow font-heading text-[22px] font-bold text-deep-green">غَرْسة</span>
            <Link
              to={paths.login}
              className="flex h-[40px] items-center justify-center rounded-px-14 border-[1.5px] border-input-border bg-surface px-[16px] text-[13.5px] font-extrabold text-deep-green no-underline"
            >
              دخول
            </Link>
          </div>
          {menu && (
            <nav
              id="landing-menu"
              aria-label="أقسام الصفحة"
              className="absolute inset-x-0 top-[72px] z-29 flex flex-col gap-[4px] border-b border-b-border bg-surface px-[16px] pt-[10px] pb-[16px] shadow-dark-14-28-8"
            >
              {MENU.map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMenu(false)}
                  className={cx(
                    'flex h-[52px] items-center rounded-px-16 px-[14px] text-[16px] font-extrabold no-underline',
                    href === '#m-plans' ? 'bg-green-tint text-deep-green' : 'text-text-dark',
                  )}
                >
                  {label}
                </a>
              ))}
            </nav>
          )}
        </header>

        <main className="mx-auto flex w-full max-w-[560px] flex-col">
          <section className="flex flex-col items-center gap-[18px] px-[20px] pt-[32px] pb-[36px]">
            <span className="flex items-center gap-[7px] rounded-pill bg-green-tint px-[14px] py-[8px]">
              <span className="h-[7px] w-[7px] rounded-full bg-primary" />
              <span className="text-[12.5px] font-extrabold text-deep-green">حصة صوتية حيّة · ٨–١٣ سنة</span>
            </span>
            <h1 className="m-0 text-center font-heading text-[34px] leading-[1.45] font-bold">
              غَرْسة — نغرس حُبّ القرآن <span className="text-deep-green">… ويكبر معهم</span>
            </h1>
            <p className="m-0 text-center text-[15.5px] leading-[1.95] text-text-muted">
              معلّم صوتي يجلس مع ابنك كل يوم: يحفّظه آية آية، ويعلّمه حديثًا، ويكلّفه بعمل صالح يحكيه بصوته
              غدًا.
            </p>
            <div className="flex w-full flex-col gap-[11px] pt-[4px]">
              <Link
                to={paths.signup}
                className={buttonClass(
                  'primary',
                  'custom',
                  'h-[62px] gap-[9px] rounded-px-22 font-heading text-[19px] font-bold shadow-lesson-home-button',
                )}
              >
                ابدأ كوليّ أمر
              </Link>
              <Link
                to={paths.childCode}
                className={buttonClass(
                  'plain',
                  'custom',
                  'h-[62px] gap-[9px] rounded-px-22 font-heading text-[19px] font-bold',
                )}
              >
                <CodeIcon size={20} />
                دخول الطفل برمز
              </Link>
            </div>
            <span className="text-center text-[12.5px] text-text-muted">
              بلا إعلانات · بلا بيانات من الطفل
            </span>
          </section>

          <div className="flex justify-center px-[20px] pb-[40px]">
            <PhoneMock />
          </div>

          <section id="m-how" className="flex scroll-mt-[80px] flex-col gap-[16px] px-[20px] pb-[44px]">
            <h2 className="m-0 text-center font-heading text-[27px] font-bold">كيف تعمل غَرْسة</h2>
            <StepCard
              tint="bg-green-tint"
              icon={<MicIcon size={24} color="deepGreen" strokeWidth={1.9} filled={false} />}
              n="١"
              title="حصة حيّة مع المعلّم"
            >
              مكالمة صوتية بضغطة واحدة — بلا قراءة ولا كتابة.
            </StepCard>
            <StepCard
              tint="bg-gold-tint"
              icon={<BookIcon size={24} color="ayahBracket" />}
              n="٢"
              title="ترديد كل آية ٣ مرات"
            >
              والمعلّم يعدّ معه بصوته: «باقي مرتين… باقي مرة… أحسنت».
            </StepCard>
            <StepCard tint="bg-berry-tint" icon={SourceIcons.project(26)} n="٣" title="مشروع عملي في البيت">
              وفي اليوم التالي يحكي بصوته ماذا فعل.
            </StepCard>
          </section>
        </main>

        <section className="border-y border-y-border bg-surface px-[20px] py-[40px]">
          <div className="mx-auto flex max-w-[520px] flex-col gap-[18px]">
            <span className="self-center rounded-pill bg-green-tint px-[14px] py-[7px] text-[12.5px] font-extrabold text-deep-green">
              لوليّ الأمر
            </span>
            <h2 className="m-0 text-center font-heading text-[26px] leading-[1.5] font-bold">
              تتابع تقدّمه… بلا أن تقف فوق رأسه
            </h2>
            <DashboardPreview />
          </div>
        </section>

        <section
          id="m-sources"
          className="mx-auto flex w-full max-w-[560px] scroll-mt-[80px] flex-col gap-[14px] px-[20px] py-[40px]"
        >
          <span className="self-center rounded-pill bg-gold-tint px-[14px] py-[7px] text-[12.5px] font-extrabold text-warning-text">
            الموثوقية
          </span>
          <h2 className="m-0 text-center font-heading text-[27px] font-bold">مصادرنا</h2>
          <p className="m-0 mb-[6px] text-center text-[14.5px] leading-[1.9] text-text-muted">
            كل نصّ يسمعه الطفل من مصدر معتمد ومذكور — لا اجتهاد ولا توليد.
          </p>
          <SourceRow tint="bg-green-tint" icon={SourceIcons.quran(22)} title="نصّ القرآن">
            من مشروع <b className="font-bold text-text-dark">تنزيل</b> — رواية حفص عن عاصم.
          </SourceRow>
          <SourceRow tint="bg-sky-tint" icon={SourceIcons.recitation(22)} title="التلاوة">
            بصوت الشيخ <b className="font-bold text-text-dark">مشاري راشد العفاسي</b>.
          </SourceRow>
          <SourceRow tint="bg-gold-tint" icon={SourceIcons.tafsir(22)} title="التفسير">
            من <b className="font-bold text-text-dark">التفسير الميسّر</b> — مجمع الملك فهد.
          </SourceRow>
          <SourceRow tint="bg-berry-tint" icon={SourceIcons.hadith(22)} title="الأحاديث">
            <b className="font-bold text-text-dark">تُعتمد بتخريجها ودرجتها من مختصّ شرعي</b> قبل أن تصل
            الطفل.
          </SourceRow>
          <div className="mt-[4px] flex items-center gap-[14px] rounded-px-24 bg-deep-green px-[20px] py-[22px]">
            <span
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-px-15 bg-hero-chip"
              aria-hidden="true"
            >
              {SourceIcons.shieldOnDark(24)}
            </span>
            <p className="m-0 font-heading text-[17px] leading-[1.7] font-bold text-surface">
              الذكاء الاصطناعي لا يولّد أي نصّ قرآني أو حديثي.
            </p>
          </div>
        </section>

        <section
          id="m-privacy"
          className="scroll-mt-[80px] border-y border-y-border bg-surface px-[20px] py-[36px]"
        >
          <div className="mx-auto flex max-w-[520px] flex-col gap-[13px]">
            <h2 className="m-0 mb-[4px] text-center font-heading text-[25px] font-bold">خصوصية طفلك أولًا</h2>
            <PrivacyRow tint="bg-green-tint" icon={<PersonIcon size={21} />} title="الطفل لا يعطي أي بيانات">
              لا بريد ولا كلمة مرور. الحساب لوليّ الأمر وحده.
            </PrivacyRow>
            <PrivacyRow
              tint="bg-sky-tint"
              icon={<CodeIcon size={21} color="skyText" strokeWidth={2} />}
              title="يدخل برمز فقط"
            >
              رمز من ستّ خانات يصدره وليّ الأمر ويلغيه متى شاء.
            </PrivacyRow>
            <PrivacyRow tint="bg-berry-tint" icon={SourceIcons.noMic(21)} title="لا نخزّن صوته الحيّ">
              ترديد الآيات يُسمع ولا يُحفظ. تسجيل المشروع وحده يصل لوليّ الأمر، وله حذفه.
            </PrivacyRow>
          </div>
        </section>

        <section
          id="m-plans"
          className="mx-auto flex w-full max-w-[560px] scroll-mt-[80px] flex-col gap-[16px] px-[20px] py-[40px]"
        >
          <h2 className="m-0 text-center font-heading text-[27px] font-bold">الباقات</h2>
          <p className="m-0 mb-[4px] text-center text-[14px] text-text-muted">
            اشتراك واحد يكفي جميع أبنائك · الدفع عبر Google Play
          </p>
          <div className="relative flex flex-col gap-[14px] rounded-px-28 border-[2.5px] border-primary bg-surface px-[22px] pt-[28px] pb-[22px]">
            <span className="absolute -top-[14px] right-[24px] rounded-pill bg-primary px-[15px] py-[7px] text-[12px] font-extrabold text-surface">
              الأفضل قيمة
            </span>
            <h3 className="m-0 font-heading text-[21px] font-bold">الباقة السنوية</h3>
            <span className="flex items-baseline gap-[7px]">
              <span className="font-heading text-[48px] leading-[1] font-extrabold text-deep-green">١١٩</span>
              <span className="text-[16px] font-bold text-text-muted">ريال / سنة</span>
            </span>
            <span className="self-start rounded-pill bg-gold-tint px-[13px] py-[7px] text-[13px] font-bold text-warning-text">
              أقل من ١٠ ريالات في الشهر
            </span>
            <a
              href="#m-get-app"
              className={buttonClass(
                'primary',
                'custom',
                'mt-auto h-[58px] gap-[10px] rounded-px-20 font-heading text-[17px] font-bold shadow-lesson-home-button',
              )}
            >
              <PlayGlyph />
              اشترك من التطبيق
            </a>
          </div>
          <div className="flex flex-col gap-[14px] rounded-px-28 border-[1.5px] border-border bg-surface px-[22px] pt-[24px] pb-[22px]">
            <h3 className="m-0 font-heading text-[21px] font-bold">الباقة الشهرية</h3>
            <span className="flex items-baseline gap-[7px]">
              <span className="font-heading text-[48px] leading-[1] font-extrabold text-text-dark">٢٩</span>
              <span className="text-[16px] font-bold text-text-muted">ريال / شهر</span>
            </span>
            <span className="text-[13px] font-bold text-text-muted">تجربة مرنة · تلغيها متى شئت</span>
            <a
              href="#m-get-app"
              className={buttonClass(
                'plain',
                'custom',
                'mt-auto h-[58px] gap-[10px] rounded-px-20 font-heading text-[17px] font-bold',
              )}
            >
              <PlayGlyph color="textDark" />
              اشترك من التطبيق
            </a>
          </div>
          <div
            id="m-get-app"
            className="flex flex-col gap-[13px] rounded-px-24 border-[1.5px] border-border bg-surface p-[18px]"
          >
            <span className="text-[15.5px] font-extrabold">الشراء يتمّ داخل التطبيق</span>
            <span className="text-[13.5px] leading-[1.8] text-text-muted">
              Google Play لا يتيح الشراء من المتصفح — حمّل التطبيق لإكمال الاشتراك.
            </span>
            <PlayBadge compact href="#m-get-app" />
          </div>
        </section>

        <footer className="flex flex-col items-center gap-[14px] border-t border-t-border px-[20px] pt-[28px] pb-[34px]">
          <span className="flex items-center gap-[9px]">
            <SproutMark size={24} seed={false} />
            <span className="font-heading text-[18px] font-bold text-deep-green">غَرْسة</span>
          </span>
          <nav aria-label="روابط" className="flex items-center gap-[18px]">
            <Link to={paths.privacy} className="text-[13px] text-text-muted no-underline">
              الخصوصية
            </Link>
            <Link to={paths.terms} className="text-[13px] text-text-muted no-underline">
              الشروط
            </Link>
            <Link to={paths.legal} className="text-[13px] text-text-muted no-underline">
              تواصل معنا
            </Link>
          </nav>
          <span className="text-[12.5px] text-text-muted">© ١٤٤٧هـ غَرْسة · صُنع في السعودية</span>
        </footer>
      </div>
      <a
        href="#m-top"
        aria-label="العودة للأعلى"
        className="fixed bottom-[calc(26px+env(safe-area-inset-bottom))] left-[20px] z-40 flex h-[56px] w-[56px] items-center justify-center rounded-full border-[3px] border-surface bg-deep-green no-underline shadow-dark-10-24-22"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 19 V6 M6 12 L12 5.6 L18 12"
            stroke={C.surface}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </a>
    </div>
  );
}

function StepCard({
  tint,
  icon,
  n,
  title,
  children,
}: {
  tint: string;
  icon: React.ReactNode;
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-[14px] rounded-px-24 bg-surface px-[20px] py-[22px] shadow-dark-10-22-5">
      <span
        className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-px-16 ${tint}`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="flex flex-col gap-[6px]">
        <span className="text-[12px] font-extrabold text-gold">الخطوة {n}</span>
        <h3 className="m-0 font-heading text-[19px] font-bold">{title}</h3>
        <span className="text-[14px] leading-[1.9] text-text-muted">{children}</span>
      </span>
    </div>
  );
}

function SourceRow({
  tint,
  icon,
  title,
  children,
}: {
  tint: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-[13px] rounded-px-22 border-[1.5px] border-border bg-surface px-[16px] py-[18px]">
      <span
        className={`flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-px-15 ${tint}`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="flex flex-col gap-[5px]">
        <h3 className="m-0 text-[16px] font-extrabold">{title}</h3>
        <span className="text-[13.5px] leading-[1.9] text-text-muted">{children}</span>
      </span>
    </div>
  );
}

function PrivacyRow({
  tint,
  icon,
  title,
  children,
}: {
  tint: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-[13px]">
      <span
        className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-px-14 ${tint}`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="flex flex-col gap-[5px]">
        <h3 className="m-0 text-[15.5px] font-extrabold">{title}</h3>
        <span className="text-[13.5px] leading-[1.9] text-text-muted">{children}</span>
      </span>
    </div>
  );
}
