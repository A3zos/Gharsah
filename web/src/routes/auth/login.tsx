import { useState } from 'react';
import { Link, redirect, useNavigate, useSearchParams } from 'react-router';

import { paths } from '../../app/paths';
import { SCodeExpired } from '../../components/states/SCodeExpired';
import { BackButton } from '../../components/ui/BackButton';
import { Button, ButtonLink } from '../../components/ui/Button';
import { HomeBar } from '../../components/ui/HomeBar';
import { CODE_LENGTH, CodeInput } from '../../components/ui/CodeInput';
import { C } from '../../components/ui/color';
import { AlertIcon, CheckCircleIcon, SproutBadge } from '../../components/ui/icons';
import { Note } from '../../components/ui/Note';
import { Blob, MobilePage } from '../../components/ui/Page';
import { SegmentedTabs } from '../../components/ui/SegmentedTabs';
import { TextField } from '../../components/ui/TextField';
import { isValidEmail, signIn } from '../../data/auth';
import { ClaimFailure, claimCode } from '../../data/childSession';
import { toLatinDigits } from '../../lib/arabicDigits';
import { safeNext, useBack } from '../../lib/nav';
import type { Route } from './+types/login';

export const meta: Route.MetaFunction = () => [{ title: 'تسجيل الدخول — غَرْسة' }];

type Tab = 'parent' | 'child';

/** `?tab=` (or `?role=`, from the landing) → which tab is open; none = the welcome choice. */
function tabOf(params: URLSearchParams): Tab | null {
  const t = params.get('tab') ?? params.get('role');
  return t === 'parent' || t === 'child' ? t : null;
}

/** Already signed in → straight to that area (a parent opening the child tab stays). */
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const params = new URL(request.url).searchParams;
  const tab = tabOf(params);
  const { currentUser, requireChildSession } = await import('../../firebase/session');
  const user = await currentUser();
  if (user && !user.isAnonymous && tab !== 'child') {
    throw redirect(safeNext(params, 'parent') ?? paths.parent.root);
  }
  // A browser already linked to a child goes straight to its home.
  if (user?.isAnonymous && tab === 'child') {
    const linked = await requireChildSession().then(
      () => true,
      () => false,
    );
    if (linked) throw redirect(safeNext(params, 'child') ?? paths.child.home);
  }
  return { childDevice: !!user?.isAnonymous };
}

export function HydrateFallback() {
  return <div className="min-h-dvh bg-background" aria-busy="true" />;
}

export default function LoginRoute({ loaderData }: Route.ComponentProps) {
  const [params, setParams] = useSearchParams();
  const childDevice = loaderData?.childDevice ?? false;
  const tab = tabOf(params);
  if (!tab) return <Welcome />;
  return (
    <Login
      tab={tab}
      childDevice={childDevice}
      onTab={(t) => {
        const next = new URLSearchParams(params);
        next.delete('role');
        next.set('tab', t);
        setParams(next, { replace: true });
      }}
    />
  );
}

// ── design/v3 Auth — the welcome choice ─────────────────────────────────────

function Welcome() {
  return (
    <MobilePage
      decor={<Blob className="-top-[170px] -right-[140px] h-[400px] w-[400px] bg-blob-sky" />}
      innerClassName="items-center gap-[26px] px-[26px] pt-[76px] pb-[40px]"
    >
      <HomeBar />
      <div className="flex flex-col items-center gap-[8px]">
        <SproutBadge size={66} />
        <h1 className="m-0 font-heading text-[34px] leading-[1.6] font-bold text-deep-green">غَرْسة</h1>
        <p className="m-0 max-w-[270px] text-center text-[15px] leading-[1.7] text-text-muted">
          حساب وليّ الأمر — تتابع منه رحلة أبنائك مع القرآن.
        </p>
      </div>
      <GrowthIntro />
      <div className="mt-auto flex w-full flex-col gap-[12px]">
        <ButtonLink to={paths.login}>تسجيل دخول</ButtonLink>
        <ButtonLink to={paths.signup} variant="outline">
          إنشاء حساب
        </ButtonLink>
        <p className="m-0 mt-[6px] text-center text-[12px] leading-[1.8] text-text-muted">
          بالمتابعة فإنك توافق على{' '}
          <Link to={paths.terms} className="font-bold">
            شروط الاستخدام
          </Link>{' '}
          و
          <Link to={paths.privacy} className="font-bold">
            سياسة الخصوصية
          </Link>
          .
        </p>
      </div>
    </MobilePage>
  );
}

