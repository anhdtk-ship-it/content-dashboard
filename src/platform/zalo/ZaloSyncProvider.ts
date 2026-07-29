/* ============================================================
 * ZaloSyncProvider (ZALO-04) — đọc Google Sheet RIÊNG của Zalo → ZaloContent[].
 * ------------------------------------------------------------
 * ĐỘC LẬP với Sync Facebook. Google Sheet Zalo có ĐÚNG 2 Sheet: "Video" và "Banner".
 * KHÔNG có cột Thị trường / Người phụ trách / Định dạng.
 *   → content_format = TÊN SHEET (Video/Banner).
 * Mapping cột theo TÊN HEADER: Tên Content · Ngày Up Trello · Ngày test · Trạng thái.
 * Khoá định danh: Content ID / Trello Card ID nếu có; nếu không → hash ổn định
 *   (format|title|ngày up) → tránh sinh trùng, KHÔNG dùng số dòng làm khoá.
 *
 * Cấu hình ENV:
 *   ZALO_SHEET_ID   (bắt buộc)
 *   ZALO_SHEET_TABS (tuỳ chọn, mặc định "Video,Banner")
 * ========================================================== */
import { createHash } from 'crypto';
import { google, sheets_v4 } from 'googleapis';
import { createGoogleAuth } from '../../google-auth';
import { parseDdmmToReal } from '../../date-util';
import type { ZaloContent } from './ZaloContent';

const DEFAULT_TABS = ['S_Video', 'S_Banner']; // CHỈ đọc 2 tab này (bỏ Tổng hợp/Draft…)

// Header ứng viên (khớp không phân biệt hoa/thường, gộp khoảng trắng).
const HEADER_CANDIDATES: Record<string, string[]> = {
  // TRẠNG THÁI = cột "TT Team" (S_Video) / "Tình trạng content" (S_Banner) — cùng vị trí, giá trị đang chạy/chờ chạy/không chạy; TRỐNG → chưa phân loại.
  status:  ['TT Team', 'TT team', 'TT_Team', 'TT-Team', 'Tình trạng content', 'Tình trạng Content', 'Trạng thái team'],
  upload:  ['Ngày up', 'Ngày Up Trello', 'Ngày up Trello', 'Ngày cấp', 'Ngày lên', 'Ngày post'],
  test:    ['Ngày Test', 'Ngày test', 'Ngày set ads'],
  title:   ['Tên Content', 'Tên content'],
  // khoá định danh — ưu tiên nếu Sheet có sẵn
  id:      ['ID content 1', 'ID content 2', 'Content ID', 'ID content', 'Mã content', 'ID', 'Mã'],
  trello:  ['Link trello', 'Link Trello', 'Trello', 'Trello Card', 'Card ID'],
};

/** content_format từ TÊN TAB: bỏ tiền tố "S_"/"S " (quy ước đặt tên Sheet) → 'S_Video'→'Video', 'S_Banner'→'Banner'. */
export function formatFromTab(tabName: string): string {
  return (tabName ?? '').toString().trim().replace(/^s[_\s]+/i, '').trim();
}

