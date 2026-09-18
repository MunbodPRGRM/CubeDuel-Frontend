import type { CapacitorConfig } from '@capacitor/cli';

// ทดลอง Capacitor (ยังไม่ใช่งานเฟส 9 จริง) — แอปเปิดเว็บที่ deploy อยู่บน Vercel ตรง ๆ
// origin ยังเป็นโดเมน Vercel เหมือนเปิดในเบราว์เซอร์ → ไม่ต้องแก้ CORS ของ backend
// ของจริงเฟส 9 ต้องถอด `server.url` ออก แล้วใส่ `dist/` ไว้ในตัวแอปแทน
const config: CapacitorConfig = {
  appId: 'com.cubeduel.app',
  appName: 'CubeDuel',
  webDir: 'dist',
  server: {
    url: 'https://cube-duel-frontend.vercel.app',
    cleartext: false,
  },
};

export default config;
