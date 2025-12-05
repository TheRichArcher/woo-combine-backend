import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    copyPublicDir: true,
    // Disable Vite cache during build
    emptyOutDir: true,
    // Optimize bundle splitting
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        chunkFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        assetFileNames: `assets/[name]-[hash]-${Date.now()}.[ext]`,
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth'],
          ui: ['lucide-react'],
          utils: ['axios', 'date-fns']
        }
      }
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Enable minification
    minify: 'esbuild',
    // Source maps for production debugging
    sourcemap: false
  },
  server: {
    port: 5173,
    host: true,
    // Enable hot reload for all file types
    watch: {
      usePolling: true
    }
  },
  preview: {
    port: 4173,
    host: true
  }
})
