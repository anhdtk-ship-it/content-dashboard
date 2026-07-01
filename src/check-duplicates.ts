import 'dotenv/config';
import { google, sheets_v4 } from 'googleapis';
import { createGoogleAuth } from './google-auth';

const TARGET_SHEETS = [
  'NĐ Hiếu', 'QT Hiếu', 'NĐ Ánh', 'QT Ánh',
  'NĐ KA', 'QT KA', 'NĐ Liên', 'QT Liên',
];

interface Row {
  content_code: string;
  market: string;
  assignee_name: string;
  sheet: string;
}

function isEmptyRow(row: string[]): boolean {
  return !row || row.every((c) => (c ?? '').toString().trim() === '');
}
function parseSheetName(name: string): { market: string; assignee: string } {
  const t = name.trim();
  if (/^QT(\s+|$)/i.test(t)) return { market: 'quoc_te', assignee: t.replace(/^QT/i, '').trim() };
  if (/^NĐ(\s+|$)/i.test(t)) return { market: 'noi_dia', assignee: t.replace(/^NĐ/i, '').trim() };
  return { market: '', assignee: '' };
}
function findHeaderRowIndex(rows: string[][]): number {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]?.some((c) => (c ?? '').toString().trim().toUpperCase() === 'STT')) return i;
  }
  return -1;
}
function colIndex(header: string[], name: string): number {
  const target = name.trim().toLowerCase();
  return header.findIndex((c) => (c ?? '').toString().trim().toLowerCase() === target);
}

async function main(): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;
  const sheets: sheets_v4.Sheets = google.sheets({ version: 'v4', auth: createGoogleAuth() });

  // resolve tên sheet thật (chống khoảng trắng thừa)
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const titles = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? '');
  const resolved = TARGET_SHEETS.map((t) => ({
    target: t,
    actual: titles.find((x) => x.trim() === t.trim())!,
  }));

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: resolved.map((r) => `'${r.actual.replace(/'/g, "''")}'`),
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const valueRanges = res.data.valueRanges ?? [];

  const rows: Row[] = [];
  resolved.forEach((r, i) => {
    const values = (valueRanges[i]?.values ?? []) as string[][];
    const headerIdx = findHeaderRowIndex(values);
    if (headerIdx === -1) return;
    const header = values[headerIdx];
    const cIdx = colIndex(header, 'ID content 1');
    const { market, assignee } = parseSheetName(r.target);
    for (const row of values.slice(headerIdx + 1)) {
      if (isEmptyRow(row)) continue;
      const code = (row[cIdx] ?? '').toString().trim();
      if (!code) continue;
      rows.push({ content_code: code, market, assignee_name: assignee, sheet: r.target });
    }
  });

  console.log(`Tổng record có content_code: ${rows.length}`);
  console.log(`Số content_code phân biệt   : ${new Set(rows.map((r) => r.content_code)).size}\n`);

  // Gom theo content_code
  const byCode = new Map<string, Row[]>();
  for (const r of rows) {
    if (!byCode.has(r.content_code)) byCode.set(r.content_code, []);
    byCode.get(r.content_code)!.push(r);
  }

  // (1) content_code trùng (xuất hiện > 1 lần)
  const dup = [...byCode.entries()].filter(([, rs]) => rs.length > 1);
  console.log(`================ TRÙNG content_code ================`);
  console.log(`Số content_code xuất hiện > 1 lần: ${dup.length}`);
  console.log(`Tổng số dòng thuộc nhóm trùng    : ${dup.reduce((s, [, rs]) => s + rs.length, 0)}\n`);

  // (2) Thống kê độ phủ
  let multiSheet = 0, multiMarket = 0, multiAssignee = 0;
  // vi phạm khóa (content_code, market, assignee_name)
  const keyViolations: { code: string; market: string; assignee: string; count: number; sheets: string[] }[] = [];

  for (const [code, rs] of byCode.entries()) {
    const sheetsSet = new Set(rs.map((r) => r.sheet));
    const marketSet = new Set(rs.map((r) => r.market));
    const assigneeSet = new Set(rs.map((r) => r.assignee_name));
    if (sheetsSet.size > 1) multiSheet++;
    if (marketSet.size > 1) multiMarket++;
    if (assigneeSet.size > 1) multiAssignee++;

    // kiểm tra trùng trong cùng (code, market, assignee)
    const combo = new Map<string, Row[]>();
    for (const r of rs) {
      const k = `${r.market}||${r.assignee_name}`;
      if (!combo.has(k)) combo.set(k, []);
      combo.get(k)!.push(r);
    }
    for (const [k, group] of combo.entries()) {
      if (group.length > 1) {
        const [m, a] = k.split('||');
        keyViolations.push({ code, market: m, assignee: a, count: group.length, sheets: group.map((g) => g.sheet) });
      }
    }
  }

  console.log(`================ ĐỘ PHỦ (trên các content_code phân biệt) ================`);
  console.log(`Xuất hiện ở > 1 SHEET    : ${multiSheet}`);
  console.log(`Xuất hiện ở > 1 MARKET   : ${multiMarket}`);
  console.log(`Xuất hiện ở > 1 ASSIGNEE : ${multiAssignee}\n`);

  // Top vài ví dụ trùng nhiều nhất
  const top = [...dup].sort((a, b) => b[1].length - a[1].length).slice(0, 8);
  console.log(`--- Top content_code lặp nhiều nhất ---`);
  for (const [code, rs] of top) {
    const where = rs.map((r) => r.sheet).join(', ');
    console.log(`(${rs.length}x) ${code}\n      -> ${where}`);
  }
  console.log('');

  // (3)/(4) Đánh giá khóa (content_code, market, assignee_name)
  console.log(`================ ĐÁNH GIÁ KHÓA (content_code, market, assignee_name) ================`);
  if (keyViolations.length === 0) {
    console.log(`✅ DUY NHẤT: không có bộ (content_code, market, assignee_name) nào trùng.`);
    console.log(`   => Phù hợp làm UNIQUE KEY.`);
  } else {
    console.log(`❌ KHÔNG duy nhất: có ${keyViolations.length} bộ (content_code, market, assignee_name) bị lặp.`);
    keyViolations.slice(0, 10).forEach((v) =>
      console.log(`   (${v.count}x) [${v.market} · ${v.assignee}] ${v.code}  @ ${v.sheets.join(', ')}`)
    );
    if (keyViolations.length > 10) console.log(`   ... và ${keyViolations.length - 10} bộ khác`);
  }
}

main().catch((e) => { console.error('❌ Lỗi:', e instanceof Error ? e.message : e); process.exit(1); });
