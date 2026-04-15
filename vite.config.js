import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/BibleBookFinder/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Bible Book Finder',
        short_name: 'BibleFinder',
        description: 'Learn where Bible books are located — interactive quiz game',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'any',
        icons: [
          {
            src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="32" fill="%231a1a2e"/><rect x="24" y="24" width="144" height="144" rx="16" fill="%236c63ff"/><text x="96" y="120" text-anchor="middle" fill="white" font-family="system-ui" font-size="80" font-weight="bold">BB</text></svg>',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="64" fill="%231a1a2e"/><rect x="64" y="64" width="384" height="384" rx="48" fill="%236c63ff"/><text x="256" y="300" text-anchor="middle" fill="white" font-family="system-ui" font-size="200" font-weight="bold">BB</text></svg>',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any'
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
