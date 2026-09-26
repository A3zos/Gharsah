// The store badges of design/v3 (landing header/hero/download block, web plans).
// The design places the official badge images, which aren't in the export, so
// these are drawn in the same box sizes. Google Play links to VITE_PLAY_STORE_URL
// once it's set; until then (and for the App Store — no iOS app yet) the badge
// shows its «قريبًا» state and is not a link.
import { cx } from '../../lib/cx';
import { C } from './color';

const PLAY_URL = (import.meta.env.VITE_PLAY_STORE_URL as string | undefined)?.trim() || '';

/** Box sizes the design uses per placement (badge height → proportional width). */
export type BadgeSize = 44 | 50 | 56 | 68 | 72;
const WIDTH: Record<BadgeSize, [number, number]> = {
  44: [151, 127],
  50: [172, 144],
  56: [193, 161],
  68: [234, 196],
  72: [248, 207],
};

function Badge({ store, size, href }: { store: 'play' | 'apple'; size: BadgeSize; href: string }) {
  const [wPlay, wApple] = WIDTH[size];
  const w = store === 'play' ? wPlay : wApple;
  const soon = !href;
  const icon = Math.round(size * 0.46);
  const name = store === 'play' ? 'Google Play' : 'App Store';
  const body = (
    <>
      {store === 'play' ? (
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4.5 2.8 L14.2 12 L4.5 21.2 C4 20.9 3.8 20.4 3.8 19.8 V4.2 C3.8 3.6 4 3.1 4.5 2.8 Z"
            fill={C.primary}
          />
          <path d="M14.2 12 L17.3 8.9 L20.6 10.8 C21.5 11.3 21.5 12.7 20.6 13.2 L17.3 15.1 Z" fill={C.gold} />
          <path d="M4.5 2.8 C4.9 2.5 5.5 2.5 6 2.8 L17.3 8.9 L14.2 12 Z" fill={C.softGreen} />
          <path d="M4.5 21.2 L14.2 12 L17.3 15.1 L6 21.2 C5.5 21.5 4.9 21.5 4.5 21.2 Z" fill={C.berry} />
        </svg>
      ) : (
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M16.4 12.6 C16.4 10.4 18.2 9.4 18.3 9.3 C17.3 7.8 15.7 7.6 15.2 7.6 C13.8 7.5 12.6 8.4 11.9 8.4 C11.2 8.4 10.1 7.6 9 7.6 C7.5 7.7 6.1 8.5 5.4 9.8 C3.8 12.5 5 16.5 6.5 18.7 C7.3 19.8 8.2 21 9.3 21 C10.4 20.9 10.8 20.3 12.1 20.3 C13.4 20.3 13.8 21 14.9 21 C16.1 21 16.8 19.9 17.6 18.8 C18.5 17.5 18.8 16.3 18.9 16.2 C18.8 16.2 16.4 15.3 16.4 12.6 Z M14.3 6.1 C14.9 5.4 15.3 4.4 15.2 3.4 C14.3 3.4 13.3 4 12.7 4.7 C12.1 5.3 11.6 6.3 11.8 7.3 C12.7 7.4 13.7 6.8 14.3 6.1 Z"
            fill={C.surface}
          />
        </svg>
      )}
      <span className="flex flex-col items-start leading-[1.2]">
        <span style={{ fontSize: Math.max(10, Math.round(size * 0.2)) }} className="text-voice-bar-off">
          {soon ? 'قريبًا على' : store === 'play' ? 'احصل عليه من' : 'حمّله من'}
        </span>
        <span style={{ fontSize: Math.round(size * 0.31) }} className="font-extrabold" dir="ltr">
          {name}
        </span>
      </span>
    </>
  );
  const cls = cx(
    'flex shrink-0 items-center justify-center gap-[8px] rounded-px-12 bg-text-dark px-[12px] text-surface no-underline hover:text-surface',
  );
  const style = { width: w, height: size };
  const label = soon ? `غَرْسة قريبًا على ${name}` : `حمّل غَرْسة من ${name}`;
  return soon ? (
    <span role="img" aria-label={label} className={cls} style={style}>
      {body}
    </span>
  ) : (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label} className={cls} style={style}>
      {body}
    </a>
  );
}

/** Google Play + App Store, 16px apart (the design's pair). */
export function StoreBadges({ size, className }: { size: BadgeSize; className?: string }) {
  return (
    <span className={cx('flex items-center gap-[16px]', className)}>
      <Badge store="play" size={size} href={PLAY_URL} />
      <Badge store="apple" size={size} href="" />
    </span>
  );
}
