// design/v2 WebLanding (≥1024px). Content column 1200px (fluid below that).
import { Link } from 'react-router';

import { paths } from '../../app/paths';
import { buttonClass } from '../ui/Button';
import {
  BookIcon,
  CheckIcon,
  CodeIcon,
  ForwardIcon,
  MicIcon,
  PersonIcon,
  PlayGlyph,
  SproutMark,
} from '../ui/icons';
import { Blob } from '../ui/Page';
import { DashboardPreview, PhoneMock, SourceIcons } from './shared';

const COL = 'mx-auto w-full max-w-[1200px] px-[24px] min-[1248px]:px-0';

const STEPS = [
  {
    tint: 'bg-green-tint',
    icon: <MicIcon size={30} color="deepGreen" strokeWidth={1.9} filled={false} />,
    n: '١',
    title: 'حصة حيّة مع المعلّم',
    body: 'مكالمة صوتية يفتحها الطفل بضغطة واحدة. المعلّم يرحّب به باسمه، ويشرح خطة اليوم بصوته — بلا قراءة ولا كتابة.',
  },
  {
    tint: 'bg-gold-tint',
    icon: <BookIcon size={30} color="ayahBracket" />,
    n: '٢',
    title: 'ترديد كل آية ٣ مرات',
    body: 'تُتلى الآية بصوت القارئ، ثم يردّدها الطفل والميكروفون مفتوح، والمعلّم يعدّ معه بصوته: «باقي مرتين… باقي مرة… أحسنت».',
  },
  {
    tint: 'bg-berry-tint',
    icon: SourceIcons.project(32),
    n: '٣',
    title: 'مشروع عملي في البيت',
    body: 'حديث الأسبوع يتحوّل إلى عمل: برّ الوالدين، صدقة، إفشاء السلام… وفي اليوم التالي يحكي الطفل بصوته ماذا فعل.',
  },
];

const PLAN_FEATURES = ['حصة يومية كاملة', 'أبناء بلا حدّ', 'لوحة متابعة وتسجيلات المشاريع'];

