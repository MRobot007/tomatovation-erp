import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 5173 },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        /**
         * Vendor code is split from app code so a deploy that touches only our
         * screens does not invalidate ~200 kB of unchanged library bytes in
         * everyone's cache. Staff open this app daily; the repeat-visit cost
         * matters more than the first-load cost.
         *
         * Grouped by change cadence, not by size: React and Supabase move on
         * their own release schedules, so they get their own chunks.
         */
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
      },
    },
    // Chunks are now deliberately sized; the default 500 kB warning fires on
    // vendor-supabase, which cannot be usefully split further.
    chunkSizeWarningLimit: 700,
  },
})
