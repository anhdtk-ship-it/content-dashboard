import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { google, sheets_v4 } from 'googleapis';
import { createGoogleAuth } from './google-auth';

/* ============================================================
 * Cấu hình: các sheet KHÔNG BAO GIỜ được đọc
 * ========================================================== */
export const EXCLUDED_SHEETS = [
  'QT Khiêm',
  'NĐ Khiêm',
];

/** So khớp tên sheet với danh sách loại trừ (bỏ qua khoảng trắng thừa). */
function isExcluded(sheetName: string): boolean {
  const target = sheetName.trim();
  return EXCLUDED_SHEETS.some((ex) => ex.trim() === target);
}

/* ============================================================
 * Types
 * ========================================================== */
export interface SheetReport {
  sheetName: string;
  market: string;       // "Quốc tế" | "Nội địa" | ""
  assignee: string;     // Hiếu, Ánh, ... | ""
  totalRows: number;    // tổng dòng không trống (đã bỏ dòng rỗng)
  totalContents: number; // số content thực tế
  rows: Record<string, string>[] | string[][];
}

/* ============================================================
 * Helpers
 * ========================================================== */

/** Một dòng được coi là rỗng nếu tất cả ô đều trống/whitespace. */
function isEmptyRow(row: string[]): boolean {
  return !row || row.every((cell) => (cell ?? '').toString().trim() === '');
}

/** Parse market + assignee từ tên sheet ("QT Hiếu" -> Quốc tế / Hiếu). */
function parseSheetName(name: string): { market: string; assignee: string } {
  const trimmed = name.trim();
  // Dùng \s+|$ thay cho \b vì \b không nhận diện ranh giới quanh ký tự Unicode "Đ".
  if (/^QT(\s+|$)/i.test(trimmed)) {
    return { market: 'Quốc tế', assignee: trimmed.replace(/^QT/i, '').trim() };
  }
  if (/^NĐ(\s+|$)/i.test(trimmed)) {
    return { market: 'Nội địa', assignee: trimmed.replace(/^NĐ/i, '').trim() };
  }
  return { market: '', assignee: '' };
}

/** Tìm dòng header: dòng đầu tiên có ô "STT". Trả -1 nếu không có. */
function findHeaderRowIndex(rows: string[][]): number {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]?.some((c) => (c ?? '').toString().trim().toUpperCase() === 'STT')) {
      return i;
    }
  }
  return -1;
}

/** Chuẩn hoá header thành key duy nhất (xử lý trùng tên cột). */
function buildHeaderKeys(header: string[]): string[] {
  const seen = new Map<string, number>();
  return header.map((h, idx) => {
    let key = (h ?? '').toString().trim();
    if (key === '') key = `col_${idx}`;
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    return count === 0 ? key : `${key}_${count + 1}`;
  });
}

/* ============================================================
 * Core
 * ========================================================== */

function getSheetsClient(): sheets_v4.Sheets {
  return google.sheets({ version: 'v4', auth: createGoogleAuth() });
}

/** Lấy danh sách tên tất cả sheet. */
async function listSheetNames(sheets: sheets_v4.Sheets, spreadsheetId: string): Promise<string[]> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  return (meta.data.sheets ?? [])
    .map((s) => s.properties?.title ?? '')
    // Loại bỏ tuyệt đối các sheet trong EXCLUDED_SHEETS: không đọc, không đếm,
    // không đưa vào batchGet/JSON/báo cáo. Sheet mới khác vẫn được đọc mặc định.
    .filter((title) => title !== '' && !isExcluded(title));
}

/** Phân tích 1 sheet thành SheetReport. */
function analyzeSheet(sheetName: string, values: string[][]): SheetReport {
  const { market, assignee } = parseSheetName(sheetName);

  // Bỏ qua các dòng trống
  const nonEmpty = (values ?? []).filter((r) => !isEmptyRow(r));

  const headerIdx = findHeaderRowIndex(values ?? []);
  const isContentSheet = headerIdx !== -1 && (market !== '' || assignee !== '');

  if (isContentSheet) {
    const header = values[headerIdx] ?? [];
    const keys = buildHeaderKeys(header);

    // Cột định danh content thật
    const idColIdx = header.findIndex(
      (c) => (c ?? '').toString().trim().toLowerCase() === 'id content 1'
    );

    // Data = các dòng sau header, không trống
    const dataRows = values
      .slice(headerIdx + 1)
      .filter((r) => !isEmptyRow(r));

    const rows: Record<string, string>[] = dataRows.map((r) => {
      const obj: Record<string, string> = {};
      keys.forEach((k, i) => {
        obj[k] = (r[i] ?? '').toString().trim();
      });
      return obj;
    });

    // content thật = dòng có "ID content 1" không trống (fallback: mọi data row)
    const totalContents =
      idColIdx >= 0
        ? dataRows.filter((r) => (r[idColIdx] ?? '').toString().trim() !== '').length
        : dataRows.length;

    return {
      sheetName,
      market,
      assignee,
      totalRows: dataRows.length,
      totalContents,
      rows,
    };
  }

  // Sheet phụ trợ (Overview, Đã lọc, ID FB, Check content, ...) -> giữ raw
  return {
    sheetName,
    market,
    assignee,
    totalRows: nonEmpty.length,
    totalContents: nonEmpty.length,
    rows: nonEmpty,
  };
}

/** Đọc & phân tích toàn bộ sheet trong spreadsheet. */
export async function readAllSheets(): Promise<SheetReport[]> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error('Thiếu GOOGLE_SHEET_ID trong .env');

  const sheets = getSheetsClient();
  const names = await listSheetNames(sheets, spreadsheetId);

  // Đọc toàn bộ dữ liệu mỗi sheet trong 1 lần gọi batchGet
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: names.map((n) => `'${n.replace(/'/g, "''")}'`),
    valueRenderOption: 'FORMATTED_VALUE',
  });

  const valueRanges = res.data.valueRanges ?? [];

  return names.map((name, i) =>
    analyzeSheet(name, (valueRanges[i]?.values ?? []) as string[][])
  );
}

/* ============================================================
 * Runnable report
 * ========================================================== */
async function main(): Promise<void> {
  console.log('Excluded sheets:');
  EXCLUDED_SHEETS.forEach((name) => console.log(`* ${name}`));
  console.log('');

  const reports = await readAllSheets();

  console.log('================ BÁO CÁO CONTENT ================\n');
  let grandTotal = 0;

  reports.forEach((r, idx) => {
    grandTotal += r.totalContents;
    const tag =
      r.market || r.assignee ? ` [${r.market}${r.assignee ? ' · ' + r.assignee : ''}]` : '';
    console.log(`${String(idx + 1).padStart(2, ' ')}. ${r.sheetName}${tag}`);
    console.log(`     Tổng số dòng   : ${r.totalRows}`);
    console.log(`     Tổng số content: ${r.totalContents}`);
  });

  console.log('\n=================================================');
  console.log(`TOTAL CONTENTS ALL SHEETS: ${grandTotal}`);
  console.log('=================================================');

  // Xuất JSON đầy đủ ra file để phân tích (không ghi DB)
  const outDir = path.join(process.cwd(), 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'contents-report.json');
  fs.writeFileSync(outFile, JSON.stringify(reports, null, 2), 'utf-8');
  console.log(`\n📄 JSON đầy đủ đã ghi: ${path.relative(process.cwd(), outFile)}`);
}

// Chỉ chạy khi gọi trực tiếp file này
if (require.main === module) {
  main().catch((e) => {
    console.error('❌ Lỗi:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
