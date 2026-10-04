// The child app frame (StudentHome / ChildProfile / ReviewList): one centered
// column (≤560px on every screen size) + the bottom bar (الرئيسية / اسألني / المراجعة / ملفّي).
import { paths } from '../../app/paths';
import { askEnabled } from '../../ask/AskService';
import { useI18n } from '../../i18n/i18n';
import { cx } from '../../lib/cx';
import { BottomNav } from '../ui/BottomNav';
import { C, type ColorName } from '../ui/color';
import { Blob } from '../ui/Page';
import { AskBubbleIcon } from './childIcons';

export function HomeGlyph({ color, strokeWidth = 2.3 }: { color: ColorName; strokeWidth?: number }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 11 L12 4.5 L20 11 V19 C20 19.6 19.6 20 19 20 H5 C4.4 20 4 19.6 4 19 Z"
        stroke={C[color]}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ReviewTabGlyph({
  color,
  size = 26,
  strokeWidth = 2.1,
}: {
  color: ColorName;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 12 C20 16.4 16.4 20 12 20 C7.6 20 4 16.4 4 12 C4 7.6 7.6 4 12 4 C14.9 4 17.4 5.4 18.9 7.6"
        stroke={C[color]}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d="M19.6 4 V8.2 H15.4"
        stroke={C[color]}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 8.6 V12 L14.6 13.6" stroke={C[color]} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function PersonGlyph({
  color,
  size = 26,
  strokeWidth = 2.1,
}: {
  color: ColorName;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.6" stroke={C[color]} strokeWidth={strokeWidth} />
      <path
        d="M5 19.5 C5 15.7 8.1 13.6 12 13.6 C15.9 13.6 19 15.7 19 19.5"
        stroke={C[color]}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ChildPage({
  tab,
  children,
  blob = 'home',
  className,
}: {
  tab: 'home' | 'ask' | 'review' | 'profile';
  children: React.ReactNode;
  blob?: 'home' | 'page';
  className?: string;
}) {
  const t = useI18n().m.child.nav;
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background text-text-dark">
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[500px] max-w-[560px]">
        {blob === 'home' ? (
          <Blob className="-top-[160px] -left-[130px] h-[360px] w-[360px] bg-blob-green-strong" />
        ) : (
          <Blob className="-top-[160px] -left-[140px] h-[400px] w-[400px] bg-blob-green-09" />
        )}
      </div>
      <main
        className={cx(
          'relative z-1 mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-[20px] pb-[calc(110px+env(safe-area-inset-bottom))]',
          className,
        )}
      >
        {children}
      </main>
      {/* design/v3: الرئيسية / المراجعة / ملفّي, at the parent bar's sizes. */}
      <BottomNav
        label={t.label}
        items={[
          {
            to: paths.child.home,
            label: t.home,
            active: tab === 'home',
            icon: (c) => <HomeGlyph color={c} strokeWidth={2.2} />,
          },
          ...(askEnabled()
            ? [
                {
                  to: paths.child.ask,
                  label: t.ask,
                  active: tab === 'ask',
                  icon: (c: ColorName) => <AskBubbleIcon size={26} color={C[c]} />,
                },
              ]
            : []),
          {
            to: paths.child.weeklyReview,
            label: t.review,
            active: tab === 'review',
            icon: (c) => <ReviewTabGlyph color={c} />,
          },
          {
            to: paths.child.profile,
            label: t.profile,
            active: tab === 'profile',
            icon: (c) => <PersonGlyph color={c} />,
          },
        ]}
      />
    </div>
  );
}
