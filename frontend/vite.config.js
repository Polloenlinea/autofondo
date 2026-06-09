import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        timeout: 300000,       // 5 min — el modelo IA puede tardar
        proxyTimeout: 300000,
      },
      // rutas legacy (compatibilidad con server.js que también las expone en /)
      '/remove-bg': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        timeout: 300000,
        proxyTimeout: 300000,
      },
      '/compose': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        timeout: 300000,
        proxyTimeout: 300000,
      },
      '/detect': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        timeout: 30000,
        proxyTimeout: 30000,
      },
      '/adjust': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        timeout: 60000,
        proxyTimeout: 60000,
      },
      '/health': 'http://localhost:8001',
    },
  },
})
