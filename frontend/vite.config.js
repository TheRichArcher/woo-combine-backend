import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

// Get git commit hash at build time
const getGitHash = () => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    '__BUILD_SHA__': JSON.stringify(getGitHash()),
    '__BUILD_TIME__': JSON.stringify(new Date().toISOString()),
  },
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
    // Enable minification and strip debug logging in production
    minify: 'esbuild',
    esbuild: {
      drop: ['debugger'],
      pure: ['console.log', 'console.debug'],
    },
    // Source maps for production debugging
    sourcemap: true
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
