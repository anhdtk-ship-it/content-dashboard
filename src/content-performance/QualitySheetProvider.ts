/* ============================================================
 * QualitySheetProvider (CP-04)
 * ------------------------------------------------------------
 * Đọc TRỰC TIẾP Google Sheet "CLDT CONTENT" (Quality/CLĐT) — CHỈ ĐỌC, KHÔNG ghi.
 * ĐỘC LẬP HOÀN TOÀN với các module khác — chỉ dùng chung `createGoogleAuth()`.
 *
 * Cấu trúc thật (đã audit ở CP-03A, KHÔNG suy đoán): tab này là NHIỀU BLOCK THÁNG nối tiếp
 * theo chiều dọc (mỗi block = 1 dòng tiêu đề "BÁO CÁO CLDT THEO CONTENT THÁNG x/2026" + 3 dòng
 * header lồng nhau + N dòng dữ liệu). Trong mỗi block: dòng "Facebook CGSĐ"/"Facebook BS"/...
 * là dòng NHÓM (subtotal) — Content thật nằm ở các dòng SAU nó, thuộc nhóm đó theo VỊ TRÍ
 * (không có cột kênh riêng trên từng dòng, khác Performance Sheet).
 *
 * V1: dùng "Grand Total" (Nước ngoài + Trong nước cộng lại, tự tính — KHÔNG có sẵn breakdown
 * theo từng nhãn CLĐT ở cấp Grand Total trong Sheet) cho 4 chỉ số Care giá/Tích cực/Tiêu cực/
 * MQH chưa XĐ. Cột "Tên CGSĐ"/"ROAS NN"/"ROAS NĐ" KHÔNG dùng (không phải Biên tập chính thức;
 * ROAS lấy từ Performance Sheet, không lấy từ đây để tránh 2 nguồn ROAS xung đột).
 * ========================================================== */
import { google } from 'googleapis';
import { createGoogleAuth } from '../google-auth';
import type { RawQualityContentRow, QualityMetrics } from './types';

