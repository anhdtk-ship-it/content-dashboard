/* ============================================================
 * Ads Report Router (AR-01)
 * ------------------------------------------------------------
 *   GET /api/ads-report              → JSON cho dashboard
 *   GET /api/ads-report/excel        → tải .xlsx (cùng dữ liệu, cùng service)
 *   GET /api/ads-report/nhan-vien    → danh sách nhân viên cho dropdown (không đọc Sheet)
 *
 * Stateless: đọc thẳng Raw_Data + file ROAS mỗi request, KHÔNG cache, KHÔNG bảng Supabase
 * mới — giống /api/content-analytics và /api/content-performance. Bảo vệ bằng `requireAuth`
 * gắn ở nơi mount (src/app.ts).
 * ========================================================== */
import express from 'express';
import { buildAdsReport, thangHienTai, thangHopLe } from './AdsReportService';
import { buildExcel } from './ExcelBuilder';
import { NHAN_VIEN_ADS } from './config';
import type { AdsReportQuery, LocThiTruong } from './types';

function docQuery(req: express.Request): AdsReportQuery {
  const thangRaw = ((req.query.thang as string) || '').trim();
  const ttRaw = ((req.query.thiTruong as string) || '').trim().toLowerCase();
  return {
    thang: thangHopLe(thangRaw) ? thangRaw : thangHienTai(),
    thiTruong: (ttRaw === 'noi_dia' || ttRaw === 'quoc_te' ? ttRaw : 'all') as LocThiTruong,
    nhanVien: ((req.query.nhanVien as string) || 'ALL').trim(),
  };
}

export function createAdsReportRouter(): express.Router {
  const router = express.Router();

  router.get('/nhan-vien', (_req, res) => {
    res.json(NHAN_VIEN_ADS.map((nv) => ({ key: nv.key, nhan: nv.nhan, full: nv.full })));
  });

  router.get('/', async (req, res) => {
    try {
      res.json(await buildAdsReport(docQuery(req)));
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? String(e) });
    }
  });

  router.get('/excel', async (req, res) => {
    try {
      const q = docQuery(req);
      const data = await buildAdsReport(q);
      const buf = await buildExcel(data);
      const hau = q.nhanVien && q.nhanVien !== 'ALL' ? `_${q.nhanVien}` : '';
      const ten = `BaoCaoAds_Thang${q.thang.slice(5)}_${q.thang.slice(0, 4)}${hau}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      // filename* (RFC 5987) để giữ dấu tiếng Việt; filename thường làm bản dự phòng.
      res.setHeader('Content-Disposition', `attachment; filename="${ten}"; filename*=UTF-8''${encodeURIComponent(ten)}`);
      res.setHeader('Content-Length', String(buf.length));
      res.end(buf);
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? String(e) });
    }
  });

  return router;
}
