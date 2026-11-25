import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Pastelería Orión — ERP',
        short_name: 'Orión ERP',
        description:
          'Sistema ERP modular para Pastelería Orión: Inventario, Punto de Venta y Contabilidad.',
        lang: 'es-CL',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#FAF5ED',
        theme_color: '#8C1F25',
        icons: [
          {
            src: '/icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,woff,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern:
              /^https?:\/\/[^/]+\/api\/(?:health|auth|users|pos|accounting|purchases)(?:[/?#].*)?$/i,
            handler: 'NetworkOnly',
            method: 'GET',
          },
          {
            urlPattern:
              /^https?:\/\/[^/]+\/api\/(?:ingredients|recipes|products|categories|packaging|general-supplies|suppliers)(?:[/?#].*)?$/i,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'orion-api-catalog-reads',
              networkTimeoutSeconds: 2,
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 15,
              },
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
        ],
      },
    }),
  ],
  envDir: '../../',
  server: {
    host: true,
  },
})
