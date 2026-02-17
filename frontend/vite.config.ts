import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/storage': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
    allowedHosts:["polysemous-nonconjunctively-kecia.ngrok-free.dev"]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-charts': ['recharts'],
          'vendor-motion': ['framer-motion'],
          'vendor-icons': ['lucide-react'],
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@tanstack/react-query', '@tanstack/react-virtual', 'date-fns'],
        }
      }
    },
  }
});
