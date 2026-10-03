import { useState } from 'react';
import { Link } from 'react-router';

import { paths } from '../../app/paths';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { C } from '../../components/ui/color';
import { AlertIcon } from '../../components/ui/icons';
import { Blob, MobilePage, useDocumentMeta } from '../../components/ui/Page';
import { LanguageSheetButton } from '../../components/ui/LanguageSwitcher';
import { TextField } from '../../components/ui/TextField';
import { isValidEmail, sendPasswordReset } from '../../data/auth';
import { authFailureMessage } from '../../data/authFailure';
import { MESSAGES, useI18n } from '../../i18n/i18n';
import { I18nProvider } from '../../i18n/I18nProvider';
import { useBack } from '../../lib/nav';
import type { Route } from './+types/forgot-password';

export const meta: Route.MetaFunction = () => [{ title: MESSAGES.ar.auth.titles.forgot }];

/** design/v2 ForgotPass — form, then «أرسلنا رابطًا إلى بريدك» (in the chosen language). */
export default function ForgotPasswordRoute() {
  return (
    <I18nProvider>
      <ForgotPassword />
    </I18nProvider>
  );
}

function ForgotPassword() {
  const { lang, m } = useI18n();
  const t = m.auth.forgot;
  useDocumentMeta(m.auth.titles.forgot);
  const back = useBack(paths.login);
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (!isValidEmail(email)) return setError(t.invalidEmail);
    setBusy(true);
    setError(null);
    try {
      await sendPasswordReset(email);
      setSentTo(email.trim());
    } catch (err) {
      setError(authFailureMessage(lang, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobilePage
      decor={<Blob className="-top-[160px] -left-[140px] h-[400px] w-[400px] bg-blob-green-09" />}
      innerClassName="gap-[16px] px-[20px] py-[26px]"
    >
      <div className="flex items-center gap-[12px]">
        <BackButton onClick={back} small />
        <h1 className="m-0 grow font-heading text-[26px] leading-[1.4] font-bold">{t.title}</h1>
        <LanguageSheetButton />
      </div>

      {sentTo === null ? (
        <form noValidate onSubmit={send} className="flex flex-col gap-[18px]">
          <p className="m-0 text-[15px] leading-[1.95] text-text-muted">{t.intro}</p>
          <TextField
            label={t.email}
            labelClassName="text-[14.5px]"
            id="reset-email"
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            placeholder={t.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            status={error ? 'error' : undefined}
            message={error ?? undefined}
          />
          <Button
            type="submit"
            size="custom"
            disabled={busy}
            aria-busy={busy}
            className="h-[58px] rounded-px-20 font-heading text-[18px] font-bold"
          >
            {t.send}
          </Button>
        </form>
      ) : (
        <div className="flex flex-col items-center gap-[18px] pt-[40px]" role="status">
          <span
            className="flex h-[108px] w-[108px] animate-[gh-pop-2_.5s_ease-out_both] items-center justify-center rounded-full bg-green-tint"
            aria-hidden="true"
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5.5" width="18" height="13" rx="3" stroke={C.deepGreen} strokeWidth="2" />
              <path
                d="M4 7 L12 13 L20 7"
                stroke={C.deepGreen}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="m-0 text-center font-heading text-[26px] leading-[1.5] font-bold text-deep-green">
            {t.sentTitle}
          </p>
          <p className="m-0 max-w-[300px] text-center text-[15px] leading-[1.95] text-text-muted">
            {t.sentBefore}{' '}
            <span className="font-bold text-text-dark" dir="ltr">
              {sentTo}
            </span>{' '}
            {t.sentAfter}
          </p>
          <span className="rounded-pill bg-gold-tint px-[16px] py-[9px] text-[12.5px] font-bold text-warning-text">
            {t.spam}
          </span>
          {error && (
            <p role="alert" className="m-0 flex items-center gap-[7px] text-[13px] font-bold text-error-text">
              <AlertIcon />
              {error}
            </p>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-[10px]">
        <Button
          variant="quiet"
          size="custom"
          disabled={busy}
          onClick={() => (sentTo === null ? setEmail('') : void send())}
          className="h-[54px] rounded-px-20 text-[15px] font-bold"
        >
          {sentTo === null ? t.tryOther : t.resend}
        </Button>
        <Link
          to={paths.login}
          className="flex h-[50px] items-center justify-center text-[15px] font-bold text-deep-green no-underline"
        >
          {t.backToLogin}
        </Link>
      </div>
    </MobilePage>
  );
}
