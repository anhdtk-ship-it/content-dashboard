import { createApp } from '../src/app';

/* ============================================================
 * Entry point cho VERCEL (serverless). KHÔNG có static/SPA fallback/.listen() —
 * Vercel serve `web/dist` bằng static hosting riêng (xem vercel.json), route này
 * chỉ nhận các path đã được `rewrites` chỉ định (/health, /api/*, /ads-monitor*).
 * ========================================================== */
export default createApp();
