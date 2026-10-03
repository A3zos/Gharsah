import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { paths } from '../../app/paths';
import { useParentData } from '../../components/parent/ParentData';
import { useSignOut } from '../../components/parent/SignOut';
import { DesktopHeader, MobileHeader, ParentPage } from '../../components/parent/ParentShell';
import { BackButton } from '../../components/ui/BackButton';
import { C } from '../../components/ui/color';
import { AlertIcon } from '../../components/ui/icons';
import { updateSchedule } from '../../data/children';
import { pilotCopy } from '../../content/pilot';
import { deleteAccount, isSubscribed, updateParentName } from '../../data/parent';
import { LanguageSettings } from '../../components/ui/LanguageSwitcher';
import { MESSAGES, useI18n } from '../../i18n/i18n';
import { cx } from '../../lib/cx';
import { failureText, useParentTitle } from '../../components/parent/parentText';
import type { Route } from './+types/settings';

export const meta: Route.MetaFunction = () => [
  { title: `${MESSAGES.ar.parent.meta.settings} — ${MESSAGES.ar.parent.meta.brand}` },
];

const Chevron = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="ltr:-scale-x-100">
    <path
      d="M15 5 L8 12 L15 19"
      stroke={C.textSubtle}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const icons = {
  person: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8.5" r="3.4" stroke={C.deepGreen} strokeWidth="2" />
      <path
        d="M5 19.5 C5 15.7 8.1 13.6 12 13.6 C15.9 13.6 19 15.7 19 19.5"
        stroke={C.deepGreen}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  lock: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="10.5" width="14" height="9.5" rx="3" stroke={C.deepGreen} strokeWidth="2" />
      <path
        d="M8.5 10.5 V8 C8.5 6 10 4.5 12 4.5 C14 4.5 15.5 6 15.5 8 V10.5"
        stroke={C.deepGreen}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  play: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M5 3.5 L18.5 12 L5 20.5 Z" stroke={C.deepGreen} strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  ),
  bell: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path
        d="M6.5 10 C6.5 6.9 9 4.5 12 4.5 C15 4.5 17.5 6.9 17.5 10 V15 L19 17.5 H5 L6.5 15 Z"
        stroke={C.deepGreen}
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M10 20 C10.6 20.6 11.3 21 12 21 C12.7 21 13.4 20.6 14 20"
        stroke={C.deepGreen}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  ),
  doc: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M6 4 H14 L18 8 V20 H6 Z" stroke={C.deepGreen} strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M9 12 H15 M9 15.5 H13" stroke={C.deepGreen} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  book: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 5.5 C6.5 4.2 9.5 4.2 12 5.8 C14.5 4.2 17.5 4.2 20 5.5 V18.5 C17.5 17.2 14.5 17.2 12 18.8 C9.5 17.2 6.5 17.2 4 18.5 Z"
        stroke={C.deepGreen}
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  ),
  logout: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path
        d="M14 5 H18 C19 5 20 6 20 7 V17 C20 18 19 19 18 19 H14"
        stroke={C.deepGreen}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M10 8 L6.5 12 L10 16 M6.5 12 H15"
        stroke={C.deepGreen}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  trash: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
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
  ),
};

const rowCls =
  'flex min-h-[60px] w-full items-center gap-[13px] px-[16px] py-[12px] text-start font-body no-underline';

function Row({
  icon,
  label,
  value,
  to,
  onClick,
  last,
  danger,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  to?: string;
  href?: string;
  onClick?: () => void;
  last?: boolean;
  danger?: boolean;
}) {
  const inner = (
    <>
      <span
        className={cx(
          'flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-px-13',
          danger ? 'bg-berry-tint' : 'bg-background',
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="grow text-[15.5px] font-bold">{label}</span>
      {value && (
        <span className="max-w-[45%] truncate text-[14px] text-text-muted" dir="auto">
          {value}
        </span>
      )}
      {(to || href || onClick) && <Chevron />}
    </>
  );
  const cls = cx(
    rowCls,
    danger ? 'text-berry-deep hover:text-berry-deep' : 'text-text-dark hover:text-text-dark',
    !last && 'border-b border-b-divider',
  );
  if (to)
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    );
  if (href)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {inner}
      </a>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cx(cls, 'border-x-0 border-t-0 bg-transparent')}>
        {inner}
      </button>
    );
  return <div className={cls}>{inner}</div>;
}

function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-[9px]" aria-label={title}>
      {title !== undefined && (
        <h2 className="m-0 ps-[6px] text-[13px] font-extrabold text-text-muted">{title}</h2>
      )}
      <div className="overflow-hidden rounded-px-24 bg-surface shadow-dark-10-22-4">{children}</div>
    </section>
  );
}