/** Seed → sprout → tree, drawing itself in (Auth frame card). */
function GrowthIntro() {
  const line = (delay: string) => (
    <div className="relative mt-[32px] h-0 grow border-t-[2.5px] border-dotted border-t-border-strong">
      <div
        className="absolute -top-[2.5px] left-0 h-[2.5px] w-full origin-left rounded-px-2 bg-primary"
        style={{ animation: `gh-line .5s ease-out ${delay} both` }}
      />
    </div>
  );
  const stage = (label: string, className: string, anim: string, art: React.ReactNode) => (
    <div className="flex w-[66px] shrink-0 flex-col items-center gap-[8px]">
      <span
        className={`flex h-[66px] w-[66px] items-center justify-center rounded-full ${className}`}
        style={{ animation: anim }}
      >
        {art}
      </span>
      <span className="text-[12.5px] font-extrabold text-deep-green">{label}</span>
    </div>
  );
  return (
    <div className="flex w-full flex-col items-center gap-[14px] rounded-px-26 bg-surface px-[18px] pt-[22px] pb-[18px] shadow-card">
      <div
        className="flex w-full items-start px-[2px] pt-[4px] [direction:ltr]"
        aria-label="بذرة ثم غَرْسة ثم شجرة"
      >
        {stage(
          'بذرة',
          'bg-gold-tint',
          'gh-pop .45s ease-out .08s both',
          <svg width="26" height="26" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <ellipse cx="20" cy="20" rx="9" ry="13" fill={C.gold} />
            <path d="M20 9 C25 14 25 26 20 31 C15 26 15 14 20 9 Z" fill={C.seedGold} />
          </svg>,
        )}
        {line('.2s')}
        {stage(
          'غَرْسة',
          'bg-green-tint',
          'gh-pop .45s ease-out .62s both',
          <svg width="36" height="36" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <path d="M20 33 V17" stroke={C.deepGreen} strokeWidth="3.2" strokeLinecap="round" />
            <path d="M20 25 C12 25 7 20 7 13 C15 13 20 18 20 25 Z" fill={C.primary} />
            <path d="M20 21 C28 21 33 16 33 9 C25 9 20 14 20 21 Z" fill={C.softGreen} />
          </svg>,
        )}
        {line('.74s')}
        {stage(
          'شجرة',
          'bg-green-tint border-[2.5px] border-primary',
          'gh-pop .45s ease-out 1.14s both, gh-pulse 2.6s ease-in-out 1.74s infinite',
          <svg width="44" height="44" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <path d="M20 35 V21" stroke={C.deepGreen} strokeWidth="3.6" strokeLinecap="round" />
            <circle cx="20" cy="13" r="9.5" fill={C.primary} />
            <circle cx="10.5" cy="19.5" r="6.5" fill={C.softGreen} />
            <circle cx="29.5" cy="19.5" r="6.5" fill={C.softGreen} />
            <circle cx="15" cy="9" r="2.6" fill={C.gold} />
            <circle cx="27" cy="16" r="2.4" fill={C.gold} />
          </svg>,
        )}
      </div>
    </div>
  );
}

// ── design/v3 Login — two tabs ──────────────────────────────────────────────

function Login({ tab, onTab, childDevice }: { tab: Tab; onTab: (t: Tab) => void; childDevice: boolean }) {
  const back = useBack(paths.welcome);
  const [expired, setExpired] = useState<string[] | null>(null);
  if (expired) return <SCodeExpired cells={expired} onBack={() => setExpired(null)} />;
  return (
    <MobilePage
      decor={<Blob className="-top-[150px] -left-[130px] h-[340px] w-[340px] bg-blob-green-strong" />}
      innerClassName="px-[26px] pt-[30px] pb-[36px]"
    >
      <div className="mx-auto flex w-full max-w-[440px] grow flex-col gap-[20px]">
        <HomeBar />
        <BackButton onClick={back} />
        <div className="flex flex-col gap-[6px]">
          <h1 className="m-0 font-heading text-[28px] leading-[1.6] font-bold">أهلًا بعودتك</h1>
          <p className="m-0 text-[14.5px] leading-[1.7] text-text-muted">
            {tab === 'parent'
              ? 'سجّل دخولك لمتابعة تقدّم أبنائك.'
              : 'ادخل برمز الدعوة الذي أعطاك إياه والدك.'}
          </p>
        </div>
        <SegmentedTabs<Tab>
          label="نوع الدخول"
          idPrefix="login"
          value={tab}
          onChange={onTab}
          segments={[
            { value: 'parent', label: 'ولي الأمر', icon: (on) => <ParentGlyph on={on} /> },
            { value: 'child', label: 'الطفل', icon: (on) => <ChildGlyph on={on} /> },
          ]}
        />
        <div
          key={tab}
          role="tabpanel"
          id={`login-panel-${tab}`}
          aria-labelledby={`login-tab-${tab}`}
          className="flex min-h-[540px] animate-[gh-tab_.28s_ease_both] flex-col gap-[18px]"
        >
          {tab === 'parent' ? <ParentForm childDevice={childDevice} /> : <ChildForm onExpired={setExpired} />}
        </div>
      </div>
    </MobilePage>
  );
}

