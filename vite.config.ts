import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas em pacote próprio: ficam em cache no celular entre atualizações do sistema
        manualChunks: { vendor: ['react', 'react-dom', 'react-dom/client', 'react-router', 'react-router-dom'] },
      },
    },
  },
  server: {
    port: 3020,
    proxy: {
      '/api': { target: 'http://localhost:3002', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3002', changeOrigin: true },
    },
  },
})
