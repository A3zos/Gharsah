import { useId, useState } from 'react';

import { cx } from '../../lib/cx';
import { C } from './color';
import { EyeIcon } from './icons';

export type FieldStatus = 'ok' | 'error';

interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  /** Inline message under the field (green when ok, berry when error). */
  message?: string;
  status?: FieldStatus;
  /** Signup's denser field (13.5px label, 56px, r19) vs. login's (14px, 58px, r20). */
  compact?: boolean;
  /** Adds the show/hide eye; `type` toggles between password and text. */
  password?: boolean;
  /** Extra content between the input and the message (e.g. strength meter). */
  below?: React.ReactNode;
  labelClassName?: string;
}

/** Labeled text input — 02–04 auth fields, ForgotPass, AddChild name. */
export function TextField({
  label,
  message,
  status,
  compact,
  password,
  below,
  labelClassName,
  id,
  className,
  dir,
  ...input
}: TextFieldProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  const msgId = `${fieldId}-msg`;
  const [shown, setShown] = useState(false);
  const hasBadge = !password && status !== undefined;
  const ltr = dir === 'ltr';

  return (
    <div className={cx('flex flex-col', compact ? 'gap-[7px]' : 'gap-[8px]')}>
      <label
        htmlFor={fieldId}
        className={cx('font-bold text-text-dark', compact ? 'text-[13.5px]' : 'text-[14px]', labelClassName)}
      >
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          id={fieldId}
          dir={dir}
          type={password ? (shown ? 'text' : 'password') : input.type}
          aria-invalid={status === 'error' || undefined}
          aria-describedby={message ? msgId : undefined}
          className={cx(
            'w-full border-[1.5px] bg-surface font-body text-[16px] text-text-dark placeholder:text-placeholder',
            compact ? 'h-[56px] rounded-px-19' : 'h-[58px] rounded-px-20',
            status === 'ok' ? 'border-primary' : status === 'error' ? 'border-berry' : 'border-input-border',
            password ? 'pr-[18px] pl-[58px]' : hasBadge ? 'pr-[18px] pl-[52px]' : 'px-[18px]',
            ltr && 'text-left',
            className,
          )}
          {...input}
        />
        {password && (
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-label={shown ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            className="absolute left-[8px] flex h-[44px] w-[44px] items-center justify-center rounded-px-14 border-0 bg-transparent"
          >
            <EyeIcon open={shown} />
          </button>
        )}
        {hasBadge && <StatusBadge status={status} />}
      </div>
      {below}
      {message && (
        <span
          id={msgId}
          className={cx(
            'text-[12.5px] font-medium',
            status === 'error' ? 'text-error-text' : status === 'ok' ? 'text-deep-green' : 'text-text-muted',
          )}
        >
          {message}
        </span>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: FieldStatus }) {
  return status === 'ok' ? (
    <span className="absolute left-[16px] flex h-[24px] w-[24px] items-center justify-center rounded-full bg-primary">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 12.5 L10 17.5 L19 7"
          stroke={C.surface}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  ) : (
    <span className="absolute left-[16px] flex h-[24px] w-[24px] items-center justify-center rounded-full bg-berry-tint">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 6 V13.5" stroke={C.errorText} strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="12" cy="18" r="1.6" fill={C.errorText} />
      </svg>
    </span>
  );
}
