import { cx } from '../../lib/cx';
import { InfoIcon, ShieldIcon } from './icons';

export type NoteTone = 'green' | 'gold' | 'berry' | 'sky';

const TONE: Record<NoteTone, string> = {
  green: 'bg-green-tint text-text-dark',
  gold: 'bg-gold-tint text-on-gold',
  berry: 'bg-berry-tint text-error-text',
  sky: 'bg-sky-tint text-sky-text',
};

/** Tinted info note with a leading icon (03 trust note, child-code help, …). */
export function Note({
  tone = 'green',
  icon,
  children,
  className,
}: {
  tone?: NoteTone;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const defaultIcon = tone === 'green' ? <ShieldIcon /> : <InfoIcon />;
  return (
    <div
      className={cx('flex items-start gap-[10px] rounded-px-18 px-[16px] py-[14px]', TONE[tone], className)}
    >
      <span className="mt-[2px] shrink-0">{icon ?? defaultIcon}</span>
      <p className="m-0 text-[12.5px] leading-[1.75]">{children}</p>
    </div>
  );
}
