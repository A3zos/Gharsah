// Line icons from design/v2 (24×24 grid unless noted). Decorative → aria-hidden.
import { C, type ColorName } from './color';

interface IconProps {
  size?: number;
  color?: ColorName;
  strokeWidth?: number;
  className?: string;
}

function Svg({
  size = 24,
  viewBox = '0 0 24 24',
  className,
  children,
}: {
  size?: number;
  viewBox?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      aria-hidden="true"
      className={className ? `shrink-0 ${className}` : 'shrink-0'}
    >
      {children}
    </svg>
  );
}

/** The brand sprout (64-grid, no circle) — sidebar / landing header. */
export function SproutMark({ size = 36, seed = true }: { size?: number; seed?: boolean }) {
  return (
    <Svg size={size} viewBox="0 0 64 64">
      <path d="M32 56 V28" stroke={C.deepGreen} strokeWidth="5" strokeLinecap="round" />
      <path d="M32 40 C20 40 12 32 12 20 C24 20 32 28 32 40 Z" fill={C.primary} />
      <path d="M32 34 C44 34 52 26 52 14 C40 14 32 22 32 34 Z" fill={C.softGreen} />
      {seed && <circle cx="32" cy="58" r="4" fill={C.gold} />}
    </Svg>
  );
}

/** The brand sprout in its tinted circle (76-grid) — splash / auth headers. */
export function SproutBadge({ size = 66 }: { size?: number }) {
  return (
    <Svg size={size} viewBox="0 0 76 76">
      <circle cx="38" cy="38" r="36" fill={C.greenTint} />
      <path d="M38 60 V34" stroke={C.deepGreen} strokeWidth="4" strokeLinecap="round" />
      <path d="M38 40 C28 40 22 34 22 26 C32 26 38 32 38 40 Z" fill={C.primary} />
      <path d="M38 45 C48 45 54 39 54 31 C44 31 38 37 38 45 Z" fill={C.softGreen} />
      <circle cx="38" cy="62" r="4" fill={C.gold} />
    </Svg>
  );
}

