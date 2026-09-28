// A confirmation bottom sheet in the style of design/v3 ExitConfirm (scrim +
// sheet with handle, icon, title, body, primary and quiet actions). Used for
// «تخرج من الحصة؟», sign-out, removing a child, and leaving unsaved forms.
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { cx } from '../../lib/cx';
import { buttonClass } from './Button';

export function ConfirmSheet({
  open,
  title,
  body,
  icon,
  confirmLabel,
  cancelLabel = 'إلغاء',
  danger,
  busy,
  onConfirm,
  onCancel,
  onDismiss = onCancel,
  children,
  footnote,
}: {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  icon?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Escape / scrim tap (defaults to onCancel; ExitConfirm dismisses to «أكمل الحصة»). */
  onDismiss?: () => void;
  children?: React.ReactNode;
  footnote?: string;
}) {
  const titleId = useId();
  const bodyId = useId();
  const sheet = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    sheet.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
      if (e.key !== 'Tab' || !sheet.current) return;
      const f = [...sheet.current.querySelectorAll<HTMLElement>('button, a[href]')];
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
      lastFocus.current?.focus?.();
    };
  }, [open, onDismiss]);

  if (!open) return null;
  // Portaled to <body>: a sheet opened from a sticky/positioned parent (e.g. the
  // parent sidebar's sign-out) would otherwise be trapped in that stacking
  // context and render under the page's cards.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="presentation">
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onDismiss}
        className="absolute inset-0 animate-[gh-fade_.3s_ease-out_both] border-0 bg-lesson-scrim"
      />
      <div
        ref={sheet}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={body ? bodyId : undefined}
        className="relative z-2 flex w-full max-w-[560px] animate-[gh-sheet_.34s_ease-out_.06s_both] flex-col gap-[16px] rounded-t-px-34 bg-surface px-[22px] pt-[14px] pb-[calc(30px+env(safe-area-inset-bottom))]"
      >
        <span className="h-[5px] w-[52px] self-center rounded-px-3 bg-input-border" aria-hidden="true" />
        {icon && (
          <span
            className={cx(
              'mt-[6px] flex h-[68px] w-[68px] items-center justify-center self-center rounded-px-24',
              danger ? 'bg-berry-tint' : 'bg-gold-tint',
            )}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <h2 id={titleId} className="m-0 text-center font-heading text-[27px] leading-[1.45] font-bold">
          {title}
        </h2>
        {body && (
          <p id={bodyId} className="m-0 text-center text-[15.5px] leading-[1.85] text-text-muted">
            {body}
          </p>
        )}
        {children}
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy}
          className={buttonClass(
            danger ? 'danger' : 'primary',
            'custom',
            'h-[66px] gap-[10px] rounded-px-22 border-0 font-heading text-[21px] font-bold',
          )}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={buttonClass('quiet', 'custom', 'h-[58px] rounded-px-20 text-[16.5px] font-extrabold')}
        >
          {cancelLabel}
        </button>
        {footnote && <span className="text-center text-[12px] text-text-subtle">{footnote}</span>}
      </div>
    </div>,
    document.body,
  );
}
