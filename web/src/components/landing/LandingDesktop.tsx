// design/v2 WebLanding (≥1024px). Content column 1200px (fluid below that).
// Everything follows the landing language (src/i18n) except «الخصوصية» (Arabic for now).
import { Link } from 'react-router';

import { paths } from '../../app/paths';
import { fill, LANDING_AGES, useI18n } from '../../i18n/i18n';
import { ArabicOnly, Rich } from '../../i18n/LandingI18n';
import { buttonClass } from '../ui/Button';
import { BookIcon, CodeIcon, ForwardIcon, MicIcon, PersonIcon, SproutMark } from '../ui/icons';
import { Blob } from '../ui/Page';
import { LivePhone } from './LivePhone';
import { ParentFeatures, ParentPreview } from './ParentPreview';
import { HOW_STEPS, HowExample, HowLabel, SourceIcons, type HowStep } from './shared';
import { PilotSignupLink, PlanCards } from '../plans/PlanCards';
import { LanguageMenu } from '../ui/LanguageSwitcher';

const COL = 'mx-auto w-full max-w-[1200px] px-[24px] min-[1248px]:px-0';

const STEP_ICONS: Record<HowStep['key'], React.ReactNode> = {
  quran: <MicIcon size={30} color="deepGreen" strokeWidth={1.9} filled={false} />,
  hadith: <BookIcon size={30} color="ayahBracket" />,
  questions: SourceIcons.question(32),
};

const SOURCES = [
  { key: 'quran', tint: 'bg-green-tint', icon: SourceIcons.quran(26) },
  { key: 'recitation', tint: 'bg-sky-tint', icon: SourceIcons.recitation(26) },
  { key: 'tafsir', tint: 'bg-gold-tint', icon: SourceIcons.tafsir(26) },
  { key: 'hadith', tint: 'bg-berry-tint', icon: SourceIcons.hadith(26) },
] as const;

