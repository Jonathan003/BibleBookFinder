import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'child_process';

// Build-time version stamps. Read from git so the values reflect the
// commit that was built — works for both local `npm run dev` and the
// GitHub Actions CI build (which has full git history available).
//
// If git isn't available (e.g. building from a tarball), fall back to
// 'unknown' rather than failing the build. The version display in-app
// gracefully handles this.
function getGitCommitHash() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

function getBuildDate() {
  // ISO date (YYYY-MM-DD) of when the commit was made. We use the commit
  // date rather than the wall-clock build time so two builds of the same
  // commit produce identical version strings.
  try {
    return execSync('git log -1 --format=%cd --date=short').toString().trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  base: '/BibleBookFinder/',
  define: {
    // Exposed in source as __APP_COMMIT__ / __APP_BUILD_DATE__. Wrapped in
    // JSON.stringify because Vite's `define` does literal string
    // substitution, not value substitution.
    __APP_COMMIT__: JSON.stringify(getGitCommitHash()),
    __APP_BUILD_DATE__: JSON.stringify(getBuildDate()),
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt' instead of 'autoUpdate': we want to show a banner asking
      // the user before reloading, so their session/state isn't disrupted
      // mid-action. The useRegisterSW hook surfaces `needRefresh` state
      // when a new service worker is waiting, which we wire up to an
      // update banner. This is the standard vite-plugin-pwa pattern for
      // user-controlled updates.
      registerType: 'prompt',
      manifest: {
        name: 'Bible Book Finder',
        short_name: 'BibleFinder',
        description: 'Learn where Bible books are located — interactive quiz game',
        theme_color: '#7C3AED',
        background_color: '#f5f5f5',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'any',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      devOptions: {
        enabled: true
      }
    })
  ]
});
