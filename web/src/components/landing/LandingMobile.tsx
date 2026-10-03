// design/v2 WebLandingMobile (<1024px): sticky top bar with a menu, a single
// column, and the fixed «للأعلى» button. Everything follows the landing language
// (src/i18n) except «الخصوصية» (Arabic for now).
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { paths } from '../../app/paths';
import { fill, LANDING_AGES, useI18n } from '../../i18n/i18n';
import { ArabicOnly, Rich } from '../../i18n/LandingI18n';
import { cx } from '../../lib/cx';
import { buttonClass } from '../ui/Button';
import { C } from '../ui/color';
import { BookIcon, CodeIcon, MicIcon, PersonIcon, SproutMark } from '../ui/icons';
import { Blob } from '../ui/Page';
import { LanguageSheetButton } from '../ui/LanguageSwitcher';
import { LivePhone } from './LivePhone';
import { ParentFeatures, ParentPreview } from './ParentPreview';
import { HOW_STEPS, HowExample, HowLabel, SourceIcons, type HowStep } from './shared';
import { PilotSignupLink, PlanCards } from '../plans/PlanCards';

const STEP_ICONS: Record<HowStep['key'], React.ReactNode> = {
  quran: <MicIcon size={24} color="deepGreen" strokeWidth={1.9} filled={false} />,
  hadith: <BookIcon size={24} color="ayahBracket" />,
  questions: SourceIcons.question(26),
};

const SOURCES = [
  { key: 'quran', tint: 'bg-green-tint', icon: SourceIcons.quran(22) },
  { key: 'recitation', tint: 'bg-sky-tint', icon: SourceIcons.recitation(22) },
  { key: 'tafsir', tint: 'bg-gold-tint', icon: SourceIcons.tafsir(22) },
  { key: 'hadith', tint: 'bg-berry-tint', icon: SourceIcons.hadith(22) },
] as const;

const MENU = [
  ['#m-how', 'how'],
  ['#m-sources', 'sources'],
  ['#m-privacy', 'privacy'],
  ['#m-plans', 'plans'],
] as const;

