import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// App React refactor (web/) — proxy /api sang Express :4000.
// KHÔNG ảnh hưởng dashboard vanilla (public/index.html) hay server.ts.
export default defineConfig({
  root: 'web',
  plugins: [react(), tailwindcss()],
  // Chặn Vite nạp postcss.config của project cha (Tailwind v3) — để @tailwindcss/vite tự xử lý.
  css: { postcss: { plugins: [] } },
  server: {
    // /api: Dashboard Content · /ads-monitor: API module Ads Monitor (Phase 5)
    proxy: { '/api': 'http://localhost:4000', '/ads-monitor': 'http://localhost:4000' },
  },
});
