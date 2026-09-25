import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

import { paths } from '../../app/paths';
import { useParentData } from '../../components/parent/ParentData';
import { ParentPage } from '../../components/parent/ParentShell';
import { BackButton } from '../../components/ui/BackButton';
import { Button, buttonClass } from '../../components/ui/Button';
import { C } from '../../components/ui/color';
import { AlertIcon, ForwardIcon } from '../../components/ui/icons';
import { Blob } from '../../components/ui/Page';
import { pairingActive, type ChildProfile, type PairingInfo } from '../../data/children';
import { issueCode, revokeAndReissue } from '../../data/pairing';
import { toArabicDigits } from '../../lib/arabicDigits';
import { cx } from '../../lib/cx';
import type { Route } from './+types/child-code';

export const meta: Route.MetaFunction = () => [{ title: 'رمز الربط — غَرْسة' }];

/**
 * design/v2 PairingCode (+ SNewCode as a confirmation sheet, `?new=1`). The code
 * is issued ONLY by the server; an unlinked child whose code expired gets a
 * fresh one automatically (createPairingCode returns the valid code or a new one).
 */
export default function ChildCodeRoute() {
  const { childId = '' } = useParams();
  const { children } = useParentData();
  const child = children?.find((c) => c.id === childId) ?? null;
  const content =
    children === null ? (
      <div aria-busy="true" />
    ) : child ? (
      <CodeView child={child} />
    ) : (
      <p className="m-0 text-[15px] text-text-muted">
        لم نجد بيانات هذا الابن. <Link to={paths.parent.children}>العودة إلى أبنائي</Link>
      </p>
    );
  return (
    <ParentPage
      tab={null}
      mobileDecor={false}
      desktop={<div className="mx-auto flex w-full max-w-[520px] grow flex-col">{content}</div>}
    />
  );
}

