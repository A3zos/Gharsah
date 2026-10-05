// A small country flag (SVG, not an emoji — emoji flags don't render on Windows):
// the leaderboard rows and the sign-up country pills. 3:2, `size` = the width.
// Saudi Arabia: the shahada is drawn as a stylised white line (not text) at this size.
import { useI18n } from '../../i18n/i18n';
import { C } from './color';

export type CountryCode = 'SA' | 'US' | 'ID';
export const COUNTRIES: readonly CountryCode[] = ['SA', 'US', 'ID'];
export const isCountryCode = (v: unknown): v is CountryCode => v === 'SA' || v === 'US' || v === 'ID';

export function FlagIcon({
  country,
  size = 18,
  decorative = false,
}: {
  country: CountryCode;
  size?: number;
  /** true when the country's name is written next to it (no second label). */
  decorative?: boolean;
}) {
  const { m } = useI18n();
  const label = decorative ? undefined : m.countries[country];
  return (
    <svg
      width={size}
      height={(size * 2) / 3}
      viewBox="0 0 30 20"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="shrink-0 rounded-[2px]"
    >
      {country === 'SA' && (
        <>
          <rect width="30" height="20" fill={C.flagSaGreen} />
          <path
            d="M8 7.6 C9.5 6.2 10.6 8.8 12 7.4 S14.6 8.6 16 7.2 S18.6 8.6 20 7.2 S21.6 8.2 22.2 7.4"
            stroke={C.surface}
            strokeWidth="1.3"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M8.5 13 H21.5 M20 12 L22 13 L20 14"
            stroke={C.surface}
            strokeWidth="1.1"
            fill="none"
            strokeLinecap="round"
          />
        </>
      )}
      {country === 'US' && (
        <>
          <rect width="30" height="20" fill={C.surface} />
          {[0, 2, 4, 6, 8, 10, 12].map((i) => (
            <rect key={i} y={(i * 20) / 13} width="30" height={20 / 13} fill={C.flagUsRed} />
          ))}
          <rect width="13" height={(20 * 7) / 13} fill={C.flagUsBlue} />
          {[2.2, 5.4, 8.6, 11.2].flatMap((x) =>
            [2.4, 5.4, 8.4].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.75" fill={C.surface} />),
          )}
        </>
      )}
      {country === 'ID' && (
        <>
          <rect width="30" height="20" fill={C.surface} />
          <rect width="30" height="10" fill={C.flagIdRed} />
        </>
      )}
      <rect
        x="0.25"
        y="0.25"
        width="29.5"
        height="19.5"
        rx="1.5"
        fill="none"
        stroke={C.flagEdge}
        strokeWidth="0.5"
      />
    </svg>
  );
}
