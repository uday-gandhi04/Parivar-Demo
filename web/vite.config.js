import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During `npm run dev` the frontend runs on :5173 and proxies /api/* to the
// backend on :4000, so we use relative URLs everywhere and avoid CORS in dev.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
