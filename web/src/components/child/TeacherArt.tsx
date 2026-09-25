// The teacher (white thobe + cap + book) — the SAME character on the landing
// page and every lesson frame (CLAUDE.md §5). Pure SVG art; the live states
// (glow, lean, opacity) are applied by TeacherCharacter around it.
import { C } from '../ui/color';

export interface TeacherArtProps {
  size?: number;
  eyes?: 'open' | 'happy';
  /** Open-eye height (the lesson frames squint slightly while listening). */
  eyeRy?: number;
  mouth?: 'open' | 'shut';
  /** Sound arcs beside the head: none (quiet), single (landing), double (speaking). */
  arcs?: 'none' | 'single' | 'double';
  /** The lesson frames' finer details (collar, cap line, book pages, eye shine). */
  detailed?: boolean;
}

export function TeacherArt({
  size = 180,
  eyes = 'open',
  eyeRy = 10,
  mouth = 'open',
  arcs = 'none',
  detailed = true,
}: TeacherArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <path d="M56 194 C56 154 72 134 100 134 C128 134 144 154 144 194 Z" fill={C.surface} />
      <path d="M56 194 C56 164 64 146 78 138 C70 152 66 172 66 194 Z" fill={C.teacherShade} />
      {detailed && (
        <path
          d="M88 138 L100 154 L112 138"
          stroke={C.teacherCollar}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <ellipse cx="100" cy="132" rx="13" ry="11" fill={C.teacherNeck} />
      <ellipse cx="56" cy="94" rx="7" ry="9.5" fill={C.teacherSkin} />
      <ellipse cx="144" cy="94" rx="7" ry="9.5" fill={C.teacherSkin} />
      <ellipse cx="100" cy="90" rx="44" ry="46" fill={C.teacherSkin} />
      <path
        d="M62 100 C62 138 80 154 100 154 C120 154 138 138 138 100 C130 122 116 128 100 128 C84 128 70 122 62 100 Z"
        fill={C.teacherBeard}
      />
      <path d="M56 78 C56 46 76 28 100 28 C124 28 144 46 144 78 C124 68 76 68 56 78 Z" fill={C.surface} />
      <path
        d="M54 78 C76 67 124 67 146 78 C146 87 141 91 135 90 C114 82 86 82 65 90 C59 91 54 87 54 78 Z"
        fill={C.teacherCapBand}
      />
      {detailed && (
        <path
          d="M56 78 C56 46 76 28 100 28 C124 28 144 46 144 78"
          stroke={C.teacherCapLine}
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
      <path d="M74 82 C78 76 90 76 94 81" stroke={C.teacherBeard} strokeWidth="3.4" strokeLinecap="round" />
      <path
        d="M106 81 C110 76 122 76 126 82"
        stroke={C.teacherBeard}
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      {eyes === 'open' ? (
        <g>
          <ellipse cx="84" cy="98" rx="9" ry={eyeRy} fill={C.surface} />
          <ellipse cx="116" cy="98" rx="9" ry={eyeRy} fill={C.surface} />
          <circle cx="85" cy="100" r="5" fill={C.teacherEye} />
          <circle cx="117" cy="100" r="5" fill={C.teacherEye} />
          {detailed && (
            <>
              <circle cx="87" cy="97" r="1.8" fill={C.surface} />
              <circle cx="119" cy="97" r="1.8" fill={C.surface} />
            </>
          )}
        </g>
      ) : (
        <g>
          <path d="M75 101 C79 93 89 93 93 101" stroke={C.teacherEye} strokeWidth="4" strokeLinecap="round" />
          <path
            d="M107 101 C111 93 121 93 125 101"
            stroke={C.teacherEye}
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      )}
      <ellipse cx="68" cy="112" rx="8" ry="5.5" fill={C.berry} opacity="0.35" />
      <ellipse cx="132" cy="112" rx="8" ry="5.5" fill={C.berry} opacity="0.35" />
      {mouth === 'open' ? (
        <ellipse cx="100" cy="121" rx="9" ry="7" fill={C.teacherMouth} />
      ) : (
        <path
          d="M90 118 C94 125 106 125 110 118"
          stroke={C.teacherMouth}
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      )}
      <ellipse cx="60" cy="170" rx="14" ry="22" fill={C.surface} transform="rotate(14 60 170)" />
      {detailed && (
        <path
          d="M46 168 C46 158 52 150 60 148"
          stroke={C.teacherCapLine}
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
      <g transform="rotate(-9 128 168)">
        <rect x="104" y="150" width="48" height="36" rx="6" fill={C.deepGreen} />
        <rect x="108" y="154" width="40" height="28" rx="4" fill={C.hadithPlaceholderBg} />
        {detailed && (
          <>
            <path d="M128 154 V182" stroke={C.borderStrong} strokeWidth="2" />
            <path
              d="M114 162 H124 M132 162 H142 M114 170 H124 M132 170 H142"
              stroke={C.avatarCream}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        )}
      </g>
      <circle cx="112" cy="186" r="9" fill={C.teacherSkin} />
      {arcs !== 'none' && (
        <g>
          <path
            d="M168 92 C176 100 176 112 168 120"
            stroke={C.gold}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path d="M32 92 C24 100 24 112 32 120" stroke={C.gold} strokeWidth="4.5" strokeLinecap="round" />
          {arcs === 'double' && (
            <>
              <path
                d="M181 82 C192 96 192 118 181 132"
                stroke={C.gold}
                strokeWidth="4.5"
                strokeLinecap="round"
                opacity="0.5"
              />
              <path
                d="M19 82 C8 96 8 118 19 132"
                stroke={C.gold}
                strokeWidth="4.5"
                strokeLinecap="round"
                opacity="0.5"
              />
            </>
          )}
        </g>
      )}
    </svg>
  );
}
