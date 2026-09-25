import { useSyncExternalStore } from 'react';

/** Layout breakpoints (task spec): desktop ≥1024, tablet 768–1023, phone <768. */
export const DESKTOP = '(min-width: 1024px)';
export const TABLET = '(min-width: 768px) and (max-width: 1023.98px)';

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export type Layout = 'desktop' | 'tablet' | 'phone';

export function useLayout(): Layout {
  const desktop = useMedia(DESKTOP);
  const tablet = useMedia(TABLET);
  return desktop ? 'desktop' : tablet ? 'tablet' : 'phone';
}
