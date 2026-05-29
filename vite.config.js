import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'https://chatbot-api-939800561122.asia-south1.run.app',
    },
  },
  build: {
    outDir: 'dist',
  },
});
