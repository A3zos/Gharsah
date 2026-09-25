import { cx } from '../../lib/cx';

/**
 * A 390-wide mobile frame as a real page: full width on phones, centered (max
 * 560, CLAUDE.md §4) on larger screens, at least the viewport tall, safe areas
 * respected. Decorative blobs are passed as `decor` and clipped to the page.
 */
export function MobilePage({
  children,
  decor,
  className,
  innerClassName,
  as: Tag = 'main',
}: {
  children: React.ReactNode;
  decor?: React.ReactNode;
  className?: string;
  innerClassName?: string;
  as?: 'main' | 'div';
}) {
  return (
    <div
      className={cx(
        'relative min-h-dvh overflow-hidden bg-background pb-[env(safe-area-inset-bottom)] text-text-dark',
        className,
      )}
    >
      {decor}
      <Tag
        className={cx('relative z-1 mx-auto flex min-h-dvh w-full max-w-[560px] flex-col', innerClassName)}
      >
        {children}
      </Tag>
    </div>
  );
}

/** A soft decorative circle (the frames' translucent corner blobs). */
export function Blob({ className }: { className: string }) {
  return <div aria-hidden="true" className={cx('pointer-events-none absolute rounded-full', className)} />;
}
