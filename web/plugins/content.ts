// The verified content (Quran text, recitation audio, hadith, projects, lesson
// scripts) is the repo-root content/ folder, shared with the Flutter app.
// JSON is imported through the `@content` alias; everything under content/audio/
// (recitation, and approved hadith audio once it exists) is served at /audio/* in
// dev and copied into the build — never fetched from a third party at runtime for
// the bundled surahs. Asset paths match the agent's `assetPath` (`audio/quran/…`).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

const contentDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../content');
const audioDir = path.join(contentDir, 'audio');
const AUDIO_URL = '/audio/';

/** Every .mp3 under content/audio/, as paths relative to it (`quran/112001.mp3`). */
function audioFiles(dir = audioDir, prefix = ''): string[] {
  return fs.readdirSync(dir).flatMap((name) => {
    // statSync follows links (OneDrive exposes synced folders as reparse points).
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) return audioFiles(full, `${prefix}${name}/`);
    return name.endsWith('.mp3') ? [`${prefix}${name}`] : [];
  });
}

export const contentAlias = { '@content': contentDir };

/**
 * `vite preview` behaves like Firebase Hosting will (Phase 5 rewrites): prerendered
 * pages as-is, every other extension-less path → the SPA fallback page.
 */
export function spaFallbackPreview(): Plugin {
  return {
    name: 'gharsah-spa-fallback-preview',
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = (req.url ?? '/').split('?')[0]!;
        if (req.method === 'GET' && url !== '/' && !path.extname(url)) {
          req.url = '/__spa-fallback.html';
        }
        next();
      });
    },
  };
}

export function contentAudio(): Plugin {
  return {
    name: 'gharsah-content-audio',
    configureServer(server) {
      server.middlewares.use(AUDIO_URL, (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? '').split('?')[0] ?? '').replace(/^\/+/, '');
        // Only known files: no path traversal outside content/audio/.
        if (!audioFiles().includes(rel)) return next();
        const file = path.join(audioDir, rel);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(file).pipe(res);
      });
    },
    generateBundle() {
      // Client build only (the prerender/SSR environment has no public assets).
      if (this.environment.name !== 'client') return;
      for (const rel of audioFiles()) {
        this.emitFile({
          type: 'asset',
          fileName: `${AUDIO_URL.slice(1)}${rel}`,
          source: fs.readFileSync(path.join(audioDir, rel)),
        });
      }
    },
  };
}
