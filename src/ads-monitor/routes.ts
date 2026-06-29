/* Ads Monitor — API nội bộ. GET /ads-monitor → 1 trang items + summary (KPI) + tổng, từ SQL.
 * PHASE 5: SERVER-SIDE pagination + filter + sort + KPI. KHÔNG tải toàn bộ; KHÔNG filter ở JS/React.
 * Query params: page, pageSize, content, adsOwner, location, pageCode, status,
 *               sheetDate (hoặc dateFrom/dateTo), sortField, sortDirection. */
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

// GET /ads-monitor
router.get('/', async (req, res) => {
  try {
    const q = req.query as Record<string, unknown>;
    const page = Math.max(1, parseInt(q.page as string) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(q.pageSize as string) || 50));

    // sheetDate (1 ngày) ⇒ from=to=sheetDate; nếu không có thì dùng dateFrom/dateTo.
    const sheetDate = str(q.sheetDate);
    const dateFrom = sheetDate ?? str(q.dateFrom);
    const dateTo = sheetDate ?? str(q.dateTo);

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
