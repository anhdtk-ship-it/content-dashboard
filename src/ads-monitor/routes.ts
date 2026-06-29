/* Ads Monitor — API nội bộ. GET /ads-monitor → 1 trang items + summary (KPI) + tổng, từ SQL.
 * PHASE 5: SERVER-SIDE pagination + filter + sort + KPI. KHÔNG tải toàn bộ; KHÔNG filter ở JS/React.
 * Query params: page, pageSize, content, adsOwner, location, pageCode, status,
 *               month (YYYY-MM) hoặc sheetDate hoặc dateFrom/dateTo, sortField, sortDirection. */
import { Router } from 'express';
import { AdsMonitorService } from './AdsMonitorService';

const router = Router();
const service = new AdsMonitorService();

const SORT_FIELDS = ['content', 'ads_owner', 'location', 'page_code', 'amount_spent', 'updated_at', 'sheet_date'];

/** Chuẩn hoá tham số chuỗi: rỗng / 'ALL' → null (không lọc). */
function str(v: unknown): string | null {
  const s = (v ?? '').toString().trim();
  return s && s !== 'ALL' ? s : null;
}

/**
 * 'YYYY-MM' → khoảng ngày của THÁNG đó: from = ngày đầu tháng, to = ngày cuối tháng.
 * Trên cột `sheet_date` kiểu DATE, điều kiện `>= from AND <= to` TƯƠNG ĐƯƠNG
 * `>= đầu tháng AND < đầu tháng kế tiếp` (range scan dùng index, KHÔNG dùng EXTRACT/MONTH).
 */
function monthRange(month: string | null): { from: string; to: string } | null {
  if (!month) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const y = +m[1], mo = +m[2];
  if (mo < 1 || mo > 12) return null;
  const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate(); // ngày cuối tháng mo (1-based)
  return { from: `${m[1]}-${m[2]}-01`, to: `${m[1]}-${m[2]}-${String(lastDay).padStart(2, '0')}` };
}

// GET /ads-monitor
router.get('/', async (req, res) => {
  try {
    const q = req.query as Record<string, unknown>;
    const page = Math.max(1, parseInt(q.page as string) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(q.pageSize as string) || 50));

    // Ưu tiên month (YYYY-MM) → range cả tháng; rồi sheetDate (1 ngày); rồi dateFrom/dateTo.
    const month = monthRange(str(q.month));
    const sheetDate = str(q.sheetDate);
    const dateFrom = month ? month.from : (sheetDate ?? str(q.dateFrom));
    const dateTo = month ? month.to : (sheetDate ?? str(q.dateTo));

    const sf = str(q.sortField);
    const sortField = sf && SORT_FIELDS.includes(sf) ? sf : 'updated_at';
    const sortDir = (q.sortDirection as string) === 'asc' ? 'asc' : 'desc';

    const result = await service.getData({
      page, pageSize,
      content: str(q.content),
      adsOwner: str(q.adsOwner),
      location: str(q.location),
      pageCode: str(q.pageCode),
      status: str(q.status),
      dateFrom, dateTo,
      sortField, sortDir,
    });

    res.json({ ...result, generatedAt: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});

export default router;