export function LandingMobile() {
  const [menu, setMenu] = useState(false);
  const { lang, m } = useI18n();

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
          <div className="flex h-[72px] items-center gap-[8px] border-b border-b-border bg-background/96 px-[16px] max-[379px]:gap-[6px] max-[379px]:px-[12px]">
            <button
              type="button"
              onClick={() => setMenu((m) => !m)}
              aria-label={menu ? m.header.closeMenu : m.header.openMenu}
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
            <span className="min-w-0 grow font-heading text-[22px] font-bold text-deep-green">
              {/* Narrow phones: the mark alone, so the language button and both auth buttons fit. */}
              <span lang="ar" className="max-[419px]:sr-only">
                غَرْسة
              </span>
            </span>
            <LanguageSheetButton />
            <Link
              to={paths.login}
              className="flex h-[40px] items-center justify-center rounded-px-14 border-[1.5px] border-input-border bg-surface px-[10px] text-[13px] font-extrabold whitespace-nowrap text-deep-green no-underline"
            >
              {m.header.login}
            </Link>
            <Link
              to={paths.signup}
              className="flex h-[40px] items-center justify-center rounded-px-14 bg-deep-green px-[10px] text-[13px] font-extrabold whitespace-nowrap text-surface no-underline hover:text-surface"
            >
              {m.header.signup}
            </Link>
          </div>
          {menu && (
            <nav
              id="landing-menu"
              aria-label={m.header.sectionsLabel}
              className="absolute inset-x-0 top-[72px] z-29 flex flex-col gap-[4px] border-b border-b-border bg-surface px-[16px] pt-[10px] pb-[16px] shadow-dark-14-28-8"
            >
              {MENU.map(([href, key]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMenu(false)}
                  className={cx(
                    'flex h-[52px] items-center rounded-px-16 px-[14px] text-[16px] font-extrabold no-underline',
                    href === '#m-plans' ? 'bg-green-tint text-deep-green' : 'text-text-dark',
                  )}
                >
                  {m.header[key]}
                </a>
              ))}
            </nav>
          )}
        </header>

        <main className="mx-auto flex w-full max-w-[560px] flex-col">
          <section className="flex flex-col items-center gap-[18px] px-[20px] pt-[32px] pb-[36px]">
            <span className="flex items-center gap-[7px] rounded-pill bg-green-tint px-[14px] py-[8px]">
              <span className="h-[7px] w-[7px] rounded-full bg-primary" />
              <span className="text-[12.5px] font-extrabold text-deep-green">
                {fill(lang, m.hero.ages, LANDING_AGES)}
              </span>
            </span>
            <h1 className="m-0 text-center font-heading text-[34px] leading-[1.45] font-bold ltr:leading-[1.25] ltr:text-balance">
              {m.hero.title1} <span className="block text-deep-green">{m.hero.title2}</span>
            </h1>
            <p className="m-0 text-center text-[15.5px] leading-[1.95] text-text-muted ltr:leading-[1.75]">
              {m.hero.body}
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
                {m.hero.startParent}
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
                {m.hero.childLogin}
              </Link>
            </div>
          </section>

          <div className="flex justify-center overflow-x-clip px-[20px] pt-[8px] pb-[40px]">
            <LivePhone />
          </div>

          <section id="m-how" className="flex scroll-mt-[80px] flex-col gap-[16px] px-[20px] pb-[44px]">
            <h2 className="m-0 text-center font-heading text-[27px] font-bold">{m.how.title}</h2>
            <p className="m-0 -mt-[6px] text-center text-[14.5px] leading-[1.8] text-text-muted">
              {m.how.subtitle}
            </p>
            {HOW_STEPS.map((s) => (
              <StepCard key={s.key} step={s} icon={STEP_ICONS[s.key]} />
            ))}
          </section>
        </main>

        <section className="border-y border-y-border bg-surface px-[20px] py-[40px]">
          <div className="mx-auto flex max-w-[520px] flex-col gap-[18px]">
            <span className="self-center rounded-pill bg-green-tint px-[14px] py-[7px] text-[12.5px] font-extrabold text-deep-green">
              {m.parents.pill}
            </span>
            <h2 className="m-0 text-center font-heading text-[26px] leading-[1.5] font-bold ltr:leading-[1.3] ltr:text-balance">
              {m.parents.title}
            </h2>
            <ParentFeatures />
            <div className="pt-[6px]">
              <ParentPreview />
            </div>
          </div>
        </section>

        <section
          id="m-sources"
          className="mx-auto flex w-full max-w-[560px] scroll-mt-[80px] flex-col gap-[14px] px-[20px] py-[40px]"
        >
          <span className="self-center rounded-pill bg-gold-tint px-[14px] py-[7px] text-[12.5px] font-extrabold text-warning-text">
            {m.sources.pill}
          </span>
          <h2 className="m-0 text-center font-heading text-[27px] font-bold">{m.sources.title}</h2>
          <p className="m-0 mb-[6px] text-center text-[14.5px] leading-[1.9] text-text-muted">
            {m.sources.subtitleShort}
          </p>
          {SOURCES.map((s) => (
            <SourceRow key={s.key} tint={s.tint} icon={s.icon} title={m.sources.cards[s.key].title}>
              <Rich text={m.sources.cards[s.key].bodyShort} />
            </SourceRow>
          ))}
          <div className="mt-[4px] flex items-center gap-[14px] rounded-px-24 bg-deep-green px-[20px] py-[22px]">
            <span
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-px-15 bg-hero-chip"
              aria-hidden="true"
            >
              {SourceIcons.shieldOnDark(24)}
            </span>
            <p className="m-0 font-heading text-[17px] leading-[1.7] font-bold text-surface ltr:leading-[1.45]">
              {m.sources.bannerShort}
            </p>
          </div>
        </section>

        {/* not translated yet: Arabic, rtl in every language */}
        <ArabicOnly>
          <section
            id="m-privacy"
            className="scroll-mt-[80px] border-y border-y-border bg-surface px-[20px] py-[36px]"
          >
            <div className="mx-auto flex max-w-[520px] flex-col gap-[13px]">
              <h2 className="m-0 mb-[4px] text-center font-heading text-[25px] font-bold">
                خصوصية طفلك أولًا
              </h2>
              <PrivacyRow
                tint="bg-green-tint"
                icon={<PersonIcon size={21} />}
                title="الطفل لا يعطي أي بيانات"
              >
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
        </ArabicOnly>

        <section
          id="m-plans"
          className="mx-auto flex w-full max-w-[560px] scroll-mt-[80px] flex-col gap-[24px] px-[20px] py-[40px] min-[900px]:max-w-[1176px]"
        >
          <h2 className="m-0 text-center font-heading text-[27px] font-bold">{m.plans.title}</h2>
          <p className="m-0 mb-[4px] text-center text-[14px] text-text-muted">{m.plans.subtitle}</p>
          <PlanCards pilotAction={<PilotSignupLink />} />
        </section>

        <footer className="flex flex-col items-center gap-[14px] border-t border-t-border px-[20px] pt-[28px] pb-[34px]">
          <span className="flex items-center gap-[9px]">
            <SproutMark size={24} seed={false} />
            <span lang="ar" className="font-heading text-[18px] font-bold text-deep-green">
              غَرْسة
            </span>
            {m.footer.brandLatin && (
              <span className="font-heading text-[18px] font-bold text-deep-green">
                {m.footer.brandLatin}
              </span>
            )}
          </span>
          <nav
            aria-label={m.footer.linksLabel}
            className="flex flex-wrap items-center justify-center gap-x-[18px] gap-y-[6px]"
          >
            <Link to={paths.privacy} className="text-[13px] text-text-muted no-underline">
              {m.footer.privacyShort}
            </Link>
            <Link to={paths.terms} className="text-[13px] text-text-muted no-underline">
              {m.footer.termsShort}
            </Link>
            <Link to={paths.legal} className="text-[13px] text-text-muted no-underline">
              {m.footer.contact}
            </Link>
          </nav>
          <span className="text-center text-[12.5px] text-text-muted">{m.footer.copyright}</span>
        </footer>
      </div>
      <a
        href="#m-top"
        aria-label={m.header.backToTop}
        className="fixed end-[20px] bottom-[calc(26px+env(safe-area-inset-bottom))] z-40 flex h-[56px] w-[56px] items-center justify-center rounded-full border-[3px] border-surface bg-deep-green no-underline shadow-dark-10-24-22"
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

function StepCard({ step, icon }: { step: HowStep; icon: React.ReactNode }) {
  const { m } = useI18n();
  const words = m.how.steps[step.key];
  return (
    <div className="flex flex-col gap-[12px] rounded-px-24 bg-surface px-[20px] py-[22px] shadow-dark-10-22-5">
      <div className="flex gap-[14px]">
        <span
          className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-px-16 ${step.tint}`}
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="flex flex-col gap-[6px]">
          <HowLabel step={step} />
          <h3 className="m-0 font-heading text-[19px] font-bold">{words.title}</h3>
          <span className="text-[14px] leading-[1.9] text-text-muted ltr:leading-[1.7]">{words.body}</span>
        </span>
      </div>
      <HowExample step={step} />
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
