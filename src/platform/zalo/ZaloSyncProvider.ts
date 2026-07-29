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
  // TRẠNG THÁI CHÍNH = cột "TT Team" (đang chạy/chờ chạy/không chạy).
  status:  ['TT Team', 'TT team', 'TT_Team', 'TT-Team', 'Trạng thái team', 'Trạng thái Team'],
  // "tình trạng content" — content chưa có trạng thái ở cột này → CHƯA PHÂN LOẠI.
  content: ['Tình trạng content', 'Tình trạng Content', 'Trạng thái content', 'Tình trạng nội dung', 'Tình trạng'],
  upload:  ['Ngày Up Trello', 'Ngày up Trello', 'Ngày cấp', 'Ngày up', 'Ngày lên', 'Ngày post'],
  test:    ['Ngày test', 'Ngày Test', 'Ngày set ads'],
  title:   ['Tên Content', 'Tên content', 'Tên', 'Nội dung', 'Tiêu đề'],
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

function colIndex(header: string[], field: string): number {
  const wanted = HEADER_CANDIDATES[field].map(norm);
  return header.findIndex((c) => wanted.includes(norm(c)));
}
/** Hàng header = hàng đầu tiên (trong 15 hàng đầu) tìm được cột "Ngày up" HOẶC "TT Team" HOẶC "tình trạng content". */
function findHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const h = rows[i] ?? [];
    if (colIndex(h, 'upload') >= 0 || colIndex(h, 'status') >= 0 || colIndex(h, 'content') >= 0) return i;
  }
  return -1;
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
  const hIdx = findHeaderRow(values);
  if (hIdx === -1) return [];
  const header = values[hIdx];
  const idx = {
    title: colIndex(header, 'title'), upload: colIndex(header, 'upload'),
    test: colIndex(header, 'test'), status: colIndex(header, 'status'),
    content: colIndex(header, 'content'), id: colIndex(header, 'id'), trello: colIndex(header, 'trello'),
  };
  const out: ZaloContent[] = [];
  for (const row of values.slice(hIdx + 1)) {
    if (isEmptyRow(row)) continue;
    const ttTeam = cell(row, idx.status);           // "TT Team" (đang chạy/chờ chạy/không chạy)
    const contentStatus = cell(row, idx.content);   // "tình trạng content"
    const idRaw = cell(row, idx.id);
    const trelloRaw = cell(row, idx.trello);
    const upload_date = cell(row, idx.upload);
    const test_date = cell(row, idx.test);
    // Bỏ dòng không có nguồn định danh & không có nội dung.
    if (!idRaw && !trelloRaw && !upload_date && !ttTeam && !contentStatus) continue;
    // Trạng thái: nếu "tình trạng content" TRỐNG → content chưa có trạng thái → CHƯA PHÂN LOẠI (''),
    // ngược lại lấy nhóm theo "TT Team".
    const current_status = contentStatus === '' ? '' : ttTeam;
    const upload_date_real = parseDdmmToReal(upload_date);
    const content_code = stableKey(format, '', upload_date_real, idRaw, trelloRaw);
    out.push({
      content_code,
      title: idRaw || cell(row, idx.title), // hiển thị: ID content (Sheet không có cột Tên Content)
      assignee_name: '',
      content_format: format || null,
      current_status,
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
      const hIdx = findHeaderRow(values);
      const header = hIdx >= 0 ? values[hIdx] : [];
      const rows = transformTab(tab, values);
      perTab.push({
        tab, headerRowIndex: hIdx, headers: header.slice(0, 40).map((c) => (c ?? '').toString().trim()),
        cols: {
          status: colIndex(header, 'status'), content: colIndex(header, 'content'),
          upload: colIndex(header, 'upload'), test: colIndex(header, 'test'),
          id: colIndex(header, 'id'), trello: colIndex(header, 'trello'),
        },
        rows: rows.length,
      });
      console.log(`[ContentSyncZalo] Sheet "${tab}": header@${hIdx} · ${rows.length} dòng`);
      records.push(...rows);
    });
    this.lastDiag = { tabsInSheet: allTitles, tabsRead: tabs, perTab };
    console.log(`[ContentSyncZalo] TỔNG số dòng đọc từ ${tabs.length} tab: ${records.length}`);
    return records;
  }
}
