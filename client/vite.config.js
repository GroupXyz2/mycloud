import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_URL || '/',
  server: {
    port: 6869,
    proxy: {
      '/api': {
        target: 'http://localhost:6868',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:6868',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
