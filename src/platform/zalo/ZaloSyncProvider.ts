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

const DEFAULT_TABS = ['Video', 'Banner'];

// Header ứng viên (khớp không phân biệt hoa/thường, gộp khoảng trắng).
const HEADER_CANDIDATES: Record<string, string[]> = {
  title:  ['Tên Content', 'Tên content', 'Tên', 'Content', 'Nội dung', 'Tiêu đề'],
  upload: ['Ngày Up Trello', 'Ngày up Trello', 'Ngày cấp', 'Ngày up', 'Ngày lên', 'Ngày post'],
  test:   ['Ngày test', 'Ngày Test', 'Ngày set ads'],
  status: ['Trạng thái', 'Trạng thái ads', 'Status', 'Tình trạng'],
  // tuỳ chọn — nếu Sheet có sẵn khoá thì ưu tiên dùng
  id:     ['Content ID', 'ID content', 'ID', 'Mã content', 'Mã'],
  trello: ['Trello', 'Link Trello', 'Trello Card', 'Card ID', 'Link'],
};

const norm = (s: unknown) => (s ?? '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
const cell = (row: string[], idx: number) => (idx < 0 ? '' : (row[idx] ?? '').toString().trim());
const isEmptyRow = (row: string[]) => !row || row.every((c) => (c ?? '').toString().trim() === '');

function colIndex(header: string[], field: string): number {
  const wanted = HEADER_CANDIDATES[field].map(norm);
  return header.findIndex((c) => wanted.includes(norm(c)));
}
/** Hàng header = hàng đầu tiên (trong 15 hàng đầu) tìm được cột "Tên Content" HOẶC "Trạng thái". */
function findHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const h = rows[i] ?? [];
    if (colIndex(h, 'title') >= 0 || colIndex(h, 'status') >= 0) return i;
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
  const format = tabName.trim();
  const hIdx = findHeaderRow(values);
  if (hIdx === -1) return [];
  const header = values[hIdx];
  const idx = {
    title: colIndex(header, 'title'), upload: colIndex(header, 'upload'),
    test: colIndex(header, 'test'), status: colIndex(header, 'status'),
    id: colIndex(header, 'id'), trello: colIndex(header, 'trello'),
  };
  const out: ZaloContent[] = [];
  for (const row of values.slice(hIdx + 1)) {
    if (isEmptyRow(row)) continue;
    const title = cell(row, idx.title);
    const status = cell(row, idx.status);
    // Bỏ dòng rỗng hoàn toàn (không tên & không trạng thái) — tránh rác.
    if (!title && !status) continue;
    const upload_date = cell(row, idx.upload);
    const test_date = cell(row, idx.test);
    const upload_date_real = parseDdmmToReal(upload_date);
    const content_code = stableKey(format, title, upload_date_real, cell(row, idx.id), cell(row, idx.trello));
    out.push({
      content_code,
      title,
      assignee_name: '', // Zalo không có người phụ trách
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

export class ZaloSyncProvider {
  /** Đọc ĐỒNG THỜI Sheet Video + Banner → merge → ZaloContent[]. */
  async fetchRecords(): Promise<ZaloContent[]> {
    // Chấp nhận cả 2 tên env (ZALO_GOOGLE_SHEET_ID ưu tiên — khớp cấu hình trên Railway; ZALO_SHEET_ID để tương thích).
    const spreadsheetId = (process.env.ZALO_GOOGLE_SHEET_ID || process.env.ZALO_SHEET_ID || '').trim();
    if (!spreadsheetId) {
      throw new Error('Thiếu ZALO_GOOGLE_SHEET_ID (hoặc ZALO_SHEET_ID) — đặt id Google Sheet Zalo trong biến môi trường Railway/.env.');
    }
    const sheets: sheets_v4.Sheets = google.sheets({ version: 'v4', auth: createGoogleAuth() });

    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
    const allTitles = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? '').filter(Boolean);
    const wanted = (process.env.ZALO_SHEET_TABS ?? DEFAULT_TABS.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
    // Chỉ đọc tab thực sự tồn tại (khớp không phân biệt hoa/thường).
    const tabs = wanted
      .map((w) => allTitles.find((t) => t.trim().toLowerCase() === w.toLowerCase()))
      .filter((t): t is string => !!t);
    if (tabs.length === 0) throw new Error(`Không thấy Sheet ${wanted.join('/')} trong Google Sheet Zalo.`);

    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: tabs.map((t) => `'${t.replace(/'/g, "''")}'`),
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const valueRanges = res.data.valueRanges ?? [];

    const records: ZaloContent[] = [];
    tabs.forEach((tab, i) => {
      const rows = transformTab(tab, (valueRanges[i]?.values ?? []) as string[][]);
      console.log(`[ContentSyncZalo] Sheet "${tab}": ${rows.length} dòng`);
      records.push(...rows);
    });
    console.log(`[ContentSyncZalo] TỔNG số dòng đọc từ ${tabs.length} Sheet: ${records.length}`);
    return records;
  }
}
