import { Link, type LinkProps } from 'react-router';

import { cx } from '../../lib/cx';

/**
 * The design's buttons. `variant` sets only colors; `size` sets the box. Frames
 * use many one-off sizes — pass size="custom" and the exact classes then.
 */
export type ButtonVariant = 'primary' | 'outline' | 'quiet' | 'gold' | 'dark' | 'text';
export type ButtonSize = 'lg' | 'md' | 'custom';

const VARIANT: Record<ButtonVariant, string> = {
  // Deep-green filled (auth, «عرض المتابعة»).
  primary: 'bg-deep-green text-surface hover:text-surface disabled:opacity-60',
  // White with a deep-green outline («إنشاء حساب» on 02).
  outline: 'bg-surface border-[1.5px] border-deep-green text-deep-green',
  // White with the input border (secondary actions).
  quiet: 'bg-surface border-[1.5px] border-input-border text-text-muted hover:text-text-muted',
  // Gold CTA («إضافة ابن», «ابدأ الحصة»).
  gold: 'bg-gold text-on-gold hover:text-on-gold',
  // Dark (Google Play badge).
  dark: 'bg-text-dark text-surface hover:text-surface',
  // Text-only link button.
  text: 'bg-transparent text-deep-green',
};

const SIZE: Record<ButtonSize, string> = {
  lg: 'h-[58px] rounded-px-20 text-[17px] font-bold',
  md: 'h-[52px] rounded-px-18 text-[15.5px] font-extrabold',
  custom: '',
};

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'lg', className?: string) {
  return cx(
    'flex items-center justify-center font-body no-underline transition-opacity disabled:cursor-not-allowed',
    VARIANT[variant],
    SIZE[size],
    className,
  );
}

type Common = { variant?: ButtonVariant; size?: ButtonSize; className?: string };

export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...rest
}: Common & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}

export function ButtonLink({ variant, size, className, ...rest }: Common & LinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}