function parseCount(v: unknown): number {
  const s = (v ?? '').toString().trim();
  if (!s) return 0;
  const n = parseInt(s.replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function isJunkContentName(name: string): boolean {
  const n = name.trim();
  if (!n) return true;
  if (n === 'Ko có tên content') return true;
  if (n.length <= 2) return true;
  return false;
}

type Subcat = 'care' | 'positive' | 'negative' | 'unknown' | 'nnTotal' | 'tnTotal' | 'grandTotal';

/** Dựng bảng tra cột cho 1 block (3 dòng header: Địa lý / Nhãn CLĐT / Số lượng-Tỷ lệ). */
function buildColumnMap(geoRow: string[], subcatRow: string[], colRow: string[], maxCols: number): Map<string, number> {
  const map = new Map<string, number>();
  let curGeo: 'nn' | 'tn' | null = null;
  let curSubcat: Subcat | null = null;
  for (let c = 0; c < maxCols; c++) {
    const g = (geoRow[c] ?? '').toString().trim();
    if (/^Nước ngoài/i.test(g)) curGeo = 'nn';
    else if (/^Trong nước/i.test(g)) curGeo = 'tn';

    const sc = (subcatRow[c] ?? '').toString().trim();
    if (/^Care giá/i.test(sc)) curSubcat = 'care';
    else if (/^Tích cực/i.test(sc)) curSubcat = 'positive';
    else if (/^Tiêu cực/i.test(sc)) curSubcat = 'negative';
    else if (/^MQH/i.test(sc)) curSubcat = 'unknown';
    else if (/^nước ngoài Total/i.test(sc)) curSubcat = 'nnTotal';
    else if (/^Trong nước Total/i.test(sc)) curSubcat = 'tnTotal';
    else if (/^Grand Total/i.test(sc)) curSubcat = 'grandTotal';

    const vt = (colRow[c] ?? '').toString().trim();
    if (!curSubcat) continue;
    if (/^Số lượng/i.test(vt) && curGeo) map.set(`${curGeo}:${curSubcat}:count`, c);
    else if (/^Tỷ lệ/i.test(vt) && curGeo) { /* rate — không dùng ở V1, tự tính lại từ count */ }
    else if (curSubcat === 'nnTotal' || curSubcat === 'tnTotal' || curSubcat === 'grandTotal') {
      if (!map.has(curSubcat)) map.set(curSubcat, c);
    }
  }
  return map;
}

const safeRate = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0);

export class QualitySheetProvider {
  async fetchRows(): Promise<RawQualityContentRow[]> {
    const spreadsheetId = process.env.QUALITY_SHEET_ID?.trim();
    const tab = process.env.QUALITY_SHEET_TAB?.trim();
    if (!spreadsheetId) throw new Error('Thiếu QUALITY_SHEET_ID trong env.');
    if (!tab) throw new Error('Thiếu QUALITY_SHEET_TAB trong env.');

    const sheets = google.sheets({ version: 'v4', auth: createGoogleAuth() });
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
    const titles = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? '');
    const actual = titles.find((t) => t.trim() === tab.trim()) ?? titles.find((t) => t.trim().toLowerCase() === tab.trim().toLowerCase());
    if (!actual) throw new Error(`Không tìm thấy tab "${tab}" trong Quality Spreadsheet. Có: ${titles.join(', ')}`);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId, range: `'${actual.replace(/'/g, "''")}'`, valueRenderOption: 'FORMATTED_VALUE',
    });
    const rows = (res.data.values ?? []) as string[][];
    if (!rows.length) return [];

    // Tìm mọi mốc tiêu đề block tháng: "... THÁNG x/yyyy ..." — KHÔNG hard-code số block.
    const blockStarts: { rowIdx: number; month: string }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const cell = (rows[i] ?? []).find((c) => /THÁNG\s+\d{1,2}\/\d{4}/.test(c ?? ''));
      if (!cell) continue;
      const m = cell.match(/THÁNG\s+(\d{1,2})\/(\d{4})/);
      if (m) blockStarts.push({ rowIdx: i, month: `${m[2]}-${m[1].padStart(2, '0')}` });
    }

    const out: RawQualityContentRow[] = [];
    for (let b = 0; b < blockStarts.length; b++) {
      const { rowIdx: titleIdx, month } = blockStarts[b];
      const geoRow = rows[titleIdx + 1] ?? [];
      const subcatRow = rows[titleIdx + 2] ?? [];
      const colRow = rows[titleIdx + 3] ?? [];
      const maxCols = Math.max(geoRow.length, subcatRow.length, colRow.length);
      const colMap = buildColumnMap(geoRow, subcatRow, colRow, maxCols);

      const dataStart = titleIdx + 4;
      const dataEnd = b + 1 < blockStarts.length ? blockStarts[b + 1].rowIdx : rows.length;

      let currentChannel = '';
      for (let r = dataStart; r < dataEnd; r++) {
        const row = rows[r] ?? [];
        const label = (row[1] ?? '').toString().trim();
        if (!label) continue;
        if (/^Facebook /i.test(label)) { currentChannel = label; continue; } // dòng nhóm (subtotal) — không phải content
        if (isJunkContentName(label)) continue;

        const get = (key: string) => parseCount(row[colMap.get(key) ?? -1]);
        const nnCare = get('nn:care:count'), tnCare = get('tn:care:count');
        const nnPos = get('nn:positive:count'), tnPos = get('tn:positive:count');
        const nnNeg = get('nn:negative:count'), tnNeg = get('tn:negative:count');
        const nnUnk = get('nn:unknown:count'), tnUnk = get('tn:unknown:count');
        const nnTotal = colMap.has('nnTotal') ? parseCount(row[colMap.get('nnTotal')!]) : 0;
        const tnTotal = colMap.has('tnTotal') ? parseCount(row[colMap.get('tnTotal')!]) : 0;
        const grandTotal = colMap.has('grandTotal') ? parseCount(row[colMap.get('grandTotal')!]) : (nnTotal + tnTotal);

        const careCount = nnCare + tnCare;
        const posCount = nnPos + tnPos;
        const negCount = nnNeg + tnNeg;
        const unkCount = nnUnk + tnUnk;
        const grandTotalReal = grandTotal || (careCount + posCount + negCount + unkCount);

        const metrics: QualityMetrics = {
          carePriceCount: careCount, carePriceRate: safeRate(careCount, grandTotalReal),
          positiveCount: posCount, positiveRate: safeRate(posCount, grandTotalReal),
          negativeCount: negCount, negativeRate: safeRate(negCount, grandTotalReal),
          unknownCount: unkCount, unknownRate: safeRate(unkCount, grandTotalReal),
        };

        out.push({ channel: currentChannel, contentName: label, month, grandTotal: metrics });
      }
    }
    return out;
  }
}
