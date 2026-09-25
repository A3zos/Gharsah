import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { paths } from '../../app/paths';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { AlertIcon } from '../../components/ui/icons';
import { Blob, MobilePage } from '../../components/ui/Page';
import { TextField } from '../../components/ui/TextField';
import { cx } from '../../lib/cx';
import { isValidEmail, MIN_PASSWORD_LENGTH, passwordStrength, signUp } from '../../data/auth';
import type { Route } from './+types/signup';

export const meta: Route.MetaFunction = () => [{ title: 'إنشاء حساب — غَرْسة' }];

type Field = 'name' | 'email' | 'password' | 'confirm' | 'general';

/** design/v2 Signup — the parent account. */
export default function SignupRoute() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [serverError, setServerError] = useState<{ field: Field; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const errors: Partial<Record<Field, string>> = {};
  if (!name.trim()) errors.name = 'اكتب اسمك.';
  if (!isValidEmail(email)) errors.email = 'صيغة البريد الإلكتروني غير صحيحة.';
  if (password.length < MIN_PASSWORD_LENGTH) errors.password = 'كلمة المرور ٨ أحرف على الأقل.';
  if (confirm !== password || !confirm) errors.confirm = 'لا تطابق كلمة المرور — تحقّق مرة أخرى.';
  if (serverError) errors[serverError.field] = serverError.message;

  const show = (f: Field) => (touched[f] || serverError?.field === f) && !!errors[f];
  const strength = passwordStrength(password);

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
      const f = err as { field?: string; message: string };
      setServerError({
        field: f.field === 'email' || f.field === 'password' ? f.field : 'general',
        message: f.message,
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
        <BackButton to={paths.welcome} />
        <div className="flex flex-col gap-[5px]">
          <h1 className="m-0 font-heading text-[27px] leading-[1.55] font-bold">إنشاء حساب وليّ الأمر</h1>
          <p className="m-0 text-[14px] leading-[1.7] text-text-muted">دقيقة واحدة، ثم نضيف أبناءك.</p>
        </div>
        <div className="flex flex-col gap-[14px]">
          <TextField
            compact
            label="الاسم"
            id="su-name"
            name="name"
            autoComplete="name"
            placeholder="الاسم الكامل"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={blur('name')}
            status={show('name') ? 'error' : undefined}
            message={show('name') ? errors.name : undefined}
          />
          <TextField
            compact
            label="البريد الإلكتروني"
            id="su-email"
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (serverError?.field === 'email') setServerError(null);
            }}
            onBlur={blur('email')}
            status={show('email') ? 'error' : touched.email && email ? 'ok' : undefined}
            message={
              show('email')
                ? errors.email
                : touched.email && email
                  ? 'بريد صالح — سنرسل إليه تأكيدًا.'
                  : undefined
            }
          />
          <TextField
            compact
            password
            label="كلمة المرور"
            id="su-pass"
            name="password"
            autoComplete="new-password"
            placeholder="٨ أحرف على الأقل"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={blur('password')}
            status={show('password') ? 'error' : undefined}
            message={show('password') ? errors.password : undefined}
            below={
              password ? (
                <div
                  className="flex items-center gap-[8px]"
                  aria-label={`قوة كلمة المرور: ${strength.label}`}
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
            label="تأكيد كلمة المرور"
            id="su-pass2"
            name="password_confirm"
            autoComplete="new-password"
            placeholder="أعد كتابتها"
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
            إنشاء الحساب
          </Button>
          <p className="m-0 text-center text-[14px] text-text-muted">
            لديك حساب؟{' '}
            <Link to={paths.login} className="font-bold">
              تسجيل دخول
            </Link>
          </p>
        </div>
      </form>
    </MobilePage>
  );
}
