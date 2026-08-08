import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { compression } from 'vite-plugin-compression2'
import { visualizer } from 'rollup-plugin-visualizer'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // Ship pre-compressed assets so the CDN/origin can serve them without
    // burning CPU per request — matters at the scale this app targets.
    compression({ algorithms: ['gzip', 'brotliCompress'], threshold: 1024 }),
    mode === 'analyze' &&
      visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true }),
  ].filter(Boolean),

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    port: 5173,
    // The .NET API is proxied in dev so the browser sees a same-origin `/api`
    // and we never fight CORS locally.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:5119',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    target: 'es2022',
    cssCodeSplit: true,
    sourcemap: mode !== 'production',
    reportCompressedSize: false,
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        // Keep the long-lived vendor code in its own cacheable chunks so a
        // product deploy doesn't invalidate React/router for every user.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-router')) return 'router'
          if (id.includes('@tanstack')) return 'query'
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('scheduler'))
            return 'react'
          return 'vendor'
        },
      },
    },
  },
}))
