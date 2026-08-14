import * as path from 'path';
import express from 'express';
import { createApp } from './app';

/* ============================================================
 * Entry point cho LOCAL DEV + RAILWAY (process dài hạn, app.listen()).
 * Toàn bộ route API nằm ở `createApp()` (`src/app.ts`) — file này chỉ thêm phần
 * chỉ có ý nghĩa với 1 process chạy liên tục: serve static `web/dist` + SPA fallback
 * + `.listen()`. Trên Vercel, các phần này KHÔNG dùng (Vercel serve `web/dist` bằng
 * static hosting riêng) — xem `api/index.ts`.
 * ========================================================== */

const PORT = Number(process.env.PORT ?? 4000);

const app = createApp();

// Serve React dashboard (web/dist) built by Vite
app.use(express.static(path.join(process.cwd(), 'web', 'dist')));

// SPA fallback — trả về web/dist/index.html cho mọi route không phải /api/*
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'web', 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`✅ Dashboard V3 (Operations) chạy tại http://localhost:${PORT}`));