function CodeView({ child }: { child: ChildProfile }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const fresh = (location.state as { fresh?: boolean } | null)?.fresh === true;
  const [issued, setIssued] = useState<PairingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const asked = useRef(false);
  const confirmOpen = params.get('new') === '1';

  const pairing = issued ?? child.pairing;
  const needsCode = !child.linked && !pairingActive(pairing);

  useEffect(() => {
    if (!needsCode || asked.current || confirmOpen) return;
    asked.current = true;
    setBusy(true);
    issueCode(child.id)
      .then(setIssued, (e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  }, [needsCode, child.id, confirmOpen]);

  const code = pairing && (pairingActive(pairing) || child.linked) ? toArabicDigits(pairing.code) : null;

  const reissue = async () => {
    setBusy(true);
    setError(null);
    try {
      setIssued(await revokeAndReissue(child.id));
      setParams({}, { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('تعذّر النسخ — انسخ الرمز يدويًا.');
    }
  };
  const share = async () => {
    if (!code) return;
    const text = `رمز دخول ${child.name} في غَرْسة: ${code}`;
    if (navigator.share) await navigator.share({ text }).catch(() => {});
    else void copy();
  };

  if (confirmOpen) {
    return (
      <NewCodeSheet
        child={child}
        code={code}
        busy={busy}
        error={error}
        onConfirm={() => void reissue()}
        onCancel={() =>
          fresh || window.history.length <= 1 ? setParams({}, { replace: true }) : navigate(-1)
        }
      />
    );
  }

  return (
    <div className="relative flex grow flex-col items-center gap-[20px] px-[4px] pt-[18px] pb-[4px]">
      <Blob className="-top-[196px] -right-[160px] h-[400px] w-[400px] bg-blob-green-strong" />
      <div className="z-1 flex w-full">
        <BackButton to={paths.parent.children} small />
      </div>
      <div className="relative z-1 animate-[gh-pop-4_0.6s_ease_both]">
        <svg width="104" height="104" viewBox="0 0 76 76" fill="none" aria-hidden="true">
          <circle cx="38" cy="38" r="36" fill={C.greenTint} />
          <path d="M38 62 V32" stroke={C.deepGreen} strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="38" cy="26" r="13" fill={C.primary} />
          <circle cx="25" cy="35" r="8.5" fill={C.softGreen} />
          <circle cx="51" cy="35" r="8.5" fill={C.softGreen} />
          <circle cx="31" cy="21" r="3.2" fill={C.gold} />
          <circle cx="46" cy="30" r="2.6" fill={C.gold} />
        </svg>
        {fresh && (
          <span
            className="absolute bottom-[2px] left-0 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-deep-green"
            aria-hidden="true"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12.5 L10 17.5 L19 7"
                stroke={C.surface}
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
      </div>
      <div className="z-1 flex flex-col items-center gap-[8px]">
        <h1 className="m-0 text-center font-heading text-[27px] leading-[1.5] font-bold">
          {fresh ? `تمت إضافة ${child.name}` : `رمز الربط — ${child.name}`}
        </h1>
        <p className="m-0 max-w-[280px] text-center text-[14.5px] leading-[1.8] text-text-muted">
          أعطِ هذا الرمز لطفلك ليدخل به في تطبيق غَرْسة للأطفال.
        </p>
      </div>
      <div className="z-1 flex w-full flex-col items-center gap-[16px] rounded-px-28 bg-surface px-[18px] py-[24px] shadow-pairing-card">
        <span className="text-[13px] font-bold text-text-muted">رمز الربط</span>
        <div
          className="flex gap-[8px] [direction:ltr]"
          aria-live="polite"
          aria-busy={busy}
          aria-label={code ? `رمز الربط ${code}` : 'جارٍ إصدار الرمز'}
        >
          {Array.from({ length: 6 }, (_, i) => {
            const d = code ? [...code][i] : '';
            return (
              <span
                key={i}
                className={cx(
                  'flex h-[62px] w-[46px] items-center justify-center rounded-px-16 border-[1.5px] font-heading text-[30px] font-extrabold',
                  i < 3
                    ? 'border-seed-dots bg-green-tint text-deep-green'
                    : 'border-gold-border bg-gold-tint text-warning-text',
                )}
              >
                {d}
              </span>
            );
          })}
        </div>
        <div className="flex w-full gap-[10px]">
          <button
            type="button"
            disabled={!code}
            onClick={() => void copy()}
            className="flex h-[52px] grow items-center justify-center gap-[8px] rounded-px-18 border-[1.5px] border-deep-green bg-surface font-body text-[15.5px] font-bold text-deep-green disabled:opacity-60"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="8.5" y="3.5" width="12" height="14" rx="3.5" stroke={C.deepGreen} strokeWidth="1.9" />
              <path
                d="M15.5 20.5 H7 C5.3 20.5 4 19.2 4 17.5 V8"
                stroke={C.deepGreen}
                strokeWidth="1.9"
                strokeLinecap="round"
              />
            </svg>
            <span aria-live="polite">{copied ? 'نُسخ' : 'انسخ'}</span>
          </button>
          <button
            type="button"
            disabled={!code}
            onClick={() => void share()}
            className="flex h-[52px] grow items-center justify-center gap-[8px] rounded-px-18 border-0 bg-deep-green font-body text-[15.5px] font-bold text-surface disabled:opacity-60"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 16 V4 M12 4 L8 8 M12 4 L16 8"
                stroke={C.surface}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M5 14 V18 C5 19.1 5.9 20 7 20 H17 C18.1 20 19 19.1 19 18 V14"
                stroke={C.surface}
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            شارك
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="z-1 m-0 flex items-center gap-[7px] text-[13px] font-bold text-error-text">
          <AlertIcon />
          {error}
        </p>
      )}
      <div className="z-1 flex items-start gap-[10px] rounded-px-20 bg-border-soft px-[16px] py-[15px]">
        <svg
          className="mt-[2px] shrink-0"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 3.5 L19.5 6.5 V12 C19.5 16.2 16.4 19.4 12 20.5 C7.6 19.4 4.5 16.2 4.5 12 V6.5 Z"
            stroke={C.warningText}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M12 10 V15" stroke={C.warningText} strokeWidth="1.9" strokeLinecap="round" />
        </svg>
        <p className="m-0 text-[12.5px] leading-[1.85] text-on-gold">
          لا ينشئ طفلك حسابًا ولا يُدخل بريدًا أو كلمة مرور — الرمز وحده يربط تطبيقه بحسابك. تجده دائمًا في
          بطاقة الابن داخل تبويب «أبنائي».
        </p>
      </div>
      <div className="z-1 mt-auto flex w-full flex-col gap-[12px]">
        <Link to={paths.parent.dashboard(child.id)} className={buttonClass('primary', 'lg', 'gap-[9px]')}>
          تم — إلى لوحة التحكم
          <ForwardIcon size={20} />
        </Link>
        <div className="flex gap-[10px]">
          <button
            type="button"
            onClick={() => setParams({ new: '1' }, { state: location.state })}
            className="flex h-[50px] grow basis-0 items-center justify-center gap-[8px] rounded-px-18 border-[1.5px] border-input-border bg-surface font-body text-[14.5px] font-extrabold text-deep-green"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M20 12 C20 16.4 16.4 20 12 20 C7.6 20 4 16.4 4 12 C4 7.6 7.6 4 12 4 C14.9 4 17.4 5.5 18.8 7.8"
                stroke={C.deepGreen}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M19.4 4 V8.2 H15.2"
                stroke={C.deepGreen}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            إصدار رمز جديد
          </button>
          <Link
            to={paths.parent.addChild}
            className="flex h-[50px] grow basis-0 items-center justify-center rounded-px-18 bg-transparent text-[14.5px] font-extrabold text-deep-green no-underline"
          >
            إضافة ابن آخر
          </Link>
        </div>
      </div>
    </div>
  );
}

/** design/v2 SNewCode — the current code dimmed behind a confirmation sheet. */
function NewCodeSheet({
  child,
  code,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  child: ChildProfile;
  code: string | null;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="relative flex grow flex-col gap-[14px]">
      <Blob className="-bottom-[166px] -left-[130px] h-[330px] w-[330px] bg-blob-gold-strong" />
      <div className="z-1 flex shrink-0 items-center gap-[12px] opacity-[0.45]" aria-hidden="true">
        <span className="flex h-[46px] w-[46px] items-center justify-center rounded-px-16 border border-border bg-surface">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 5 L16 12 L9 19"
              stroke={C.textDark}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="font-heading text-[21px] font-bold">رمز الربط — {child.name}</span>
      </div>
      <div
        className="z-1 flex shrink-0 flex-col items-center gap-[12px] rounded-px-26 border-[1.5px] border-border bg-surface px-[18px] py-[22px] opacity-[0.45]"
        aria-hidden="true"
      >
        <span className="text-[13.5px] font-bold text-text-muted">الرمز الحالي</span>
        <div className="flex gap-[7px] [direction:ltr]">
          {Array.from({ length: 6 }, (_, i) => (
            <span
              key={i}
              className="flex h-[56px] w-[42px] items-center justify-center rounded-px-15 bg-green-tint font-heading text-[24px] font-extrabold text-deep-green"
            >
              {code ? [...code][i] : ''}
            </span>
          ))}
        </div>
      </div>
      <div className="grow" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="new-code-title"
        aria-describedby="new-code-desc"
        className="z-1 flex shrink-0 animate-[gh-rise_.35s_ease-out_both] flex-col gap-[16px] rounded-px-30 border-[1.5px] border-border bg-surface px-[22px] pt-[26px] pb-[22px] shadow-dark-up-10-40-10"
      >
        <span className="h-[5px] w-[44px] self-center rounded-px-3 bg-input-border" aria-hidden="true" />
        <div className="flex items-start gap-[14px]">
          <span
            className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-px-18 bg-gold-tint"
            aria-hidden="true"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M4.5 12 A7.5 7.5 0 1 1 7.4 17.9"
                stroke={C.ayahBracket}
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <path
                d="M4.5 7 V12 H9.5"
                stroke={C.ayahBracket}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="flex flex-col gap-[8px]">
            <h1 id="new-code-title" className="m-0 font-heading text-[24px] font-bold text-text-dark">
              إصدار رمز جديد؟
            </h1>
            <span id="new-code-desc" className="text-[14.5px] leading-[1.95] text-text-muted">
              سيتوقّف الرمز الحالي فورًا.
            </span>
          </span>
        </div>
        <div className="flex items-start gap-[11px] rounded-px-20 border-[1.5px] border-berry-border bg-berry-tint px-[15px] py-[14px]">
          <AlertIcon size={20} />
          <span className="text-[13.5px] leading-[1.85] font-bold text-error-text">
            سيُفصل الجهاز المرتبط حاليًا، وسيحتاج ابنك إدخال الرمز الجديد لمتابعة حصصه.
          </span>
        </div>
        {error && (
          <p role="alert" className="m-0 text-[13px] font-bold text-error-text">
            {error}
          </p>
        )}
        <Button
          variant="danger"
          size="custom"
          disabled={busy}
          aria-busy={busy}
          onClick={onConfirm}
          className="h-[64px] gap-[10px] rounded-px-22 border-0 font-heading text-[20px] font-bold shadow-berry-12-24-24"
        >
          إصدار رمز جديد
        </Button>
        <Button
          variant="quiet"
          size="custom"
          onClick={onCancel}
          className="h-[56px] gap-[9px] rounded-px-20 text-[15px] font-bold"
        >
          إلغاء
        </Button>
      </div>
    </div>
  );
}
