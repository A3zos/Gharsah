import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { paths } from '../../app/paths';
import { ChildAvatar } from '../../components/child/ChildAvatar';
import { useParentData } from '../../components/parent/ParentData';
import { DesktopHeader, MobileHeader, ParentPage, SettingsButton } from '../../components/parent/ParentShell';
import { buttonClass } from '../../components/ui/Button';
import { C } from '../../components/ui/color';
import { CheckIcon, ClockIcon, ForwardIcon, PlusIcon } from '../../components/ui/icons';
import { pairingActive, removeChild, type ChildProfile } from '../../data/children';
import { planProgress, planSentence } from '../../data/planProgress';
import { ageLabel, childrenCount, headline, stageLabel } from '../../data/stats';
import { pilotCopy } from '../../content/pilot';
import { formatNumber, MESSAGES, useI18n, type UiLanguage } from '../../i18n/i18n';
import { cx } from '../../lib/cx';
import { hoursUntil } from '../../lib/dates';
import { failureText, fmt, pctText, useParentTitle } from '../../components/parent/parentText';
import type { Route } from './+types/children';

export const meta: Route.MetaFunction = () => [
  { title: `${MESSAGES.ar.parent.meta.children} — ${MESSAGES.ar.parent.meta.brand}` },
];

/** «١٠ سنوات · رمز الربط ٤٧٢٩١٨» or, waiting, «… · الرمز ينتهي بعد ٢٣ ساعة». */
function childLine(lang: UiLanguage, c: ChildProfile, desktopWaiting: boolean): string {
  const t = MESSAGES[lang].parent.children;
  const age = ageLabel(c.age, lang);
  if (desktopWaiting && !c.linked && c.pairing && pairingActive(c.pairing)) {
    return fmt(lang, t.codeExpires, { age, h: hoursUntil(c.pairing.expiresAt) });
  }
  return c.pairing ? fmt(lang, t.codeLine, { age, code: formatNumber(lang, c.pairing.code) }) : age;
}

/** The child's voice consent is off: one small note for the parent → the edit form's box. */
function VoiceOffNote({ childId }: { childId: string }) {
  const t = useI18n().m.parent.children;
  return (
    <Link
      to={paths.parent.editSchedule(childId)}
      className="self-start text-[12.5px] font-bold text-warning-text underline-offset-4 hover:underline"
    >
      {t.voiceOff}
    </Link>
  );
}

function StatusPill({ linked, small }: { linked: boolean; small?: boolean }) {
  const t = useI18n().m.parent.children;
  return linked ? (
    <span
      className={cx(
        'flex items-center gap-[6px] rounded-pill bg-green-tint font-extrabold text-deep-green',
        small ? 'px-[11px] py-[6px] text-[11.5px]' : 'px-[12px] py-[6px] text-[12.5px]',
      )}
    >
      <CheckIcon size={13} strokeWidth={3.4} />
      {t.linked}
    </span>
  ) : (
    <span
      className={cx(
        'flex items-center gap-[6px] rounded-pill bg-gold-tint font-extrabold text-warning-text',
        small ? 'px-[11px] py-[6px] text-[11.5px]' : 'px-[12px] py-[6px] text-[12.5px]',
      )}
    >
      <ClockIcon />
      {t.waiting}
    </span>
  );
}

export default function ChildrenRoute() {
  const { children } = useParentData();
  const { lang, m } = useI18n();
  const [error, setError] = useState<string | null>(null);
  useParentTitle('children');
  const remove = async (c: ChildProfile) => {
    // TODO(design): no designed confirmation for «حذف الابن»; the browser's confirm dialog is used.
    if (!window.confirm(fmt(lang, m.parent.children.confirmRemove, { name: c.name }))) return;
    try {
      await removeChild(c.id);
    } catch (e) {
      setError(failureText(lang, e));
    }
  };
  return (
    <ParentPage
      tab="children"
      desktop={<Desktop kids={children} />}
      mobile={<Mobile kids={children} onRemove={remove} error={error} />}
    />
  );
}

