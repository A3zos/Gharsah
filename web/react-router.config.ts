import type { Config } from '@react-router/dev/config';

// SPA (no server) with the landing page prerendered to static HTML for SEO and
// a fast first paint. Every other route is served by build/client/__spa-fallback.html
// (Firebase Hosting rewrites it in Phase 5).
export default {
  appDirectory: 'src',
  ssr: false,
  prerender: ['/'],
} satisfies Config;
