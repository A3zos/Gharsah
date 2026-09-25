import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import { contentAlias, contentAudio, spaFallbackPreview } from './plugins/content.ts';

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), contentAudio(), spaFallbackPreview()],
  resolve: { alias: contentAlias },
  server: {
    // The shared content lives outside web/.
    fs: { allow: ['..'] },
  },
});
