import { useEffect } from 'react';
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';

import type { Route } from './+types/root';
import { PendingDesign } from './components/PendingDesign';
import { tokens } from './styles/tokens.generated';
import './styles/app.css';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content={tokens.colors.background} />
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  useStaleCodeReload();
  return <Outlet />;
}

/**
 * A tab left open across a deploy asks for code chunks that no longer exist (404 —
 * see public/404.html). Mixing old and new code can freeze a lesson, so reload once
 * to the new version (at most once a minute, so a real outage can't loop).
 */
function useStaleCodeReload() {
  useEffect(() => {
    const KEY = 'gharsah.staleReloadAt';
    const reload = (e: Event) => {
      try {
        const last = Number(sessionStorage.getItem(KEY) ?? 0);
        if (Date.now() - last < 60_000) return;
        sessionStorage.setItem(KEY, String(Date.now()));
      } catch {
        // storage blocked — still reload once
      }
      e.preventDefault();
      console.info('[lesson] - stale code chunk → reloading to the new version');
      window.location.reload();
    };
    window.addEventListener('vite:preloadError', reload);
    return () => window.removeEventListener('vite:preloadError', reload);
  }, []);
}

/** Shown while a non-prerendered route's client code loads (SPA fallback). */
export function HydrateFallback() {
  return <div className="min-h-dvh bg-background" aria-busy="true" />;
}

// TODO(design): no designed error / not-found screen yet.
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  if (!notFound) console.error(error);
  return <PendingDesign name={notFound ? 'الصفحة غير موجودة' : 'حدث خطأ غير متوقع'} />;
}