export function LandingDesktop() {
  const { lang, m } = useI18n();
  return (
    <div className="relative overflow-hidden bg-background text-text-dark">
      <Blob className="-top-[260px] -left-[200px] h-[760px] w-[760px] bg-blob-green" />
      <Blob className="top-[300px] -right-[180px] h-[520px] w-[520px] bg-gold/10" />
      <div className="relative z-1 flex flex-col items-center">
        <header className="flex h-[88px] w-full justify-center border-b border-b-border bg-background/90">
          <nav aria-label={m.header.navLabel} className={`${COL} flex items-center gap-[28px]`}>
            <span className="flex items-center gap-[11px]">
              <SproutMark size={38} />
              <span lang="ar" className="font-heading text-[27px] font-bold text-deep-green">
                غَرْسة
              </span>
            </span>
            <div className="flex grow items-center gap-[30px]">
              {[
                ['#how', m.header.how],
                ['#sources', m.header.sources],
                ['#privacy', m.header.privacy],
                ['#plans', m.header.plans],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="text-[15px] font-bold whitespace-nowrap text-text-dark no-underline"
                >
                  {label}
                </a>
              ))}
            </div>
            <LanguageMenu />
            <Link
              to={paths.login}
              className="flex h-[48px] items-center justify-center rounded-px-16 border-[1.5px] border-input-border bg-surface px-[24px] text-[15px] font-extrabold whitespace-nowrap text-deep-green no-underline"
            >
              {m.header.login}
            </Link>
            <Link
              to={paths.signup}
              className="flex h-[48px] items-center justify-center rounded-px-16 bg-deep-green px-[24px] text-[15px] font-extrabold whitespace-nowrap text-surface no-underline hover:text-surface"
            >
              {m.header.signup}
            </Link>
          </nav>
        </header>

        <main className="flex w-full flex-col items-center">
          {/* design/v3 WebLandingLaptop: header 88 + hero 624 fit a 1366×768 screen. */}
          <section className={`${COL} flex items-center gap-[56px] pt-[40px] pb-[44px]`}>
            <div className="flex grow flex-col items-start gap-[16px]">
              <span className="flex items-center gap-[8px] rounded-pill bg-green-tint px-[15px] py-[8px]">
                <span className="h-[8px] w-[8px] rounded-full bg-primary" />
                <span className="text-[14px] font-extrabold text-deep-green">
                  {fill(lang, m.hero.ages, LANDING_AGES)}
                </span>
              </span>
              <h1 className="m-0 max-w-[600px] font-heading text-[44px] leading-[1.4] font-bold text-text-dark ltr:leading-[1.25] ltr:text-balance">
                {m.hero.title1} <span className="block text-deep-green">{m.hero.title2}</span>
              </h1>
              <p className="m-0 max-w-[560px] text-[17px] leading-[1.9] text-text-muted ltr:leading-[1.75]">
                {m.hero.body}
              </p>
              <div className="flex items-center gap-[12px] pt-[4px]">
                <Link
                  to={paths.signup}
                  className={buttonClass(
                    'primary',
                    'custom',
                    'h-[56px] gap-[10px] rounded-px-18 px-[28px] font-heading text-[18px] font-bold shadow-lesson-home-button',
                  )}
                >
                  {m.hero.startParent}
                  {/* the arrow points forward: left in Arabic, right in English */}
                  <ForwardIcon size={20} className="ltr:-scale-x-100" />
                </Link>
                <Link
                  to={paths.childCode}
                  className={buttonClass(
                    'plain',
                    'custom',
                    'h-[56px] gap-[10px] rounded-px-18 px-[24px] font-heading text-[18px] font-bold',
                  )}
                >
                  <CodeIcon size={20} />
                  {m.hero.childLogin}
                </Link>
              </div>
            </div>
            <LivePhone desktop />
          </section>

          <section
            id="how"
            className={`${COL} flex scroll-mt-[20px] flex-col gap-[34px] pt-[20px] pb-[80px]`}
          >
            <div className="flex flex-col items-center gap-[10px]">
              <h2 className="m-0 font-heading text-[40px] font-bold text-text-dark">{m.how.title}</h2>
              <p className="m-0 text-center text-[17px] text-text-muted">{m.how.subtitle}</p>
            </div>
            {/* each card is a subgrid of the same 5 rows, so titles, texts and «مثال» boxes line up */}
            <div className="grid grid-cols-3 gap-x-[22px]">
              {HOW_STEPS.map((s) => (
                <div
                  key={s.key}
                  className="row-span-5 grid grid-rows-subgrid gap-y-[14px] rounded-px-28 bg-surface px-[28px] py-[32px] shadow-dark-14-30-5"
                >
                  <span
                    className={`flex h-[62px] w-[62px] items-center justify-center rounded-px-20 ${s.tint}`}
                    aria-hidden="true"
                  >
                    {STEP_ICONS[s.key]}
                  </span>
                  <HowLabel step={s} desktop />
                  <h3 className="m-0 font-heading text-[22px] leading-[1.5] font-bold text-text-dark">
                    {m.how.steps[s.key].title}
                  </h3>
                  <p className="m-0 text-[15.5px] leading-[1.95] text-text-muted ltr:leading-[1.75]">
                    {m.how.steps[s.key].body}
                  </p>
                  <HowExample step={s} />
                </div>
              ))}
            </div>
          </section>

          <section className="flex w-full justify-center border-y border-y-border bg-surface py-[80px]">
            <div className={`${COL} grid grid-cols-2 items-center gap-[56px]`}>
              <div className="flex min-w-0 flex-col gap-[22px]">
                <span className="self-start rounded-pill bg-green-tint px-[16px] py-[8px] text-[13px] font-extrabold text-deep-green">
                  {m.parents.pill}
                </span>
                <h2 className="m-0 max-w-[480px] font-heading text-[40px] leading-[1.45] font-bold text-text-dark ltr:leading-[1.25] ltr:text-balance">
                  {m.parents.title}
                </h2>
                <ParentFeatures desktop />
              </div>
              {/* the preview sits on the page container's edge, never past it */}
              <div className="flex min-w-0 justify-end">
                <ParentPreview desktop />
              </div>
            </div>
          </section>

          <section
            id="sources"
            className={`${COL} flex scroll-mt-[20px] flex-col gap-[32px] pt-[84px] pb-[20px]`}
          >
            <div className="flex flex-col items-center gap-[12px]">
              <span className="rounded-pill bg-gold-tint px-[16px] py-[8px] text-[13px] font-extrabold text-warning-text">
                {m.sources.pill}
              </span>
              <h2 className="m-0 font-heading text-[40px] font-bold text-text-dark">{m.sources.title}</h2>
              <p className="m-0 max-w-[660px] text-center text-[17px] leading-[1.9] text-text-muted ltr:text-balance">
                {m.sources.subtitle}
              </p>
            </div>
            <div className="flex gap-[18px]">
              {SOURCES.map((s) => (
                <SourceCard key={s.key} tint={s.tint} icon={s.icon} title={m.sources.cards[s.key].title}>
                  <Rich text={m.sources.cards[s.key].body} />
                </SourceCard>
              ))}
            </div>
            <div className="flex items-center gap-[20px] rounded-px-28 bg-deep-green px-[34px] py-[30px]">
              <span
                className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-px-18 bg-hero-chip"
                aria-hidden="true"
              >
                {SourceIcons.shieldOnDark(28)}
              </span>
              <p className="m-0 font-heading text-[25px] leading-[1.7] font-bold text-surface ltr:leading-[1.45]">
                {m.sources.banner}
              </p>
            </div>
          </section>

          {/* not translated yet: Arabic, rtl in every language */}
          <ArabicOnly>
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
          </ArabicOnly>

          <section
            id="plans"
            className="flex w-full scroll-mt-[20px] justify-center border-t border-t-border bg-surface py-[80px]"
          >
            <div className={`${COL} flex flex-col items-center gap-[34px]`}>
              <div className="flex flex-col items-center gap-[10px]">
                <h2 className="m-0 font-heading text-[40px] font-bold text-text-dark">{m.plans.title}</h2>
                <p className="m-0 text-[17px] text-text-muted">{m.plans.subtitle}</p>
              </div>
              <PlanCards pilotAction={<PilotSignupLink />} />
            </div>
          </section>
        </main>

        <footer className="flex w-full justify-center border-t border-t-border bg-background py-[40px]">
          <div className={`${COL} flex items-center gap-[24px]`}>
            <span className="flex items-center gap-[10px]">
              <SproutMark size={28} seed={false} />
              <span lang="ar" className="font-heading text-[20px] font-bold text-deep-green">
                غَرْسة
              </span>
              {m.footer.brandLatin && (
                <span className="font-heading text-[20px] font-bold text-deep-green">
                  {m.footer.brandLatin}
                </span>
              )}
            </span>
            <nav aria-label={m.footer.linksLabel} className="flex grow items-center gap-[24px]">
              <Link to={paths.privacy} className="text-[14px] text-text-muted no-underline">
                {m.footer.privacy}
              </Link>
              <Link to={paths.terms} className="text-[14px] text-text-muted no-underline">
                {m.footer.terms}
              </Link>
              <Link to={paths.legal} className="text-[14px] text-text-muted no-underline">
                {m.footer.contact}
              </Link>
            </nav>
            <span className="text-[13.5px] text-text-muted">{m.footer.copyright}</span>
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