const norm = (s: unknown) => (s ?? '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
const cell = (row: string[], idx: number) => (idx < 0 ? '' : (row[idx] ?? '').toString().trim());
const isEmptyRow = (row: string[]) => !row || row.every((c) => (c ?? '').toString().trim() === '');

/** Quét vài hàng header đầu (HEADER TRẢI NHIỀU HÀNG) — tìm cột cho từng field từ BẤT KỲ hàng header nào.
 *  Trả về vị trí cột + hàng bắt đầu dữ liệu (sau hàng header sâu nhất). */
export function detectCols(values: string[][]): { cols: Record<string, number>; dataStart: number } {
  const HEAD = Math.min(values.length, 6);
  let deepest = -1;
  const matches = (field: string, x: unknown): boolean => {
    const nx = norm(x);
    // 'ID content 1' là khoá DUY NHẤT (khớp tên Form) — match cả khi header có chú thích thêm ("= ID MQC…").
    if (field === 'id' && nx.startsWith('id content 1')) return true;
    return HEADER_CANDIDATES[field].map(norm).includes(nx);
  };
  const find = (field: string): number => {
    for (let r = 0; r < HEAD; r++) {
      const c = (values[r] ?? []).findIndex((x) => matches(field, x));
      if (c >= 0) { if (r > deepest) deepest = r; return c; }
    }
    return -1;
  };
  const cols = {
    status: find('status'), upload: find('upload'), test: find('test'),
    id: find('id'), trello: find('trello'), title: find('title'),
  };
  return { cols, dataStart: deepest + 1 };
}
/** Rút Trello card id từ URL/chuỗi (…/c/<id>/… hoặc token cuối). */
function trelloCardId(v: string): string {
  const s = v.trim();
  if (!s) return '';
  const m = s.match(/trello\.com\/c\/([A-Za-z0-9]+)/i);
  if (m) return m[1];
  const m2 = s.match(/([A-Za-z0-9]{8,})\/?$/);
  return m2 ? m2[1] : '';
}
/** Khoá định danh ỔN ĐỊNH: ID > Trello > hash(format|title|ngày up). KHÔNG dùng số dòng. */
export function stableKey(format: string, title: string, uploadReal: string | null, explicitId: string, trello: string): string {
  const id = explicitId.trim();
  if (id) return id;
  const card = trelloCardId(trello);
  if (card) return `TRELLO-${card}`;
  const basis = `${format}|${title.toLowerCase().replace(/\s+/g, ' ').trim()}|${uploadReal ?? ''}`;
  return `Z-${createHash('sha1').update(basis, 'utf8').digest('hex').slice(0, 12)}`;
}

/** THUẦN — dựng ZaloContent[] từ 1 tab (đã biết tên = định dạng). Export để unit-test. */
export function transformTab(tabName: string, values: string[][]): ZaloContent[] {
  const format = formatFromTab(tabName); // 'S_Video' → 'Video', 'S_Banner' → 'Banner'
  const { cols, dataStart } = detectCols(values);
  // Không nhận ra bảng nếu thiếu cả trạng thái lẫn khoá lẫn ngày up.
  if (cols.status < 0 && cols.upload < 0 && cols.id < 0 && cols.trello < 0) return [];
  const out: ZaloContent[] = [];
  for (const row of values.slice(dataStart)) {
    if (isEmptyRow(row)) continue;
    const status = cell(row, cols.status);   // TT Team / Tình trạng content — TRỐNG → chưa phân loại
    const idRaw = cell(row, cols.id);
    const trelloRaw = cell(row, cols.trello);
    const upload_date = cell(row, cols.upload);
    const test_date = cell(row, cols.test);
    if (!idRaw && !trelloRaw && !upload_date && !status) continue;
    const upload_date_real = parseDdmmToReal(upload_date);
    const content_code = stableKey(format, '', upload_date_real, idRaw, trelloRaw);
    out.push({
      content_code,
      title: idRaw || cell(row, cols.title), // hiển thị: ID content (Sheet không có cột Tên Content)
      assignee_name: '',
      content_format: format || null,
      current_status: status,
      upload_date,
      upload_date_real,
      test_date,
      test_date_real: parseDdmmToReal(test_date),
    });
  }
  return out;
}

/** Chẩn đoán 1 tab (để nhìn thấy tại sao map/đọc lỗi mà không cần mở Sheet). */
export interface TabDiag {
  tab: string;
  headerRowIndex: number;              // -1 nếu không tìm thấy hàng header
  headers: string[];                   // TOÀN BỘ header (để soi tên cột thật)
  cols: { status: number; content: number; upload: number; test: number; id: number; trello: number }; // -1 = không map được
  rows: number;                        // số dòng content đọc được từ tab này
}

export class ZaloSyncProvider {
  /** Chẩn đoán của lần fetch gần nhất (đọc qua /api/zalo-sync/status). */
  lastDiag: { tabsInSheet: string[]; tabsRead: string[]; perTab: TabDiag[] } = { tabsInSheet: [], tabsRead: [], perTab: [] };

  /** Đọc ĐỒNG THỜI các Sheet content của Zalo (mặc định: TẤT CẢ tab) → merge → ZaloContent[]. */
  async fetchRecords(): Promise<ZaloContent[]> {
    // Chấp nhận cả 2 tên env (ZALO_GOOGLE_SHEET_ID ưu tiên — khớp cấu hình Railway; ZALO_SHEET_ID để tương thích).
    const spreadsheetId = (process.env.ZALO_GOOGLE_SHEET_ID || process.env.ZALO_SHEET_ID || '').trim();
    if (!spreadsheetId) {
      throw new Error('Thiếu ZALO_GOOGLE_SHEET_ID (hoặc ZALO_SHEET_ID) — đặt id Google Sheet Zalo trong biến môi trường Railway/.env.');
    }
    const sheets: sheets_v4.Sheets = google.sheets({ version: 'v4', auth: createGoogleAuth() });

    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
    const allTitles = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? '').filter(Boolean);

    // CHỈ đọc S_Video + S_Banner (mặc định) — KHÔNG đọc Tổng hợp/Draft… Cho phép ghi đè bằng ZALO_SHEET_TABS.
    const wanted = (process.env.ZALO_SHEET_TABS ?? DEFAULT_TABS.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
    const tabs = wanted
      .map((w) => allTitles.find((t) => t.trim().toLowerCase() === w.toLowerCase()))
      .filter((t): t is string => !!t);
    if (tabs.length === 0) {
      throw new Error(`Không thấy tab [${wanted.join(', ')}] — tab hiện có trong Sheet: [${allTitles.join(', ')}]. Sửa env ZALO_SHEET_TABS cho khớp.`);
    }
    console.log(`[ContentSyncZalo] Tab trong Sheet: [${allTitles.join(' | ')}] → đọc: [${tabs.join(' | ')}]`);

    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: tabs.map((t) => `'${t.replace(/'/g, "''")}'`),
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const valueRanges = res.data.valueRanges ?? [];

    const records: ZaloContent[] = [];
    const perTab: TabDiag[] = [];
    tabs.forEach((tab, i) => {
      const values = (valueRanges[i]?.values ?? []) as string[][];
      const { cols, dataStart } = detectCols(values);
      const rows = transformTab(tab, values);
      perTab.push({
        tab, headerRowIndex: dataStart - 1,
        // 5 hàng header đầu (gộp ô không rỗng) để soi cấu trúc header nhiều hàng.
        headers: values.slice(0, 5).map((r) => (r ?? []).map((c) => (c ?? '').toString().trim()).filter(Boolean).join(' | ')),
        cols: { status: cols.status, content: -1, upload: cols.upload, test: cols.test, id: cols.id, trello: cols.trello },
        rows: rows.length,
      });
      console.log(`[ContentSyncZalo] Sheet "${tab}": dataStart@${dataStart} · ${rows.length} dòng`);
      records.push(...rows);
    });
    this.lastDiag = { tabsInSheet: allTitles, tabsRead: tabs, perTab };
    console.log(`[ContentSyncZalo] TỔNG số dòng đọc từ ${tabs.length} tab: ${records.length}`);
    return records;
  }
}
