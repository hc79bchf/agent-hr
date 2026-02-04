import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    allowedHosts: ['.railway.app'],
  },
  build: {
    // Disable source maps in production to prevent reverse engineering
    sourcemap: false,
    // Minify and obfuscate code
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      mangle: {
        toplevel: true,
      },
      format: {
        comments: false,
      },
    },
    // Remove asset source references
    rollupOptions: {
      output: {
        // Randomize chunk names to make reverse engineering harder
        chunkFileNames: 'assets/[hash].js',
        entryFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash].[ext]',
      },
    },
  },
  optimizeDeps: {
    include: ['swagger-ui-react'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
})
