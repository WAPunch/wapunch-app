import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    // Bundle analyzer - generates stats.html
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    headers: {
      // Basic dev CSP with nonce placeholder (replace in prod with middleware)
      // Allow connections to Supabase
      "Content-Security-Policy": "default-src 'self'; img-src 'self' blob: data: https://*.googleapis.com https://*.ggpht.com https://*.gstatic.com https://maps.gstatic.com https://*.google.com https://*.googleusercontent.com https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src 'self' fonts.gstatic.com; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.googleapis.com https://*.gstatic.com; connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://*.supabase.in https://*.googleapis.com https://*.gstatic.com https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com;",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['lucide-react'],
          utils: ['zustand', 'zod', 'dompurify']
        },
      },
    },
    // Generate build stats
    reportCompressedSize: true,
    // Performance budgets
    chunkSizeWarningLimit: 1000,
  },
})
