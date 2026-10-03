import { useEffect } from 'react';

/**
 * The tab title in the chosen language. The route `meta` keeps the Arabic title (the
 * prerender / first paint); this follows a switch to English / Indonesian.
 */
export function useChildTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
