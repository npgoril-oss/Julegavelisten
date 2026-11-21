import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Versjon som vises i appen, så man kan se om telefonen har siste utgave.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const commit = (env.GITHUB_SHA ?? 'lokal').slice(0, 7);

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(commit),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Julegavelisten',
        short_name: 'Julegaver',
        description: 'Hold oversikt over julegaver, budsjett og hva som er kjøpt.',
        lang: 'nb',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f7f5f0',
        theme_color: '#14452f',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
      },
    }),
  ],
});
