import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { paths } from '../../app/paths';
import { BackButton } from '../../components/ui/BackButton';
import { HomeBar } from '../../components/ui/HomeBar';
import { LeaveGuard } from '../../components/ui/LeaveGuard';
import { useBack } from '../../lib/nav';
import { Button } from '../../components/ui/Button';
import { AlertIcon } from '../../components/ui/icons';
import { Blob, MobilePage, useDocumentMeta } from '../../components/ui/Page';
import { TextField } from '../../components/ui/TextField';
import { cx } from '../../lib/cx';
import { isValidEmail, MIN_PASSWORD_LENGTH, passwordStrength, signUp } from '../../data/auth';
import { authFailureMessage } from '../../data/authFailure';
import { fill, MESSAGES, useI18n } from '../../i18n/i18n';
import { I18nProvider } from '../../i18n/I18nProvider';
import type { Route } from './+types/signup';

export const meta: Route.MetaFunction = () => [{ title: MESSAGES.ar.auth.titles.signup }];

type Field = 'name' | 'email' | 'password' | 'confirm' | 'general';

/** design/v3 Signup — the parent account (in the chosen language). */
export default function SignupRoute() {
  return (
    <I18nProvider>
      <Signup />
    </I18nProvider>
  );
}

function Signup() {
  const { lang, m } = useI18n();
  const t = m.auth.signup;
  useDocumentMeta(m.auth.titles.signup);
  const navigate = useNavigate();
  const back = useBack(paths.welcome);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [serverError, setServerError] = useState<{ field: Field; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const errors: Partial<Record<Field, string>> = {};
  if (!name.trim()) errors.name = t.errors.name;
  if (!isValidEmail(email)) errors.email = t.errors.email;
  if (password.length < MIN_PASSWORD_LENGTH) errors.password = t.errors.password;
  if (confirm !== password || !confirm) errors.confirm = t.errors.confirm;
  if (serverError) errors[serverError.field] = serverError.message;

  const show = (f: Field) => (touched[f] || serverError?.field === f) && !!errors[f];
  const strength = passwordStrength(password, lang);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, confirm: true });
    setServerError(null);
    const local = { ...errors };
    delete local.general;
    if (Object.keys(local).length || busy) return;
    setBusy(true);
    try {
      await signUp(name, email, password);
      navigate(paths.parent.root, { replace: true });
    } catch (err) {
      const f = err as { field?: string };
      setServerError({
        field: f.field === 'email' || f.field === 'password' ? f.field : 'general',
        message: authFailureMessage(lang, err),
      });
      setBusy(false);
    }
  };

  const blur = (f: Field) => () => setTouched((t) => ({ ...t, [f]: true }));

  return (
    <MobilePage
      decor={<Blob className="-top-[160px] -left-[140px] h-[350px] w-[350px] bg-blob-gold-strong" />}
      innerClassName="px-[26px] py-[30px]"
    >
      <form
        noValidate
        onSubmit={submit}
        className="mx-auto flex w-full max-w-[440px] grow flex-col gap-[18px]"
      >
        <LeaveGuard when={!busy && !!(name || email || password || confirm)} />
        <HomeBar languageSwitch />
        <BackButton onClick={back} />
        <div className="flex flex-col gap-[5px]">
          <h1 className="m-0 font-heading text-[27px] leading-[1.55] font-bold">{t.title}</h1>
          <p className="m-0 text-[14px] leading-[1.7] text-text-muted">{t.subtitle}</p>
        </div>
        <div className="flex flex-col gap-[14px]">
          <TextField
            compact
            label={t.name}
            id="su-name"
            name="name"
            autoComplete="name"
            placeholder={t.namePlaceholder}
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={blur('name')}
            status={show('name') ? 'error' : undefined}
            message={show('name') ? errors.name : undefined}
          />
          <TextField
            compact
            label={t.email}
            id="su-email"
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            placeholder={t.emailPlaceholder}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (serverError?.field === 'email') setServerError(null);
            }}
            onBlur={blur('email')}
            status={show('email') ? 'error' : touched.email && email ? 'ok' : undefined}
            message={show('email') ? errors.email : touched.email && email ? t.emailOk : undefined}
          />
          <TextField
            compact
            password
            label={t.password}
            id="su-pass"
            name="password"
            autoComplete="new-password"
            placeholder={t.passwordPlaceholder}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={blur('password')}
            status={show('password') ? 'error' : undefined}
            message={show('password') ? errors.password : undefined}
            below={
              password ? (
                <div
                  className="flex items-center gap-[8px]"
                  aria-label={fill(lang, t.strength, { label: strength.label })}
                >
                  <div className="flex grow gap-[5px]" aria-hidden="true">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={cx(
                          'h-[6px] grow rounded-px-3',
                          i <= strength.bars ? 'bg-primary' : 'bg-border',
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-[12.5px] font-medium text-text-muted">{strength.label}</span>
                </div>
              ) : null
            }
          />
          <TextField
            compact
            type="password"
            label={t.confirm}
            id="su-pass2"
            name="password_confirm"
            autoComplete="new-password"
            placeholder={t.confirmPlaceholder}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onBlur={blur('confirm')}
            status={show('confirm') ? 'error' : undefined}
            message={show('confirm') ? errors.confirm : undefined}
          />
        </div>
        {serverError?.field === 'general' && (
          <p role="alert" className="m-0 flex items-center gap-[7px] text-[13px] font-bold text-error-text">
            <AlertIcon />
            {serverError.message}
          </p>
        )}
        <div className="mt-auto flex flex-col gap-[12px]">
          <Button type="submit" disabled={busy} aria-busy={busy}>
            {t.submit}
          </Button>
          <p className="m-0 text-center text-[14px] text-text-muted">
            {t.haveAccount}{' '}
            <Link to={paths.login} className="font-bold">
              {t.login}
            </Link>
          </p>
        </div>
      </form>
    </MobilePage>
  );
}
