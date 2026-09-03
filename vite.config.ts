import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  // จำเป็น! ไม่งั้น scramble worker ของ cubing.js จะ 404 (บทเรียนจากเฟส 0)
  optimizeDeps: {
    exclude: ['cubing'],
  },
  server: {
    port: 5173,
  },
});
