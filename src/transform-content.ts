import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { google, sheets_v4 } from 'googleapis';
import { createGoogleAuth } from './google-auth';

/* ============================================================
 * Cấu hình
 * ========================================================== */
const TARGET_SHEETS = [
  'NĐ Hiếu',
  'QT Hiếu',
  'NĐ Ánh',
  'QT Ánh',
  'NĐ KA',
  'QT KA',
  'NĐ Liên',
  'QT Liên',
];

const MAX_RECORDS = 20;

/* ============================================================
 * Types
 * ========================================================== */
interface ContentRecord {
  content_code: string;   // ID content 1
  market: string;         // noi_dia | quoc_te
  assignee_name: string;  // Hiếu | Ánh | KA | Liên
  cgsd: string;           // CGSĐ
  editor_name: string;    // Biên tập
  trello_link: string;    // Link trello
  upload_date: string;    // Ngày up trello (giữ giá trị gốc)
  current_status: string; // Trạng thái ads
  test_date: string;      // Ngày test
}

/* ============================================================
 * Helpers
 * ========================================================== */
function isEmptyRow(row: string[]): boolean {
  return !row || row.every((c) => (c ?? '').toString().trim() === '');
}

function cell(row: string[], idx: number): string {
  if (idx < 0) return '';
  return (row[idx] ?? '').toString().trim();
}

/** market + assignee từ tên sheet. */
function parseSheetName(name: string): { market: string; assignee: string } {
  const t = name.trim();
  if (/^QT(\s+|$)/i.test(t)) return { market: 'quoc_te', assignee: t.replace(/^QT/i, '').trim() };
  if (/^NĐ(\s+|$)/i.test(t)) return { market: 'noi_dia', assignee: t.replace(/^NĐ/i, '').trim() };
  return { market: '', assignee: '' };
}

/** Dòng header = dòng đầu tiên có ô "STT". */
function findHeaderRowIndex(rows: string[][]): number {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]?.some((c) => (c ?? '').toString().trim().toUpperCase() === 'STT')) return i;
  }
  return -1;
}

/** Tìm chỉ số cột theo tên header (so khớp không phân biệt hoa/thường). */
function colIndex(header: string[], name: string): number {
  const target = name.trim().toLowerCase();
  return header.findIndex((c) => (c ?? '').toString().trim().toLowerCase() === target);
}

function getSheetsClient(): sheets_v4.Sheets {
  return google.sheets({ version: 'v4', auth: createGoogleAuth() });
}

/* ============================================================
 * Transform 1 sheet -> ContentRecord[]
 * ========================================================== */
function transformSheet(sheetName: string, values: string[][]): ContentRecord[] {
  const { market, assignee } = parseSheetName(sheetName);
  const headerIdx = findHeaderRowIndex(values);
  if (headerIdx === -1) return [];

  const header = values[headerIdx] ?? [];
  const idx = {
    contentCode: colIndex(header, 'ID content 1'),
    cgsd: colIndex(header, 'CGSĐ'),
    editor: colIndex(header, 'Biên tập'),
    trello: colIndex(header, 'Link trello'),
    upload: colIndex(header, 'Ngày up trello'),
    status: colIndex(header, 'Trạng thái ads'),
    test: colIndex(header, 'Ngày test'),
  };

  const records: ContentRecord[] = [];
  for (const row of values.slice(headerIdx + 1)) {
    if (isEmptyRow(row)) continue;
    const content_code = cell(row, idx.contentCode);
    if (content_code === '') continue; // chỉ lấy dòng có content thật

    records.push({
      content_code,
      market,
      assignee_name: assignee,
      cgsd: cell(row, idx.cgsd),
      editor_name: cell(row, idx.editor),
      trello_link: cell(row, idx.trello),
      upload_date: cell(row, idx.upload),
      current_status: cell(row, idx.status),
      test_date: cell(row, idx.test),
    });
  }
  return records;
}

/* ============================================================
 * Main
 * ========================================================== */
async function main(): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error('Thiếu GOOGLE_SHEET_ID trong .env');

  const sheets = getSheetsClient();

  // Lấy tên sheet thật (có thể có khoảng trắng thừa, vd "QT Liên ")
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  const actualTitles = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? '');

  // Map mỗi target -> tên sheet thật (so khớp theo bản đã trim)
  const resolved = TARGET_SHEETS.map((target) => {
    const actual = actualTitles.find((t) => t.trim() === target.trim());
    if (!actual) throw new Error(`Không tìm thấy sheet khớp với "${target}"`);
    return { target, actual };
  });

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: resolved.map((r) => `'${r.actual.replace(/'/g, "''")}'`),
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const valueRanges = res.data.valueRanges ?? [];

  const all: ContentRecord[] = [];
  resolved.forEach((r, i) => {
    const values = (valueRanges[i]?.values ?? []) as string[][];
    const recs = transformSheet(r.target, values); // dùng target để parse market/assignee
    console.log(`- ${r.target}: ${recs.length} record`);
    all.push(...recs);
  });

  const sample = all.slice(0, MAX_RECORDS);

  const outDir = path.join(process.cwd(), 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'sample-import.json');
  fs.writeFileSync(outFile, JSON.stringify(sample, null, 2), 'utf-8');

  console.log(`\nTổng record đọc được: ${all.length}`);
  console.log(`Đã ghi ${sample.length} record đầu tiên -> ${path.relative(process.cwd(), outFile)}`);
}

main().catch((e) => {
  console.error('❌ Lỗi:', e instanceof Error ? e.message : e);
  process.exit(1);
});
