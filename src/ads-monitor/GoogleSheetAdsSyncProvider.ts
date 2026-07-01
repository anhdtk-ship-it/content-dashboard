/* Ads Monitor — PHASE 6: đọc Google Sheet Ads (tab Raw_Data — export Facebook Ads cấp ad/ngày) → AdsMonitorRecord[].
 * Implements AdsMonitorSyncProvider. CHỈ ĐỌC (readonly). KHÔNG ghi ngược Sheet. KHÔNG đọc/ghi `status`.
 *
 * SCHEMA THỰC TẾ của Raw_Data (header snake_case):
 *   date, account_id, account_name, campaign_id, campaign_name, adset_id, adset_name,
 *   ad_id, ad_name, amount_spent, impressions, reach, frequency, ctr_all, cpm, ...
 *
 * MAPPING (suy luận từ dữ liệu — xem PROJECT_HANDOFF §Ads / báo cáo Phase 6; chỉnh tại đây nếu nghiệp vụ khác):
 *   content    ← ad_name                         (gom các bản sao cùng tên)
 *   page_code  ← adset_name      (vd "Khiêm S07" — khớp "Mã page" tab Seryn Page)
 *   ads_owner  ← token đầu của adset_name (vd "Khiêm")
 *   location   ← token 'TQ'|'NN' tách từ campaign_name  (TQ→Nội Địa, NN→Quốc Tế)
 *   sheet_date ← date            (giữ lịch sử theo ngày)
 *   amount_spent ← SUM theo (page_code, content, sheet_date)  → chi tiêu/ngày của content (gộp bản sao)
 *
 * Cấu hình env: ADS_SHEET_ID + ADS_SHEET_TAB. */
import { google } from 'googleapis';
import { createGoogleAuth } from '../google-auth';
import type { AdsMonitorRecord } from './types';
import type { AdsMonitorSyncProvider } from './AdsMonitorSyncProvider';

/** Tên cột FB cần dùng → alias chấp nhận (khớp không phân biệt hoa/thường, bỏ khoảng trắng thừa). */
const COL = {
  date: ['date', 'ngày', 'ngay'],
  amount: ['amount_spent', 'amount spent', 'amount'],
  campaign: ['campaign_name', 'campaign'],
  adset: ['adset_name', 'ad set name', 'adset'],
  ad: ['ad_name', 'ad name'],
};

const norm = (s: unknown) => (s ?? '').toString().trim().toLowerCase();

/** "12.500.000 VNĐ" / "242085" / "12,500,000" → số nguyên VND. */
function parseAmount(v: unknown): number {
  const digits = (v ?? '').toString().replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

/** "yyyy-mm-dd" | "dd/mm/yyyy" → "YYYY-MM-DD" | null */
function parseSheetDate(v: unknown): string | null {
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

/** Tách 'TQ'|'NN' (đứng riêng) từ campaign_name. Không thấy → ''. */
function parseLocation(campaign: string): string {
  for (const seg of campaign.split('-')) {
    const t = seg.trim().toUpperCase();
    if (t === 'TQ' || t === 'NN') return t;
  }
  return '';
}

/** ads_owner = token đầu của adset_name (vd "Khiêm S07" → "Khiêm"). */
function parseOwner(adset: string): string {
  return adset.trim().split(/\s+/)[0] ?? '';
}

export class GoogleSheetAdsSyncProvider implements AdsMonitorSyncProvider {
  async fetchRecords(): Promise<AdsMonitorRecord[]> {
    const spreadsheetId = process.env.ADS_SHEET_ID?.trim();
    const tab = process.env.ADS_SHEET_TAB?.trim();
    if (!spreadsheetId) throw new Error('Thiếu ADS_SHEET_ID (spreadsheet Ads) trong env.');
    if (!tab) throw new Error('Thiếu ADS_SHEET_TAB (tên tab Ads) trong env.');

    // PHASE 12: dùng GoogleAuthFactory (JSON env → PATH file). CHỈ đổi cách khởi tạo auth.
    const sheets = google.sheets({ version: 'v4', auth: createGoogleAuth() });

    // Resolve tên tab thật (chịu khoảng trắng thừa)
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
    const titles = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? '');
    const actual = titles.find((t) => t.trim() === tab.trim());
    if (!actual) throw new Error(`Không tìm thấy tab "${tab}" trong spreadsheet. Có: ${titles.join(', ')}`);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId, range: `'${actual.replace(/'/g, "''")}'`, valueRenderOption: 'FORMATTED_VALUE',
    });
    const rows = (res.data.values ?? []) as string[][];
    if (!rows.length) return [];

    // Header = dòng đầu tiên chứa cột amount.
    const headerIdx = rows.findIndex((r) => r.some((c) => COL.amount.includes(norm(c))));
    if (headerIdx === -1) throw new Error(`Không tìm thấy header (thiếu cột ${COL.amount.join('/')}).`);
    const header = rows[headerIdx];

    // Map field → chỉ số cột (theo alias).
    const idx: Record<keyof typeof COL, number> = { date: -1, amount: -1, campaign: -1, adset: -1, ad: -1 };
    header.forEach((h, i) => {
      const hn = norm(h);
      (Object.keys(COL) as (keyof typeof COL)[]).forEach((k) => { if (idx[k] === -1 && COL[k].includes(hn)) idx[k] = i; });
    });
    const need: (keyof typeof COL)[] = ['amount', 'adset', 'ad'];
    const missing = need.filter((k) => idx[k] === -1);
    if (missing.length) throw new Error(`Thiếu cột bắt buộc trên Sheet: ${missing.map((k) => COL[k][0]).join(', ')}`);

    const cell = (r: string[], i: number) => (i === -1 ? '' : (r[i] ?? '').toString().trim());
    const nowIso = new Date().toISOString();

    // Gộp theo (page_code, content, sheet_date) → SUM amount (gộp các bản sao ad trong cùng ngày).
    const agg = new Map<string, AdsMonitorRecord>();
    for (const r of rows.slice(headerIdx + 1)) {
      const content = cell(r, idx.ad);
      const page_code = cell(r, idx.adset);
      if (!content && !page_code) continue; // bỏ dòng rỗng
      const campaign = cell(r, idx.campaign);
      const sheet_date = parseSheetDate(cell(r, idx.date));
      const amount = parseAmount(cell(r, idx.amount));
      const key = `${page_code}||${content}||${sheet_date ?? ''}`;
      const cur = agg.get(key);
      if (cur) {
        cur.amount_spent += amount;
      } else {
        agg.set(key, {
          id: agg.size + 1, // id tạm; khóa thật khi upsert = (page_code, content, sheet_date)
          content,
          location: parseLocation(campaign),
          ads_owner: parseOwner(page_code),
          page_code,
          amount_spent: amount,
          updated_at: nowIso,
          created_at: nowIso,
          sheet_date,
        });
      }
    }
    return [...agg.values()];
  }
}