function Desktop({ kids }: { kids: ChildProfile[] | null }) {
  const { lang, m } = useI18n();
  const t = m.parent.children;
  const price = pilotCopy(lang).price;
  const n = kids?.length ?? 0;
  return (
    <>
      <DesktopHeader
        title={t.title}
        subtitle={fmt(lang, t.subtitleDesktop, { count: childrenCount(n, lang) })}
        action={
          <Link
            to={paths.parent.addChildFrom('children')}
            className={buttonClass(
              'gold',
              'custom',
              'h-[54px] gap-[10px] rounded-px-18 px-[24px] text-[15.5px] font-extrabold',
            )}
          >
            <PlusIcon />
            {m.parent.common.addChild}
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-[20px]" aria-busy={kids === null}>
        {kids?.map((c) => {
          const h = headline(c);
          const plan = planProgress(c, undefined, lang);
          return (
            <article
              key={c.id}
              className="flex flex-col gap-[18px] rounded-px-30 border-[1.5px] border-border bg-surface px-[26px] py-[24px] shadow-dark-12-26-5"
            >
              <div className="flex items-center gap-[16px]">
                <ChildAvatar id={c.avatarId} size={58} className="rounded-px-20" />
                <span className="flex min-w-0 grow flex-col gap-[5px]">
                  <h2 className="m-0 font-heading text-[22px] leading-[1.4] font-bold">{c.name}</h2>
                  <span className="text-[13.5px] text-text-muted">{childLine(lang, c, true)}</span>
                </span>
                <StatusPill linked={c.linked} />
              </div>
              {!c.aiVoiceConsent && <VoiceOffNote childId={c.id} />}
              <div className="flex flex-col gap-[8px]">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-bold text-text-muted">
                    {fmt(lang, t.stageLine, { plan: plan.plan.name, price })}{' '}
                    <span className="text-deep-green">{stageLabel(plan.stage, lang)}</span>
                  </span>
                  <span className="font-heading text-[16px] font-extrabold text-deep-green">
                    {pctText(lang, plan.pct)}
                  </span>
                </div>
                <div
                  className="h-[9px] overflow-hidden rounded-px-5 bg-border-soft"
                  role="progressbar"
                  aria-valuenow={plan.pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={fmt(lang, t.progressOf, { plan: plan.plan.name })}
                >
                  <span className="block h-[9px] rounded-px-5 bg-primary" style={{ width: `${plan.pct}%` }} />
                </div>
                <span className="text-[12.5px] font-bold text-text-muted">{planSentence(plan, lang)}</span>
              </div>
              <div className="flex gap-[10px]">
                {(
                  [
                    [h.surahs, t.statSurahs],
                    [h.ayat, t.statAyat],
                    [h.hadith, t.statHadith],
                    [h.projects, t.statProjects],
                  ] as const
                ).map(([v, label]) => (
                  <span
                    key={label}
                    className="flex grow basis-0 flex-col gap-[3px] rounded-px-18 bg-background px-[14px] py-[12px]"
                  >
                    <span className="font-heading text-[25px] leading-[1.15] font-extrabold">
                      {formatNumber(lang, v)}
                    </span>
                    <span className="text-[12px] font-bold text-text-muted">{label}</span>
                  </span>
                ))}
              </div>
              <div className="flex gap-[12px]">
                <Link
                  to={paths.parent.dashboard(c.id)}
                  className={buttonClass('primary', 'md', 'grow gap-[9px]')}
                >
                  {t.viewProgress}
                  <ForwardIcon className="ltr:-scale-x-100" />
                </Link>
                <Link
                  to={`${paths.parent.childCode(c.id)}?new=1`}
                  className={buttonClass(
                    'quiet',
                    'custom',
                    'h-[52px] rounded-px-18 px-[20px] text-[14.5px] font-bold',
                  )}
                >
                  {t.newCode}
                </Link>
              </div>
            </article>
          );
        })}
        <Link
          to={paths.parent.addChildFrom('children')}
          className="flex min-h-[200px] flex-col items-center justify-center gap-[12px] rounded-px-30 border-[2px] border-dashed border-input-border bg-transparent text-deep-green no-underline"
        >
          <span
            className="flex h-[62px] w-[62px] items-center justify-center rounded-px-22 bg-green-tint"
            aria-hidden="true"
          >
            <PlusIcon size={28} color="deepGreen" />
          </span>
          <span className="font-heading text-[20px] font-bold">{t.addNew}</span>
          <span className="text-[13.5px] text-text-muted">{t.addNewNote}</span>
        </Link>
      </div>
    </>
  );
}

function Mobile({
  kids,
  onRemove,
  error,
}: {
  kids: ChildProfile[] | null;
  onRemove: (c: ChildProfile) => void;
  error: string | null;
}) {
  const [menu, setMenu] = useState<string | null>(null);
  const { lang, m } = useI18n();
  const t = m.parent.children;
  return (
    <>
      <MobileHeader title={t.title} subtitle={t.subtitleMobile} trailing={<SettingsButton />} />
      {error && (
        <p role="alert" className="m-0 text-[13px] font-bold text-error-text">
          {error}
        </p>
      )}
      {kids?.map((c) => (
        <article
          key={c.id}
          className="relative flex flex-col gap-[14px] rounded-px-26 border-[1.5px] border-border bg-surface p-[18px] shadow-dark-10-22-4"
        >
          <div className="flex items-center gap-[13px]">
            <span className="shrink-0">
              <ChildAvatar id={c.avatarId} size={56} />
            </span>
            <span className="flex min-w-0 grow flex-col gap-[5px]">
              <h2 className="m-0 text-[17px] font-extrabold">{c.name}</h2>
              <span className="text-[12.5px] text-text-muted">{childLine(lang, c, false)}</span>
            </span>
            <button
              type="button"
              aria-label={fmt(lang, t.options, { name: c.name })}
              aria-expanded={menu === c.id}
              aria-haspopup="menu"
              onClick={() => setMenu((m) => (m === c.id ? null : c.id))}
              className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-px-15 border-0 bg-background"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="5.5" r="1.8" fill={C.textMuted} />
                <circle cx="12" cy="12" r="1.8" fill={C.textMuted} />
                <circle cx="12" cy="18.5" r="1.8" fill={C.textMuted} />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-[10px]">
            <StatusPill linked={c.linked} small />
            <span className="grow" />
            <Link
              to={c.linked ? paths.parent.dashboard(c.id) : paths.parent.childCode(c.id)}
              className="flex h-[44px] items-center gap-[7px] rounded-px-15 bg-green-tint px-[16px] text-[13.5px] font-extrabold text-deep-green no-underline"
            >
              {c.linked ? t.achievements : t.showCode}
              <ForwardIcon size={17} color="deepGreen" strokeWidth={2.4} className="ltr:-scale-x-100" />
            </Link>
          </div>
          {!c.aiVoiceConsent && <VoiceOffNote childId={c.id} />}
          {menu === c.id && (
            <ChildMenu child={c} onClose={() => setMenu(null)} onRemove={() => onRemove(c)} />
          )}
        </article>
      ))}
      <Link
        to={paths.parent.addChildFrom('children')}
        className="flex h-[62px] items-center justify-center gap-[11px] rounded-px-22 border-[1.5px] border-dashed border-input-border bg-transparent font-heading text-[18px] font-bold text-deep-green no-underline"
      >
        <PlusIcon color="deepGreen" />
        {m.parent.common.addChild}
      </Link>
    </>
  );
}

function ChildMenu({
  child,
  onClose,
  onRemove,
}: {
  child: ChildProfile;
  onClose: () => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { lang, m } = useI18n();
  const t = m.parent.children;
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
    const onDoc = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const t = setTimeout(() => document.addEventListener('pointerdown', onDoc));
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  const item =
    'flex h-[46px] items-center gap-[10px] rounded-px-14 px-[12px] text-[14.5px] font-bold no-underline';
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={fmt(lang, t.options, { name: child.name })}
      className="absolute end-[16px] top-[62px] z-4 flex w-[214px] animate-[gh-pop-2_.3s_ease-out_both] flex-col gap-[2px] rounded-px-20 border-[1.5px] border-border bg-surface p-[7px] shadow-dark-18-40-14"
    >
      <Link role="menuitem" to={paths.parent.editSchedule(child.id)} className={cx(item, 'text-text-dark')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="5.5" width="16" height="14" rx="3" stroke={C.textMuted} strokeWidth="1.9" />
          <path
            d="M4 10 H20 M8.5 3.5 V7 M15.5 3.5 V7"
            stroke={C.textMuted}
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
        {t.editSchedule}
      </Link>
      <Link
        role="menuitem"
        to={`${paths.parent.childCode(child.id)}?new=1`}
        className={cx(item, 'text-text-dark')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4.5 12 A7.5 7.5 0 1 1 7.4 17.9"
            stroke={C.textMuted}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M4.5 7 V12 H9.5"
            stroke={C.textMuted}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {t.newCode}
      </Link>
      <span className="mx-[8px] my-[4px] h-[1px] bg-divider" />
      <button
        role="menuitem"
        type="button"
        onClick={() => {
          onClose();
          onRemove();
        }}
        className={cx(item, 'border-0 bg-transparent text-start font-body text-berry-deep')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5 7 H19 M9.5 7 V5.5 C9.5 4.7 10.2 4 11 4 H13 C13.8 4 14.5 4.7 14.5 5.5 V7"
            stroke={C.berryDeep}
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <path
            d="M6.8 7 L7.7 19 C7.8 19.6 8.3 20 8.9 20 H15.1 C15.7 20 16.2 19.6 16.3 19 L17.2 7"
            stroke={C.berryDeep}
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
        </svg>
        {t.remove}
      </button>
    </div>
  );
}
