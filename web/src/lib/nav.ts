import { useLocation, useNavigate } from 'react-router';

/** Only in-app destinations are followed after login (no open redirects). */
export function safeNext(params: URLSearchParams, area: 'parent' | 'child'): string | null {
  const next = params.get('next');
  return next && next.startsWith(`/${area}`) && !next.startsWith('//') ? next : null;
}

/**
 * «رجوع»: the previous in-app screen (browser history) when there is one,
 * otherwise `fallback` — so a deep link or a refresh never leaves a dead end.
 */
export function useBack(fallback: string): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    if (location.key !== 'default' && window.history.length > 1) navigate(-1);
    else navigate(fallback, { replace: true });
  };
}
