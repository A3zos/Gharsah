// design/v2 ParentalGate — before any parent area (CLAUDE.md §3.2, Designed for
// Families): type the two-digit number written in words. Passing is remembered
// for this browser tab only (sessionStorage); it is friction, not security.
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { paths } from '../../app/paths';
import { cx } from '../../lib/cx';
import { toArabicDigits } from '../../lib/arabicDigits';
import { BackButton } from '../ui/BackButton';
import { C } from '../ui/color';
import { MobilePage, Blob } from '../ui/Page';

const KEY = 'gh.parentGate';
const UNITS = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];

/** 21–99, not a multiple of ten: «سبعة وأربعون». */
export function numberInWords(n: number): string {
  return `${UNITS[n % 10]} و${TENS[Math.floor(n / 10)]}`;
}

function randomNumber(): number {
  let n = 0;
  while (n % 10 === 0) n = 21 + Math.floor(Math.random() * 79);
  return n;
}

function passed(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function ParentalGate({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(passed);
  if (open) return <>{children}</>;
  return (
    <Gate
      onPass={() => {
        try {
          sessionStorage.setItem(KEY, '1');
        } catch {
          // Private mode: the gate simply shows again next time.
        }
        setOpen(true);
      }}
    />
  );
}

function Gate({ onPass }: { onPass: () => void }) {
  const navigate = useNavigate();
  const [target, setTarget] = useState(randomNumber);
  const [digits, setDigits] = useState<number[]>([]);
  const [wrong, setWrong] = useState(false);

  const press = (d: number) => {
    setWrong(false);
    setDigits((cur) => (cur.length >= 2 ? cur : [...cur, d]));
  };
  const confirm = () => {
    if (digits.length < 2) return;
    if (digits[0]! * 10 + digits[1]! === target) return onPass();
    // TODO(design): no designed wrong-answer state — clear and ask a new number.
    setWrong(true);
    setDigits([]);
    setTarget(randomNumber());
  };

  const key =
    'h-[62px] w-full rounded-px-18 border-[1.5px] border-input-border bg-surface font-heading text-[24px] font-extrabold text-text-dark';
  return (
    <MobilePage
      decor={<Blob className="-top-[160px] -left-[140px] h-[400px] w-[400px] bg-blob-green-09" />}
      innerClassName="gap-[16px] px-[20px] py-[26px]"
    >
      <div className="flex items-center gap-[12px]">
        <BackButton small onClick={() => navigate(paths.landing)} />
      </div>
      <div className="flex flex-col items-center gap-[14px] pt-[6px]">
        <span
          className="flex h-[84px] w-[84px] animate-[gh-pop-2_.5s_ease-out_both] items-center justify-center rounded-full bg-green-tint"
          aria-hidden="true"
        >
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="10.5" width="14" height="9.5" rx="3" stroke={C.deepGreen} strokeWidth="2" />
            <path
              d="M8.5 10.5 V8 C8.5 6 10 4.5 12 4.5 C14 4.5 15.5 6 15.5 8 V10.5"
              stroke={C.deepGreen}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <h1 className="m-0 text-center font-heading text-[25px] leading-[1.5] font-bold">
          هذه المنطقة لوليّ الأمر
        </h1>
        <p className="m-0 max-w-[290px] text-center text-[14px] leading-[1.9] text-text-muted">
          للتأكد أنك لست الطفل، اكتب الرقم المكتوب بالحروف.
        </p>
      </div>
      <div className="flex flex-col items-center gap-[16px] rounded-px-26 border-[1.5px] border-border bg-surface px-[18px] py-[22px]">
        <span className="text-[13.5px] font-bold text-text-muted">اكتب الرقم:</span>
        <span className="font-heading text-[30px] font-bold text-deep-green">{numberInWords(target)}</span>
        <div className="flex gap-[10px] [direction:ltr]" aria-live="polite" aria-label="الرقم المكتوب">
          {[0, 1].map((i) => {
            const filled = digits[i] !== undefined;
            const current = i === digits.length;
            return (
              <span
                key={i}
                className={cx(
                  'flex h-[74px] w-[62px] items-center justify-center rounded-px-20 border-[2px] font-heading text-[32px] font-extrabold text-deep-green',
                  wrong
                    ? 'border-berry bg-surface'
                    : filled || current
                      ? 'border-primary bg-background'
                      : 'border-input-border bg-surface',
                )}
              >
                {filled ? toArabicDigits(digits[i]!) : ''}
              </span>
            );
          })}
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-[10px]">
        {[
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ].map((row) => (
          <div key={row[0]} className="flex gap-[10px]">
            {row.map((d) => (
              <span key={d} className="flex grow basis-0">
                <button type="button" className={key} onClick={() => press(d)}>
                  {toArabicDigits(d)}
                </button>
              </span>
            ))}
          </div>
        ))}
        <div className="flex gap-[10px]">
          <span className="flex grow basis-0">
            <button
              type="button"
              aria-label="مسح"
              onClick={() => setDigits((cur) => cur.slice(0, -1))}
              className="flex h-[62px] w-full items-center justify-center rounded-px-18 border-[1.5px] border-input-border bg-surface"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M9 6 H20 V18 H9 L3.5 12 Z"
                  stroke={C.textMuted}
                  strokeWidth="1.9"
                  strokeLinejoin="round"
                />
                <path
                  d="M12.5 10 L16.5 14 M16.5 10 L12.5 14"
                  stroke={C.textMuted}
                  strokeWidth="1.9"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </span>
          <span className="flex grow basis-0">
            <button type="button" className={key} onClick={() => press(0)}>
              ٠
            </button>
          </span>
          <span className="flex grow basis-0">
            <button
              type="button"
              aria-label="تأكيد"
              onClick={confirm}
              disabled={digits.length < 2}
              className="flex h-[62px] w-full items-center justify-center rounded-px-18 border-0 bg-deep-green disabled:opacity-60"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 12.5 L10 17.5 L19 7"
                  stroke={C.surface}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </span>
        </div>
      </div>
    </MobilePage>
  );
}