export function LandingDesktop() {
  return (
    <div className="relative overflow-hidden bg-background text-text-dark">
      <Blob className="-top-[260px] -left-[200px] h-[760px] w-[760px] bg-blob-green" />
      <Blob className="top-[300px] -right-[180px] h-[520px] w-[520px] bg-gold/10" />
      <div className="relative z-1 flex flex-col items-center">
        <header className="flex h-[88px] w-full justify-center border-b border-b-border bg-background/90">
          <nav aria-label="الرئيسية" className={`${COL} flex items-center gap-[28px]`}>
            <span className="flex items-center gap-[11px]">
              <SproutMark size={38} />
              <span className="font-heading text-[27px] font-bold text-deep-green">غَرْسة</span>
            </span>
            <div className="flex grow items-center gap-[30px]">
              {[
                ['#how', 'كيف تعمل'],
                ['#sources', 'مصادرنا'],
                ['#privacy', 'الخصوصية'],
                ['#plans', 'الباقات'],
              ].map(([href, label]) => (
                <a key={href} href={href} className="text-[15px] font-bold text-text-dark no-underline">
                  {label}
                </a>
              ))}
            </div>
            <Link
              to={paths.login}
              className="flex h-[48px] items-center justify-center rounded-px-16 border-[1.5px] border-input-border bg-surface px-[24px] text-[15px] font-extrabold text-deep-green no-underline"
            >
              تسجيل الدخول
            </Link>
          </nav>
        </header>

        <main className="flex w-full flex-col items-center">
          <section className={`${COL} flex items-center gap-[72px] pt-[76px] pb-[84px]`}>
            <div className="flex grow flex-col items-start gap-[24px]">
              <span className="flex items-center gap-[8px] rounded-pill bg-green-tint px-[16px] py-[9px]">
                <span className="h-[8px] w-[8px] rounded-full bg-primary" />
                <span className="text-[13.5px] font-extrabold text-deep-green">
                  حصة صوتية حيّة · للأعمار ٨–١٣
                </span>
              </span>
              <h1 className="m-0 max-w-[620px] font-heading text-[62px] leading-[1.35] font-bold text-text-dark">
                غَرْسة — نغرس حُبّ القرآن <span className="text-deep-green">… ويكبر معهم</span>
              </h1>
              <p className="m-0 max-w-[560px] text-[19px] leading-[1.95] text-text-muted">
                معلّم صوتي يجلس مع ابنك كل يوم: يحفّظه آية آية، ويعلّمه حديثًا، ويكلّفه بعمل صالح يحكيه بصوته
                في اليوم التالي. وأنت ترى كل خطوة من لوحتك.
              </p>
              <div className="flex items-center gap-[14px] pt-[6px]">
                <Link
                  to={paths.signup}
                  className={buttonClass(
                    'primary',
                    'custom',
                    'h-[64px] gap-[10px] rounded-px-22 px-[34px] font-heading text-[20px] font-bold shadow-green-14-28-26',
                  )}
                >
                  ابدأ كوليّ أمر
                  <ForwardIcon size={22} />
                </Link>
                <Link
                  to={paths.childCode}
                  className={buttonClass(
                    'quiet',
                    'custom',
                    'h-[64px] gap-[10px] rounded-px-22 px-[30px] font-heading text-[20px] font-bold text-text-dark hover:text-text-dark',
                  )}
                >
                  <CodeIcon size={22} />
                  دخول الطفل برمز
                </Link>
              </div>
              <span className="pt-[4px] text-[13.5px] text-text-muted">
                بلا إعلانات · بلا بيانات من الطفل · يعمل على المتصفّح والجوال
              </span>
            </div>
            <PhoneMock desktop />
          </section>

          <section
            id="how"
            className={`${COL} flex scroll-mt-[20px] flex-col gap-[34px] pt-[20px] pb-[80px]`}
          >
            <div className="flex flex-col items-center gap-[10px]">
              <h2 className="m-0 font-heading text-[40px] font-bold text-text-dark">كيف تعمل غَرْسة</h2>
              <p className="m-0 text-[17px] text-text-muted">حصة واحدة في اليوم… ثلاث خطوات فقط.</p>
            </div>
            <div className="flex gap-[22px]">
              {STEPS.map((s) => (
                <div
                  key={s.n}
                  className="flex grow basis-0 flex-col gap-[16px] rounded-px-28 bg-surface px-[28px] py-[34px] shadow-dark-14-30-5"
                >
                  <span
                    className={`flex h-[62px] w-[62px] items-center justify-center rounded-px-20 ${s.tint}`}
                    aria-hidden="true"
                  >
                    {s.icon}
                  </span>
                  <span className="text-[13px] font-extrabold text-gold">الخطوة {s.n}</span>
                  <h3 className="m-0 font-heading text-[25px] font-bold text-text-dark">{s.title}</h3>
                  <p className="m-0 text-[15.5px] leading-[1.95] text-text-muted">{s.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="flex w-full justify-center border-y border-y-border bg-surface py-[80px]">
            <div className={`${COL} flex items-center gap-[64px]`}>
              <div className="flex grow flex-col gap-[22px]">
                <span className="self-start rounded-pill bg-green-tint px-[16px] py-[8px] text-[13px] font-extrabold text-deep-green">
                  لوليّ الأمر
                </span>
                <h2 className="m-0 max-w-[480px] font-heading text-[40px] leading-[1.45] font-bold text-text-dark">
                  تتابع تقدّمه… بلا أن تقف فوق رأسه
                </h2>
                <p className="m-0 max-w-[500px] text-[17px] leading-[1.95] text-text-muted">
                  لوحة هادئة تريك ما حفظه، وما استمع إليه، والمشاريع التي أنجزها — وتسمع تسجيل ابنه بصوته. لا
                  ترتيب ولا مقارنات مُحبِطة.
                </p>
                <ul className="m-0 flex list-none flex-col gap-[12px] p-0 pt-[6px]">
                  {[
                    'جدول أسبوعي تختاره أنت، ومدّة جلسة محدودة',
                    'تسجيلات المشاريع تصلك أنت وحدك',
                    'أكثر من ابن على حساب واحد',
                  ].map((t) => (
                    <li key={t} className="flex items-center gap-[11px] text-[15.5px] font-bold">
                      <CheckIcon />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex w-[540px] shrink-0 flex-col gap-[18px]">
                <DashboardPreview desktop />
              </div>
            </div>
          </section>

          <section
            id="sources"
            className={`${COL} flex scroll-mt-[20px] flex-col gap-[32px] pt-[84px] pb-[20px]`}
          >
            <div className="flex flex-col items-center gap-[12px]">
              <span className="rounded-pill bg-gold-tint px-[16px] py-[8px] text-[13px] font-extrabold text-warning-text">
                الموثوقية
              </span>
              <h2 className="m-0 font-heading text-[40px] font-bold text-text-dark">مصادرنا</h2>
              <p className="m-0 max-w-[660px] text-center text-[17px] leading-[1.9] text-text-muted">
                كل نصّ يسمعه الطفل مأخوذ من مصدر معتمد ومذكور — لا اجتهاد ولا توليد.
              </p>
            </div>
            <div className="flex gap-[18px]">
              <SourceCard tint="bg-green-tint" icon={SourceIcons.quran(26)} title="نصّ القرآن">
                من مشروع <b className="font-bold text-text-dark">تنزيل</b> — رواية حفص عن عاصم، بالرسم
                الإملائي المدقّق.
              </SourceCard>
              <SourceCard tint="bg-sky-tint" icon={SourceIcons.recitation(26)} title="التلاوة">
                بصوت الشيخ <b className="font-bold text-text-dark">مشاري راشد العفاسي</b> — تلاوة مرتّلة واضحة
                تناسب الأطفال.
              </SourceCard>
              <SourceCard tint="bg-gold-tint" icon={SourceIcons.tafsir(26)} title="التفسير">
                من <b className="font-bold text-text-dark">التفسير الميسّر</b> — مجمع الملك فهد لطباعة المصحف
                الشريف.
              </SourceCard>
              <SourceCard tint="bg-berry-tint" icon={SourceIcons.hadith(26)} title="الأحاديث">
                كل حديث <b className="font-bold text-text-dark">يُعتمد بتخريجه ودرجته من مختصّ شرعي</b> قبل أن
                يصل الطفل.
              </SourceCard>
            </div>
            <div className="flex items-center gap-[20px] rounded-px-28 bg-deep-green px-[34px] py-[30px]">
              <span
                className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-px-18 bg-hero-chip"
                aria-hidden="true"
              >
                {SourceIcons.shieldOnDark(28)}
              </span>
              <p className="m-0 font-heading text-[25px] leading-[1.7] font-bold text-surface">
                الذكاء الاصطناعي لا يولّد أي نصّ قرآني أو حديثي — دوره أن يشرح ويشجّع فقط.
              </p>
            </div>
          </section>

          <section
            id="privacy"
            className={`${COL} flex scroll-mt-[20px] flex-col gap-[28px] pt-[70px] pb-[80px]`}
          >
            <div className="flex flex-col items-center gap-[10px]">
              <h2 className="m-0 font-heading text-[36px] font-bold text-text-dark">خصوصية طفلك أولًا</h2>
            </div>
            <div className="flex gap-[18px]">
              <PrivacyCard tint="bg-green-tint" icon={<PersonIcon />} title="الطفل لا يعطي أي بيانات">
                لا بريد، لا كلمة مرور، لا اسم عائلة. الحساب لوليّ الأمر وحده.
              </PrivacyCard>
              <PrivacyCard
                tint="bg-sky-tint"
                icon={<CodeIcon size={24} color="skyText" strokeWidth={2} />}
                title="يدخل برمز فقط"
              >
                رمز ربط من ستّ خانات يصدره وليّ الأمر، ويستطيع إلغاءه متى شاء.
              </PrivacyCard>
              <PrivacyCard tint="bg-berry-tint" icon={SourceIcons.noMic(24)} title="لا نخزّن صوته الحيّ">
                ترديد الآيات يُسمع ولا يُحفظ. تسجيل المشروع وحده يُحفظ — ويصل لوليّ الأمر فقط، وله حذفه.
              </PrivacyCard>
            </div>
          </section>

          <section
            id="plans"
            className="flex w-full scroll-mt-[20px] justify-center border-t border-t-border bg-surface py-[80px]"
          >
            <div className={`${COL} flex flex-col items-center gap-[34px]`}>
              <div className="flex flex-col items-center gap-[10px]">
                <h2 className="m-0 font-heading text-[40px] font-bold text-text-dark">الباقات</h2>
                <p className="m-0 text-[17px] text-text-muted">
                  اشتراك واحد يكفي جميع أبنائك · الدفع عبر Google Play
                </p>
              </div>
              <div className="flex items-stretch gap-[22px]">
                <div className="relative flex w-[420px] flex-col gap-[18px] rounded-px-32 border-[2.5px] border-primary bg-background px-[32px] pt-[38px] pb-[32px]">
                  <span className="absolute -top-[15px] right-[32px] rounded-pill bg-primary px-[18px] py-[8px] text-[13px] font-extrabold text-surface">
                    الأفضل قيمة
                  </span>
                  <h3 className="m-0 font-heading text-[24px] font-bold">الباقة السنوية</h3>
                  <span className="flex items-baseline gap-[8px]">
                    <span className="font-heading text-[62px] leading-[1] font-extrabold text-deep-green">
                      ١١٩
                    </span>
                    <span className="text-[18px] font-bold text-text-muted">ريال / سنة</span>
                  </span>
                  <span className="self-start rounded-pill bg-gold-tint px-[14px] py-[8px] text-[14px] font-bold text-warning-text">
                    أقل من ١٠ ريالات في الشهر
                  </span>
                  <PlanFeatures />
                  <a
                    href="#get-app"
                    className={buttonClass(
                      'primary',
                      'custom',
                      'mt-auto h-[62px] gap-[10px] rounded-px-22 font-heading text-[19px] font-bold shadow-lesson-home-button',
                    )}
                  >
                    <PlayGlyph />
                    اشترك من التطبيق
                  </a>
                </div>
                <div className="flex w-[420px] flex-col gap-[18px] rounded-px-32 border-[1.5px] border-border bg-background px-[32px] pt-[38px] pb-[32px]">
                  <h3 className="m-0 font-heading text-[24px] font-bold">الباقة الشهرية</h3>
                  <span className="flex items-baseline gap-[8px]">
                    <span className="font-heading text-[62px] leading-[1] font-extrabold text-text-dark">
                      ٢٩
                    </span>
                    <span className="text-[18px] font-bold text-text-muted">ريال / شهر</span>
                  </span>
                  <span className="py-[8px] text-[14px] font-bold text-text-muted">
                    تجربة مرنة · تلغيها متى شئت
                  </span>
                  <PlanFeatures />
                  <a
                    href="#get-app"
                    className={buttonClass(
                      'quiet',
                      'custom',
                      'mt-auto h-[62px] gap-[10px] rounded-px-22 font-heading text-[19px] font-bold text-text-dark hover:text-text-dark',
                    )}
                  >
                    <PlayGlyph color="textDark" />
                    اشترك من التطبيق
                  </a>
                </div>
              </div>
              <div
                id="get-app"
                className="flex w-full items-center gap-[24px] rounded-px-28 border-[1.5px] border-border bg-background px-[32px] py-[24px]"
              >
                <span
                  className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-px-19 bg-gold-tint"
                  aria-hidden="true"
                >
                  {SourceIcons.phone(26)}
                </span>
                <span className="flex grow flex-col gap-[5px]">
                  <span className="text-[18px] font-extrabold">الشراء يتمّ داخل التطبيق</span>
                  <span className="text-[14.5px] leading-[1.7] text-text-muted">
                    Google Play لا يتيح الشراء من المتصفح — حمّل التطبيق على جوال وليّ الأمر لإكمال الاشتراك.
                    المتصفح للاستعراض والمتابعة فقط.
                  </span>
                </span>
                <PlayBadge />
              </div>
              <span className="text-[13.5px] text-text-muted">
                لا نطلب بيانات بطاقة داخل التطبيق · يمكنك الإلغاء في أي وقت من إعدادات الاشتراكات في Play
              </span>
            </div>
          </section>
        </main>

        <footer className="flex w-full justify-center border-t border-t-border bg-background py-[40px]">
          <div className={`${COL} flex items-center gap-[24px]`}>
            <span className="flex items-center gap-[10px]">
              <SproutMark size={28} seed={false} />
              <span className="font-heading text-[20px] font-bold text-deep-green">غَرْسة</span>
            </span>
            <nav aria-label="روابط" className="flex grow items-center gap-[24px]">
              <Link to={paths.privacy} className="text-[14px] text-text-muted no-underline">
                سياسة الخصوصية
              </Link>
              <Link to={paths.terms} className="text-[14px] text-text-muted no-underline">
                الشروط والأحكام
              </Link>
              <Link to={paths.legal} className="text-[14px] text-text-muted no-underline">
                تواصل معنا
              </Link>
            </nav>
            <span className="text-[13.5px] text-text-muted">© ١٤٤٧هـ غَرْسة · صُنع في السعودية</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function SourceCard({
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
    <div className="flex grow basis-0 flex-col gap-[13px] rounded-px-26 border-[1.5px] border-border bg-surface px-[24px] py-[28px]">
      <span
        className={`flex h-[52px] w-[52px] items-center justify-center rounded-px-17 ${tint}`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <h3 className="m-0 font-heading text-[21px] font-bold">{title}</h3>
      <p className="m-0 text-[14.5px] leading-[1.95] text-text-muted">{children}</p>
    </div>
  );
}

function PrivacyCard({
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
    <div className="flex grow basis-0 items-start gap-[16px] rounded-px-26 bg-surface px-[26px] py-[28px] shadow-dark-12-26-4">
      <span
        className={`flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-px-16 ${tint}`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="flex flex-col gap-[7px]">
        <h3 className="m-0 text-[17px] font-extrabold">{title}</h3>
        <span className="text-[14.5px] leading-[1.9] text-text-muted">{children}</span>
      </span>
    </div>
  );
}

function PlanFeatures() {
  return (
    <>
      <div className="h-[1px] bg-border" />
      <ul className="m-0 flex list-none flex-col gap-[12px] p-0">
        {PLAN_FEATURES.map((f) => (
          <li key={f} className="flex items-center gap-[10px] text-[15.5px]">
            <CheckIcon size={19} />
            {f}
          </li>
        ))}
      </ul>
    </>
  );
}

/** «حمّل التطبيق من Google Play». TODO: the Play listing URL once published. */
export function PlayBadge({ compact, href = '#get-app' }: { compact?: boolean; href?: string }) {
  return (
    <a
      href={href}
      className={`flex items-center gap-[12px] rounded-px-16 bg-text-dark px-[22px] text-surface no-underline hover:text-surface ${compact ? 'h-[56px]' : 'h-[64px]'}`}
    >
      <PlayGlyph size={compact ? 21 : 24} />
      <span className="flex flex-col gap-[1px] leading-[1.25]">
        <span className={`text-voice-bar-off ${compact ? 'text-[11px]' : 'text-[12px]'}`}>
          حمّل التطبيق من
        </span>
        <span className={`font-extrabold ${compact ? 'text-[17px]' : 'text-[19px]'}`} dir="ltr">
          Google Play
        </span>
      </span>
    </a>
  );
}
