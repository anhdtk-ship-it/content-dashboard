import 'dotenv/config';
import { google, sheets_v4 } from 'googleapis';
import { EXCLUDED_SHEETS } from './sheets-reader';

/** Một dòng rỗng nếu mọi ô đều trống/whitespace. */
function isEmptyRow(row: string[]): boolean {
  return !row || row.every((c) => (c ?? '').toString().trim() === '');
}

/** So khớp tên sheet với danh sách loại trừ. */
function isExcluded(name: string): boolean {
  const t = name.trim();
  return EXCLUDED_SHEETS.some((ex) => ex.trim() === t);
}

/** Tìm dòng header: ưu tiên dòng có ô "STT", nếu không có thì dòng không trống đầu tiên. */
function findHeaderRowIndex(rows: string[][]): number {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]?.some((c) => (c ?? '').toString().trim().toUpperCase() === 'STT')) {
      return i;
    }
  }
  for (let i = 0; i < rows.length; i++) {
    if (!isEmptyRow(rows[i])) return i;
  }
  return -1;
}

function getSheetsClient(): sheets_v4.Sheets {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_CREDENTIALS_PATH!,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function main(): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error('Thiếu GOOGLE_SHEET_ID trong .env');

  console.log('Excluded sheets:');
  EXCLUDED_SHEETS.forEach((n) => console.log(`* ${n}`));
  console.log('');

  const sheets = getSheetsClient();

  // Danh sách sheet hợp lệ (loại EXCLUDED)
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  const names = (meta.data.sheets ?? [])
    .map((s) => s.properties?.title ?? '')
    .filter((t) => t !== '' && !isExcluded(t));

  // Đọc toàn bộ dữ liệu các sheet hợp lệ
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: names.map((n) => `'${n.replace(/'/g, "''")}'`),
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const valueRanges = res.data.valueRanges ?? [];

  names.forEach((name, i) => {
    const values = (valueRanges[i]?.values ?? []) as string[][];
    const headerIdx = findHeaderRowIndex(values);

    const header = headerIdx >= 0 ? values[headerIdx] ?? [] : [];
    // Chỉ in các cột có tên (bỏ ô trống ở header)
    const headerNames = header
      .map((c) => (c ?? '').toString().trim())
      .filter((c) => c !== '');

    // 5 dòng dữ liệu đầu tiên (không trống) sau header
    const sample = values
      .slice(headerIdx + 1)
      .filter((r) => !isEmptyRow(r))
      .slice(0, 5);

    console.log('==================================================');
    console.log(`Sheet: ${name}`);
    console.log('');
    console.log('Detected Headers:');
    if (headerNames.length === 0) {
      console.log('* (không phát hiện header)');
    } else {
      headerNames.forEach((h) => console.log(`* ${h}`));
    }
    console.log('');
    console.log('Sample Data:');
    if (sample.length === 0) {
      console.log('[]');
    } else {
      sample.forEach((row) => console.log(JSON.stringify(row)));
    }
    console.log('');
  });
}

main().catch((e) => {
  console.error('❌ Lỗi:', e instanceof Error ? e.message : e);
  process.exit(1);
});
