/* Ads Monitor — API nội bộ (PHASE 3). GET /ads-monitor → trả MOCK.
 * KHÔNG đọc database, KHÔNG đọc Google Sheet. Router độc lập, gắn vào server qua app.use. */
import { Router } from 'express';
import { AdsMonitorService } from './AdsMonitorService';

const router = Router();
const service = new AdsMonitorService();

// GET /ads-monitor
router.get('/', async (_req, res) => {
  try {
    const [items, summary] = await Promise.all([service.list(), service.summary()]);
    res.json({ items, summary, source: 'mock', generatedAt: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});

export default router;
