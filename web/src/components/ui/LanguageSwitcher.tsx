// The language switcher (content/languages.ts): a header dropdown (desktop landing),
// a globe button + bottom sheet (phone landing), and radio cards (parent settings).
// On the landing Arabic ↔ English really switch (src/i18n); Indonesian — and English
// outside the landing — shows «قريبًا» and keeps the current language.
// TODO(design): no designed language switcher yet.
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useI18n } from '../../i18n/i18n';
import { LANGUAGES, useLanguagePick, type Language, type LanguageCode } from '../../content/languages';
import { cx } from '../../lib/cx';
import { C } from './color';
import { CheckIcon } from './icons';
import { Toast } from './Toast';

const languageOf = (code: LanguageCode) => LANGUAGES.find((l) => l.code === code)!;

export function GlobeIcon({ size = 20, color = C.deepGreen }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.6" stroke={color} strokeWidth="1.9" />
      <path d="M3.6 12 H20.4" stroke={color} strokeWidth="1.9" />
      <path
        d="M12 3.4 C9.6 6 8.5 9 8.5 12 C8.5 15 9.6 18 12 20.6 C14.4 18 15.5 15 15.5 12 C15.5 9 14.4 6 12 3.4 Z"
        stroke={color}
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** «English» with lang="en", the short code beside it. */
function LanguageLabel({ l, compact }: { l: Language; compact?: boolean }) {
  return (
    <span className="flex min-w-0 grow items-center justify-between gap-[12px]">
      <span lang={l.code} className={cx('font-bold', compact ? 'text-[14.5px]' : 'text-[15.5px]')}>
        {l.name}
      </span>
      <span lang="en" className="text-[12px] font-extrabold tracking-[0.04em] text-text-muted">
        {l.short}
      </span>
    </span>
  );
}

function Mark({ on }: { on: boolean }) {
  return (
    <span
      className={cx(
        'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full',
        on ? 'bg-deep-green' : 'border-[1.5px] border-input-border bg-surface',
      )}
      aria-hidden="true"
    >
      {on && <CheckIcon size={13} color="surface" strokeWidth={3.4} />}
    </span>
  );
}

/**
 * Desktop landing header: «🌐 العربية ⌄» opening a listbox. Arrow keys / Home / End
 * move, Enter / Space choose, Esc / Tab / a click outside close.
 */
export function LanguageMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { lang, toast, pick } = useLanguagePick();
  const { m } = useI18n();
  const current = languageOf(lang);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    items.current[active]?.focus();
  }, [open, active]);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const close = (focus = true) => {
    setOpen(false);
    if (focus) button.current?.focus();
  };
  const choose = (code: LanguageCode) => {
    close();
    pick(code);
  };
  const openAt = (i: number) => {
    setActive(i);
    setOpen(true);
  };
  const onListKey = (e: React.KeyboardEvent) => {
    const n = LANGUAGES.length;
    const go = (i: number) => {
      e.preventDefault();
      setActive((i + n) % n);
    };
    if (e.key === 'ArrowDown') go(active + 1);
    else if (e.key === 'ArrowUp') go(active - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(n - 1);
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(LANGUAGES[active]!.code);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') close(false);
  };

  return (
    <div ref={root} className={cx('relative', className)}>
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${m.language.label}: ${current.name}`}
        onClick={() => (open ? close() : openAt(LANGUAGES.indexOf(current)))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            openAt(e.key === 'ArrowDown' ? 0 : LANGUAGES.length - 1);
          }
        }}
        className="flex h-[48px] cursor-pointer items-center gap-[8px] rounded-px-16 border-[1.5px] border-input-border bg-surface px-[14px] font-body text-[15px] font-extrabold whitespace-nowrap text-deep-green"
      >
        <GlobeIcon />
        <span lang={current.code}>{current.name}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={cx('transition-transform duration-200', open && 'rotate-180')}
        >
          <path
            d="M6 9.5 L12 15.5 L18 9.5"
            stroke={C.deepGreen}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={m.language.choose}
          onKeyDown={onListKey}
          className="absolute end-0 top-[calc(100%+8px)] z-40 m-0 flex w-[250px] animate-[gh-rise_.18s_ease-out_both] list-none flex-col gap-[2px] rounded-px-20 border-[1.5px] border-border bg-surface p-[6px] shadow-dark-14-28-8"
        >
          {LANGUAGES.map((l, i) => {
            const on = l.code === lang;
            return (
              <li
                key={l.code}
                ref={(el) => {
                  items.current[i] = el;
                }}
                role="option"
                aria-selected={on}
                tabIndex={i === active ? 0 : -1}
                onClick={() => choose(l.code)}
                onMouseEnter={() => setActive(i)}
                className={cx(
                  'flex cursor-pointer items-center gap-[12px] rounded-px-14 px-[12px] py-[11px] outline-none',
                  i === active && 'bg-background',
                  'focus-visible:ring-[2px] focus-visible:ring-primary',
                )}
              >
                <Mark on={on} />
                <LanguageLabel l={l} compact />
              </li>
            );
          })}
        </ul>
      )}
      <Toast message={toast} icon={<GlobeIcon size={16} color={C.surface} />} />
    </div>
  );
}

/** The three languages as radio cards (settings, the bottom sheet); the current one checked. */
export function LanguageCards({
  onPick,
  autoFocus,
}: {
  onPick: (code: LanguageCode) => void;
  autoFocus?: boolean;
}) {
  const name = useId();
  const { lang, m } = useI18n();
  return (
    <div role="radiogroup" aria-label={m.language.label} className="flex flex-col gap-[10px]">
      {LANGUAGES.map((l) => {
        const on = l.code === lang;
        return (
          <label
            key={l.code}
            className={cx(
              'flex min-h-[56px] cursor-pointer items-center gap-[12px] rounded-px-18 px-[16px] py-[12px] has-[:focus-visible]:ring-[2px] has-[:focus-visible]:ring-primary',
              on ? 'border-[2px] border-deep-green bg-green-tint' : 'border-[1.5px] border-border bg-surface',
            )}
          >
            <input
              type="radio"
              name={name}
              value={l.code}
              checked={on}
              autoFocus={autoFocus && on}
              // checked follows the language, not the click: a «قريبًا» choice stays unchecked
              // (arrow keys in a radio group fire click too)
              readOnly
              onClick={() => onPick(l.code)}
              className="sr-only"
            />
            <Mark on={on} />
            <LanguageLabel l={l} />
          </label>
        );
      })}
    </div>
  );
}

/** «اللغة» in the parent settings: the radio cards + the «قريبًا» toast. */
export function LanguageSettings() {
  const { toast, pick } = useLanguagePick();
  return (
    <>
      <div className="p-[14px]">
        <LanguageCards onPick={pick} />
      </div>
      <Toast message={toast} icon={<GlobeIcon size={16} color={C.surface} />} />
    </>
  );
}

/** Phone landing header: a globe button opening a bottom sheet with the three languages. */
export function LanguageSheetButton() {
  const [open, setOpen] = useState(false);
  const { lang, toast, pick } = useLanguagePick();
  const { m } = useI18n();
  const current = languageOf(lang);
  const titleId = useId();
  const sheet = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const back = button.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key !== 'Tab' || !sheet.current) return;
      // keep Tab inside the sheet
      const f = [...sheet.current.querySelectorAll<HTMLElement>('button, input:checked')];
      if (!f.length) return;
      const first = f[0]!;
      const last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      back?.focus();
    };
  }, [open]);

  const choose = (code: LanguageCode) => {
    if (code === lang) return setOpen(false);
    setOpen(false);
    pick(code);
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${m.language.label}: ${current.name}`}
        onClick={() => setOpen(true)}
        className="flex h-[40px] w-[40px] shrink-0 cursor-pointer items-center justify-center rounded-px-14 border-[1.5px] border-input-border bg-surface p-0"
      >
        <GlobeIcon size={19} />
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center" role="presentation">
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="absolute inset-0 animate-[gh-fade_.3s_ease-out_both] border-0 bg-lesson-scrim"
            />
            <div
              ref={sheet}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="relative z-2 flex w-full max-w-[560px] animate-[gh-sheet_.34s_ease-out_.06s_both] flex-col gap-[16px] rounded-t-px-34 bg-surface px-[22px] pt-[14px] pb-[calc(26px+env(safe-area-inset-bottom))]"
            >
              <span
                className="h-[5px] w-[52px] self-center rounded-px-3 bg-input-border"
                aria-hidden="true"
              />
              <div className="flex items-center justify-between gap-[12px]">
                <h2
                  id={titleId}
                  className="m-0 flex items-center gap-[9px] font-heading text-[22px] font-bold"
                >
                  <GlobeIcon size={22} />
                  {m.language.label}
                </h2>
                <button
                  type="button"
                  aria-label={m.language.close}
                  onClick={() => setOpen(false)}
                  className="flex h-[44px] w-[44px] cursor-pointer items-center justify-center rounded-full border-0 bg-background p-0"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5"
                      stroke={C.textDark}
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
              <LanguageCards onPick={choose} autoFocus />
            </div>
          </div>,
          document.body,
        )}
      <Toast message={toast} icon={<GlobeIcon size={16} color={C.surface} />} />
    </>
  );
}
