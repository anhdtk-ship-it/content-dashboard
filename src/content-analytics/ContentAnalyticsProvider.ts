/* ============================================================
 * ContentAnalyticsProvider (PHASE CONTENT-ANALYTICS-03)
 * ------------------------------------------------------------
 * Đọc TRỰC TIẾP Google Sheet Raw_Data (Ads) — CHỈ ĐỌC (readonly), KHÔNG ghi ngược Sheet.
 * ĐỘC LẬP HOÀN TOÀN với `src/ads-monitor/GoogleSheetAdsSyncProvider.ts` — không import,
 * không tái sử dụng logic gộp/aggregation của Ads Monitor (module đó tính theo
 * (page_code, content, sheet_date); module này cần giữ NGUYÊN từng dòng thô để tự áp
 * dụng dedup rule riêng ở ContentAnalyticsService — xem PHASE CONTENT-ANALYTICS-02.1 audit).
 *
 * Dùng chung `createGoogleAuth()` (src/google-auth.ts, KHÔNG sửa) + cùng cặp env
 * ADS_SHEET_ID / ADS_SHEET_TAB (cùng 1 spreadsheet Ads, tab Raw_Data — chỉ đọc thêm cột,
 * không đổi cách Ads Monitor đọc).
 * ========================================================== */
import { google } from 'googleapis';
import { createGoogleAuth } from '../google-auth';
import type { RawAdsAnalyticsRow } from './types';

/** Tên cột cần dùng (khớp không phân biệt hoa/thường, trim khoảng trắng). */
const COL_NAMES = {
  date: 'date',
  ad_id: 'ad_id',
  ad_name: 'ad_name',
  account_id: 'account_id',
  account_name: 'account_name',
  campaign_id: 'campaign_id',
  adset_id: 'adset_id',
  purchases: 'purchases',
} as const;

const norm = (s: unknown) => (s ?? '').toString().trim().toLowerCase();

/** "2026-06-03" | "03/06/2026" → "YYYY-MM-DD" | null. */
function parseDate(v: unknown): string | null {
  const s = (v ?? '').toString().trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) {
    const dd = m[1].padStart(2, '0'), mm = m[2].padStart(2, '0');
    const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

/** "1" | "1,000" | "" → số nguyên (mặc định 0, KHÔNG throw trên dữ liệu bẩn). */
function parseIntSafe(v: unknown): number {
  const digits = (v ?? '').toString().trim().replace(/[^\d-]/g, '');
  if (!digits) return 0;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

export class ContentAnalyticsProvider {
  /** Đọc TOÀN BỘ lịch sử Raw_Data (mọi dòng có date+ad_id), KHÔNG gộp/aggregate. */
  async fetchRows(): Promise<RawAdsAnalyticsRow[]> {
    const spreadsheetId = process.env.ADS_SHEET_ID?.trim();
    const tab = process.env.ADS_SHEET_TAB?.trim();
    if (!spreadsheetId) throw new Error('Thiếu ADS_SHEET_ID trong env.');
    if (!tab) throw new Error('Thiếu ADS_SHEET_TAB trong env.');

    const sheets = google.sheets({ version: 'v4', auth: createGoogleAuth() });

    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
    const titles = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? '');
    const actual = titles.find((t) => t.trim() === tab.trim());
    if (!actual) throw new Error(`Không tìm thấy tab "${tab}" trong spreadsheet Ads. Có: ${titles.join(', ')}`);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId, range: `'${actual.replace(/'/g, "''")}'`, valueRenderOption: 'FORMATTED_VALUE',
    });
    const rows = (res.data.values ?? []) as string[][];
    if (!rows.length) return [];

    // Header = dòng đầu tiên chứa đủ các cột bắt buộc (date/ad_id/ad_name/purchases).
    const headerIdx = rows.findIndex((r) => {
      const normed = r.map(norm);
      return normed.includes(COL_NAMES.date) && normed.includes(COL_NAMES.ad_id) && normed.includes(COL_NAMES.purchases);
    });
    if (headerIdx === -1) throw new Error('Không tìm thấy header Raw_Data (thiếu cột date/ad_id/purchases).');
    const header = rows[headerIdx];

    const idx: Record<keyof typeof COL_NAMES, number> = {
      date: -1, ad_id: -1, ad_name: -1, account_id: -1, account_name: -1,
      campaign_id: -1, adset_id: -1, purchases: -1,
    };
    header.forEach((h, i) => {
      const hn = norm(h);
      (Object.keys(COL_NAMES) as (keyof typeof COL_NAMES)[]).forEach((k) => {
        if (idx[k] === -1 && COL_NAMES[k] === hn) idx[k] = i;
      });
    });
    const missing = (Object.keys(COL_NAMES) as (keyof typeof COL_NAMES)[]).filter((k) => idx[k] === -1);
    if (missing.length) throw new Error(`Thiếu cột bắt buộc trên Raw_Data: ${missing.map((k) => COL_NAMES[k]).join(', ')}`);

    const cell = (r: string[], i: number) => (i === -1 ? '' : (r[i] ?? '').toString().trim());

    const out: RawAdsAnalyticsRow[] = [];
    for (const r of rows.slice(headerIdx + 1)) {
      const date = parseDate(cell(r, idx.date));
      const adId = cell(r, idx.ad_id);
      const adName = cell(r, idx.ad_name);
      if (!date || !adId || !adName) continue; // bỏ dòng rỗng/thiếu khóa tối thiểu
      out.push({
        date,
        adId,
        adName,
        accountId: cell(r, idx.account_id),
        accountName: cell(r, idx.account_name),
        campaignId: cell(r, idx.campaign_id),
        adsetId: cell(r, idx.adset_id),
        purchases: parseIntSafe(cell(r, idx.purchases)),
      });
    }
    return out;
  }
}