function ParentGlyph({ on }: { on: boolean }) {
  const c = on ? C.deepGreen : C.textMuted;
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke={c} strokeWidth="1.9" />
      <path
        d="M4.5 20 C4.5 15.8 7.9 13.5 12 13.5 C16.1 13.5 19.5 15.8 19.5 20"
        stroke={c}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChildGlyph({ on }: { on: boolean }) {
  const c = on ? C.deepGreen : C.textMuted;
  return (
    <svg width="19" height="19" viewBox="0 0 76 76" fill="none" aria-hidden="true">
      <path d="M38 62 V34" stroke={c} strokeWidth="7" strokeLinecap="round" />
      <path d="M38 42 C28 42 22 36 22 27 C32 27 38 33 38 42 Z" fill={c} />
      <path d="M38 47 C48 47 54 41 54 32 C44 32 38 38 38 47 Z" fill={c} opacity="0.55" />
    </svg>
  );
}

function ParentForm({ childDevice }: { childDevice: boolean }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{ field: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!isValidEmail(email))
      return setError({ field: 'email', message: 'صيغة البريد الإلكتروني غير صحيحة.' });
    if (!password) return setError({ field: 'password', message: 'اكتب كلمة المرور.' });
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      navigate(safeNext(params, 'parent') ?? paths.parent.root, { replace: true });
    } catch (err) {
      const f = err as { field?: string; message: string };
      setError({ field: f.field ?? 'general', message: f.message });
      setBusy(false);
    }
  };

  return (
    <form noValidate onSubmit={submit} className="flex grow flex-col gap-[18px]">
      <TextField
        label="البريد الإلكتروني"
        id="login-email"
        name="email"
        type="email"
        dir="ltr"
        autoComplete="email"
        placeholder="name@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        status={error?.field === 'email' ? 'error' : undefined}
        message={error?.field === 'email' ? error.message : undefined}
      />
      <div className="flex flex-col gap-[8px]">
        <TextField
          label="كلمة المرور"
          id="login-pass"
          name="password"
          password
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          status={error?.field === 'password' ? 'error' : undefined}
          message={error?.field === 'password' ? error.message : undefined}
        />
        <Link to={paths.forgotPassword} className="self-start px-[2px] py-[6px] text-[13.5px] font-bold">
          نسيت كلمة المرور؟
        </Link>
      </div>
      <Note tone="green">حساب وليّ الأمر فقط. لا ينشئ الطفل حسابًا — يدخل برمز الربط.</Note>
      {childDevice && (
        // Signing in replaces this browser's child session (one identity per browser).
        <Note tone="gold">
          هذا المتصفح مربوط بحساب طفل. تسجيل دخولك هنا يفصله، وسيحتاج الطفل رمز ربط جديدًا — الأفضل أن تدخل من
          جوالك أو متصفح آخر.
        </Note>
      )}
      {error?.field === 'general' && (
        <p role="alert" className="m-0 flex items-center gap-[7px] text-[13px] font-bold text-error-text">
          <AlertIcon />
          {error.message}
        </p>
      )}
      <div className="mt-auto flex flex-col gap-[14px]">
        <Button type="submit" disabled={busy} aria-busy={busy}>
          تسجيل الدخول
        </Button>
        <p className="m-0 text-center text-[14px] text-text-muted">
          ليس لديك حساب؟{' '}
          <Link to={paths.signup} className="font-bold">
            إنشاء حساب
          </Link>
        </p>
      </div>
    </form>
  );
}

