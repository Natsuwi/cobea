import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { appVersionPlugin, createBuildId } from './src/lib/viteAppVersionPlugin';

const buildId = createBuildId();

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      appVersionPlugin(buildId),
      VitePWA({
        registerType: 'prompt',
        includeAssets: [
          'logo/CobeaLogo.svg',
          'pwa/apple-touch-icon.png',
          'drawing_tool/*.png',
        ],
        manifest: {
          name: 'Cobea',
          short_name: 'Cobea',
          description: 'Galerie zen — images, notes et moodboards',
          lang: 'fr',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'any',
          background_color: '#0a0a0b',
          theme_color: '#970BF5',
          categories: ['productivity', 'photo'],
          icons: [
            {
              src: '/pwa/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa/icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // App shell + hashed assets
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2,json}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              // Never cache API / auth / media blobs through the SW
              urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
              handler: 'NetworkOnly',
            },
            {
              urlPattern: ({ url }) => url.pathname === '/version.json',
              handler: 'NetworkOnly',
            },
            {
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'cobea-images',
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: 'http://localhost:3847',
          changeOrigin: true,
        },
      },
    },
  };
});
