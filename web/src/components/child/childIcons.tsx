// Icons of the child app's three sections (StudentHome shortcuts, ReviewList).
import { C } from '../ui/color';

export function QuranIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 5.5 C6.5 4.2 9.5 4.2 12 5.8 C14.5 4.2 17.5 4.2 20 5.5 V18.5 C17.5 17.2 14.5 17.2 12 18.8 C9.5 17.2 6.5 17.2 4 18.5 Z"
        stroke={C.deepGreen}
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M12 5.8 V18.8" stroke={C.deepGreen} strokeWidth="1.9" />
    </svg>
  );
}

export function HadithIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M7 4 H17 C18.7 4 20 5.3 20 7 V20 H9.5 C8 20 7 18.8 7 17.3 Z"
        stroke={C.berryDeep}
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M7 4 C5.3 4 4 5.3 4 7 C4 8.2 4.9 9 6 9 H7"
        stroke={C.berryDeep}
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 9.5 H16.5 M10.5 13 H16.5 M10.5 16.5 H14"
        stroke={C.berryDeep}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ProjectIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 13.5 V8.5" stroke={C.deepGreen} strokeWidth="2" strokeLinecap="round" />
      <path d="M12 10.5 C9 10.5 7.2 8.8 7.2 6 C10.2 6 12 7.7 12 10.5 Z" fill={C.primary} />
      <path d="M12 12 C15 12 16.8 10.3 16.8 7.5 C13.8 7.5 12 9.2 12 12 Z" fill={C.softGreen} />
      <path
        d="M3.5 15 C6 13.6 8.5 14.6 9.6 16.2 H14.4 C15.5 14.6 18 13.6 20.5 15 C19.4 18.6 16.2 20.5 12 20.5 C7.8 20.5 4.6 18.6 3.5 15 Z"
        fill={C.gold}
      />
    </svg>
  );
}