type CodeStatus = '' | 'short' | 'bad' | 'ok' | 'busy' | 'tooMany' | 'offline' | 'error';

function ChildForm({ onExpired }: { onExpired: (cells: string[]) => void }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [cells, setCells] = useState<string[]>(() => Array(CODE_LENGTH).fill(''));
  const [status, setStatus] = useState<CodeStatus>('');

  const submit = async (value = cells) => {
    if (status === 'busy' || status === 'ok') return;
    if (value.some((c) => !c)) return setStatus('short');
    setStatus('busy');
    // DEV-only: 000000 opens the sample-child preview (src/dev/childPreview.ts) —
    // no server, no Firebase. Production builds never take this branch.
    if (import.meta.env.DEV && toLatinDigits(value.join('')) === '000000') {
      setStatus('ok');
      navigate(`${paths.child.home}?preview=1`, { replace: true });
      return;
    }
    try {
      await claimCode(toLatinDigits(value.join('')));
      setStatus('ok');
      navigate(safeNext(params, 'child') ?? paths.child.home, { replace: true });
    } catch (e) {
      const err = e instanceof ClaimFailure ? e.error : 'unknown';
      setStatus(
        err === 'wrong'
          ? 'bad'
          : err === 'tooManyAttempts'
            ? 'tooMany'
            : err === 'offline'
              ? 'offline'
              : 'error',
      );
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex grow flex-col gap-[18px]"
    >
      <div className="flex flex-col items-center gap-[12px] pt-[6px]">
        <SproutBadge size={96} />
        <p className="m-0 max-w-[260px] text-center text-[15px] leading-[1.8]">
          أدخل الرمز الذي أعطاك إياه والدك.
        </p>
      </div>
      <div className="flex flex-col gap-[10px]">
        <label htmlFor="code-cell-1" className="text-center text-[14px] font-bold">
          رمز الدعوة
        </label>
        <CodeInput
          label="رمز الدعوة"
          value={cells}
          invalid={status === 'bad'}
          disabled={status === 'busy' || status === 'ok'}
          onChange={(v) => {
            setCells(v);
            if (status && status !== 'busy') setStatus('');
          }}
          onComplete={(v) => void submit(v)}
        />
        <div
          className="flex min-h-[26px] items-center justify-center gap-[7px]"
          role="status"
          aria-live="polite"
        >
          {status === 'bad' && (
            <>
              <span className="flex items-center gap-[7px] text-[13px] font-bold text-error-text">
                <AlertIcon />
                الرمز غير صحيح أو منتهي
              </span>
              <button
                type="button"
                onClick={() => onExpired(cells)}
                className="border-0 bg-transparent p-0 font-body text-[13px] font-extrabold text-deep-green underline"
              >
                ما الحل؟
              </button>
            </>
          )}
          {status === 'short' && (
            <span className="text-[13px] font-bold text-warning-text">أكمل الخانات الستّ.</span>
          )}
          {status === 'ok' && (
            <span className="flex items-center gap-[7px] text-[13px] font-bold text-deep-green">
              <CheckCircleIcon />
              تم التحقق — جارٍ فتح تطبيق الطفل
            </span>
          )}
          {/* TODO(design): no designed copy for these three; same slot and style as the wrong-code line. */}
          {(status === 'tooMany' || status === 'offline' || status === 'error') && (
            <span className="flex items-center gap-[7px] text-[13px] font-bold text-error-text">
              <AlertIcon />
              {status === 'tooMany'
                ? 'محاولات كثيرة — انتظر قليلًا ثم حاول مجددًا.'
                : status === 'offline'
                  ? 'تعذّر الاتصال بالإنترنت — تحقّق من الشبكة.'
                  : 'حدث خطأ غير متوقع — حاول مرة أخرى.'}
            </span>
          )}
        </div>
      </div>
      <Note tone="gold">
        لا تحتاج بريدًا ولا كلمة مرور — الرمز وحده يكفي. انتهت صلاحية رمزك؟{' '}
        <button
          type="button"
          onClick={() => onExpired(cells.map((c) => c || '–'))}
          className="border-0 bg-transparent p-0 font-body font-extrabold text-deep-green underline"
        >
          اطلب رمزًا جديدًا من والدك
        </button>
        .
      </Note>
      <div className="mt-auto">
        <Button type="submit" className="w-full" disabled={status === 'busy'} aria-busy={status === 'busy'}>
          دخول
        </Button>
      </div>
    </form>
  );
}