/** design/v2 Settings (the phone frame; centered in the web shell on desktop). */
export default function SettingsRoute() {
  const navigate = useNavigate();
  const { profile, email, subscription, children } = useParentData();
  const { lang, m } = useI18n();
  const t = m.parent.settings;
  const pilot = pilotCopy(lang);
  useParentTitle('settings');
  // A message key of settings, or a failure (shown in the current UI language).
  const [failure, setFailure] = useState<unknown>(null);
  const error =
    failure === null ? null : failure === 'nameTooLong' ? t.nameTooLong : failureText(lang, failure);
  const setError = (e: unknown) => setFailure(e);
  const [busy, setBusy] = useState(false);
  const sub = subscription && isSubscribed(subscription) ? subscription : null;
  const signOutFlow = useSignOut();

  // «تذكير موعد الحصة» = every child's schedule.reminder (the account has no own flag).
  const reminderOn = !!children?.length && children.every((c) => c.schedule?.reminder !== false);
  const toggleReminder = async () => {
    if (!children?.length || busy) return;
    setBusy(true);
    setError(null);
    try {
      await Promise.all(
        children
          .filter((c) => c.schedule)
          .map((c) => updateSchedule(c.id, { ...c.schedule!, reminder: !reminderOn })),
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const rename = async () => {
    // TODO(design): no designed edit-name screen; the browser prompt is used.
    const next = window.prompt(t.namePrompt, profile?.name ?? '')?.trim();
    if (!next || next === profile?.name) return;
    if (next.length > 100) return setError('nameTooLong');
    try {
      await updateParentName(next);
    } catch (e) {
      setError(e);
    }
  };

  const remove = async () => {
    // TODO(design): no designed confirmation for «حذف الحساب»; the warning card + browser confirm are used.
    if (!window.confirm(t.confirmDelete)) return;
    setBusy(true);
    try {
      await deleteAccount();
      navigate(paths.landing, { replace: true });
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  const body = (
    <>
      <Group title={t.account}>
        <Row icon={icons.person} label={t.name} value={profile?.name} onClick={() => void rename()} />
        <Row icon={icons.person} label={t.email} value={email} />
        <Row icon={icons.lock} label={t.password} to={paths.forgotPassword} last />
      </Group>
      <Group title={t.subscription}>
        <Row
          icon={icons.play}
          label={t.manage}
          // The pilot: one package for everyone (product-owner decision 2026-10-02).
          value={sub ? `${pilot.name} · ${pilot.price}` : t.noSubscription}
          to={paths.parent.plans}
          last
        />
      </Group>
      <Group title={t.alerts}>
        <div className={rowCls}>
          <span
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-px-13 bg-background"
            aria-hidden="true"
          >
            {icons.bell}
          </span>
          <span id="reminder-label" className="grow text-[15.5px] font-bold">
            {t.reminder}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={reminderOn}
            aria-labelledby="reminder-label"
            disabled={!children?.length || busy}
            onClick={() => void toggleReminder()}
            className={cx(
              'flex h-[30px] w-[52px] items-center rounded-px-15 border-0 px-[3px] disabled:opacity-60',
              reminderOn ? 'justify-end bg-primary' : 'justify-start bg-border-strong',
            )}
          >
            <span className="h-[24px] w-[24px] rounded-full bg-surface" />
          </button>
        </div>
      </Group>
      <Group title={t.language}>
        <LanguageSettings />
      </Group>
      <Group title={t.about}>
        <Row icon={icons.doc} label={t.terms} to={paths.terms} />
        <Row icon={icons.doc} label={t.privacy} to={paths.privacy} />
        <Row icon={icons.book} label={t.sources} to={`${paths.landing}#sources`} last />
      </Group>
      <Group>
        <Row icon={icons.logout} label={t.signOut} onClick={signOutFlow.ask} />
        <Row icon={icons.trash} label={t.deleteAccount} danger onClick={() => void remove()} last />
      </Group>
      {error && (
        <p role="alert" className="m-0 flex items-center gap-[7px] text-[13px] font-bold text-error-text">
          <AlertIcon />
          {error}
        </p>
      )}
      {signOutFlow.sheet}
      <div className="flex items-start gap-[11px] rounded-px-22 border-[1.5px] border-berry-border bg-berry-tint p-[16px]">
        <AlertIcon size={20} />
        <span className="text-[13px] leading-[1.85] font-bold text-error-text">{t.deleteWarn}</span>
      </div>
    </>
  );

  return (
    <ParentPage
      tab="settings"
      desktop={
        <>
          <DesktopHeader title={t.title} />
          <div className="flex max-w-[640px] flex-col gap-[16px]">{body}</div>
        </>
      }
      mobile={
        <>
          <MobileHeader
            title={t.title}
            leading={
              <BackButton
                to={paths.parent.dashboard()}
                small
                label={m.parent.addChild.back}
                className="ltr:[&_svg]:-scale-x-100"
              />
            }
          />
          {body}
        </>
      }
    />
  );
}
