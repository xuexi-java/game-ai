import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 20002,
    proxy: {
      '/api': {
        target: 'http://localhost:21001',
        changeOrigin: true,
      },
    },
  },
})