/** «رجوع» — points right (RTL back). */
export function BackIcon({ size = 22, color = 'textDark', strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg size={size}>
      <path
        d="M9 5 L16 12 L9 19"
        stroke={C[color]}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Forward — points left (RTL next). */
export function ForwardIcon({ size = 19, color = 'surface', strokeWidth = 2.6, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path
        d="M15 5 L8 12 L15 19"
        stroke={C[color]}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CheckIcon({ size = 20, color = 'deepGreen', strokeWidth = 3, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path
        d="M5 12.5 L10 17.5 L19 7"
        stroke={C[color]}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PlusIcon({ size = 20, color = 'onGold', strokeWidth = 2.6 }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 5 V19 M5 12 H19" stroke={C[color]} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function EyeIcon({ size = 22, open, color = 'textMuted' }: IconProps & { open: boolean }) {
  return (
    <Svg size={size}>
      <path
        d="M2.5 12 C5 7.5 8.5 5.5 12 5.5 C15.5 5.5 19 7.5 21.5 12 C19 16.5 15.5 18.5 12 18.5 C8.5 18.5 5 16.5 2.5 12 Z"
        stroke={C[color]}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" stroke={C[color]} strokeWidth="1.8" />
      {open && <path d="M4.5 19.5 L19.5 4.5" stroke={C[color]} strokeWidth="1.8" strokeLinecap="round" />}
    </Svg>
  );
}

/** Shield with a tick — trust / privacy notes. */
export function ShieldIcon({ size = 20, color = 'deepGreen', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg size={size}>
      <path
        d="M12 3.5 L19.5 6.5 V12 C19.5 16.2 16.4 19.4 12 20.5 C7.6 19.4 4.5 16.2 4.5 12 V6.5 Z"
        stroke={C[color]}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <path
        d="M9 12 L11.2 14.2 L15 10.2"
        stroke={C[color]}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** «i» in a circle — neutral / warning notes. */
export function InfoIcon({ size = 20, color = 'warningText' }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="9.5" stroke={C[color]} strokeWidth="1.8" />
      <path d="M12 11 V16.5" stroke={C[color]} strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="7.8" r="1.3" fill={C[color]} />
    </Svg>
  );
}

/** «!» in a circle — inline errors. */
export function AlertIcon({ size = 16, color = 'errorText' }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="9.5" stroke={C[color]} strokeWidth="1.9" />
      <path d="M12 7.5 V13" stroke={C[color]} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="16.6" r="1.4" fill={C[color]} />
    </Svg>
  );
}

/** Tick in a circle — inline success. */
export function CheckCircleIcon({ size = 16, color = 'deepGreen' }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="9.5" stroke={C[color]} strokeWidth="1.9" />
      <path
        d="M7.8 12.4 L10.8 15.4 L16.2 9.4"
        stroke={C[color]}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function MicIcon({
  size = 24,
  color = 'surface',
  strokeWidth = 2.2,
  filled = true,
}: IconProps & { filled?: boolean }) {
  return (
    <Svg size={size}>
      <rect
        x="9"
        y="3"
        width="6"
        height="11"
        rx="3"
        {...(filled ? { fill: C[color] } : { stroke: C[color], strokeWidth })}
      />
      <path
        d="M5.5 11.5 C5.5 15.1 8.4 18 12 18 C15.6 18 18.5 15.1 18.5 11.5 M12 18 V21.2"
        stroke={C[color]}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Solid play triangle (Google Play / fallback play). */
export function PlayGlyph({ size = 20, color = 'surface' }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M6 3.2 L19.4 12 L6 20.8 Z" fill={C[color]} />
    </Svg>
  );
}

/** Keypad-in-a-rectangle — «دخول الطفل برمز». */
export function CodeIcon({ size = 22, color = 'deepGreen', strokeWidth = 1.9 }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="3.5" y="6" width="17" height="12" rx="3" stroke={C[color]} strokeWidth={strokeWidth} />
      <path
        d="M7.5 12 H9 M11.2 12 H12.7 M15 12 H16.5"
        stroke={C[color]}
        strokeWidth={strokeWidth + 0.3}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function BookIcon({ size = 26, color = 'deepGreen', strokeWidth = 1.9 }: IconProps) {
  return (
    <Svg size={size}>
      <path
        d="M4 5.5 C6.5 4.2 9.5 4.2 12 5.8 C14.5 4.2 17.5 4.2 20 5.5 V18.5 C17.5 17.2 14.5 17.2 12 18.8 C9.5 17.2 6.5 17.2 4 18.5 Z"
        stroke={C[color]}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <path d="M12 5.8 V18.8" stroke={C[color]} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function PersonIcon({ size = 24, color = 'deepGreen', strokeWidth = 2 }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="8.5" r="3.6" stroke={C[color]} strokeWidth={strokeWidth} />
      <path
        d="M5 19.5 C5 15.7 8.1 13.6 12 13.6 C15.9 13.6 19 15.7 19 19.5"
        stroke={C[color]}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function GearIcon({ size = 21, color = 'textMuted' }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="3.2" stroke={C[color]} strokeWidth="1.9" />
      <path
        d="M12 3 L13.4 5.4 L16.1 5 L16.6 7.7 L19 9 L17.7 11.4 L19 13.8 L16.6 15.1 L16.1 17.8 L13.4 17.4 L12 19.8 L10.6 17.4 L7.9 17.8 L7.4 15.1 L5 13.8 L6.3 11.4 L5 9 L7.4 7.7 L7.9 5 L10.6 5.4 Z"
        stroke={C[color]}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function LogoutIcon({ size = 18, color = 'textMuted' }: IconProps) {
  return (
    <Svg size={size}>
      <path
        d="M14 5 H18 C19 5 20 6 20 7 V17 C20 18 19 19 18 19 H14"
        stroke={C[color]}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M10 8 L6.5 12 L10 16 M6.5 12 H15"
        stroke={C[color]}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function GridIcon({ size = 22, color = 'textMuted' }: IconProps) {
  return (
    <Svg size={size}>
      {[
        [3.5, 3.5],
        [13, 3.5],
        [3.5, 13],
        [13, 13],
      ].map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width="7.5"
          height="7.5"
          rx="2.4"
          stroke={C[color]}
          strokeWidth="1.9"
        />
      ))}
    </Svg>
  );
}

export function ChildrenIcon({ size = 22, color = 'textMuted' }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="9" cy="8" r="3.4" stroke={C[color]} strokeWidth="1.9" />
      <path
        d="M3 19 C3 15.5 5.7 13.6 9 13.6 C12.3 13.6 15 15.5 15 19"
        stroke={C[color]}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path d="M16 13.8 C18.8 14.2 21 16 21 19" stroke={C[color]} strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="16.6" cy="8.6" r="2.8" stroke={C[color]} strokeWidth="1.9" />
    </Svg>
  );
}

export function CardIcon({ size = 22, color = 'textMuted' }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="3.5" y="6" width="17" height="12.5" rx="3" stroke={C[color]} strokeWidth="1.9" />
      <path d="M3.5 10 H20.5" stroke={C[color]} strokeWidth="1.9" />
    </Svg>
  );
}

export function ClockIcon({ size = 13, color = 'warningText' }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="8" stroke={C[color]} strokeWidth="2.4" />
      <path d="M12 8.5 V12 L14.5 13.8" stroke={C[color]} strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

export function CloseIcon({ size = 20, color = 'textDark', strokeWidth = 2.4 }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M6 6 L18 18 M18 6 L6 18" stroke={C[color]} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}
