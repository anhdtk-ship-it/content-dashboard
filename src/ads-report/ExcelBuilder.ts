/* ============================================================
 * Ads Report (AR-01) — dựng file Excel từ KẾT QUẢ của AdsReportService.
 * KHÔNG tự đọc Sheet, KHÔNG tự tính lại số → file tải về luôn khớp đúng những gì
 * người dùng đang nhìn trên dashboard.
 *
 * Mọi con số ở đây đều là giá trị ĐỌC NGUYÊN từ file ROAS (xem AdsReportService).
 * Ô nào Sheet không có (Giá data / ROAS của dòng "cả team" ở tháng loại trừ Khiêm) thì
 * ghi "—", KHÔNG tự suy ra.
 *
 * Bố cục sổ: Tổng quan · Top chi tiêu (cả team + từng nhân viên) · ROAS (từng nhân viên).
 * ========================================================== */
import ExcelJS from 'exceljs';
import type { AdsReportResult, DongChiTieu, KhoiRoasNhanVien, NhomDiaLy, TongChiTieu } from './types';

const MAU = { dam: 'FF1F3864', khoi: 'FF2E75B6', canhBao: 'FFBF8F00', header: 'FFD9E1F2', tong: 'FFFFF2CC' };
const VND = '#,##0';
const PCT = '0.00%';
const TRONG = '—';

const NHAN_DIA_LY: Record<NhomDiaLy, string> = { noiDia: 'NỘI ĐỊA', quocTe: 'QUỐC TẾ' };

function dongTieuDe(ws: ExcelJS.Worksheet, text: string, span: number, mau = MAU.dam): void {
  const r = ws.addRow([text]);
  ws.mergeCells(r.number, 1, r.number, span);
  const c = r.getCell(1);
  c.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: mau } };
  c.alignment = { vertical: 'middle' };
  r.height = 22;
}

function dongGhiChu(ws: ExcelJS.Worksheet, text: string, span: number): void {
  const r = ws.addRow([text]);
  ws.mergeCells(r.number, 1, r.number, span);
  r.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF808080' } };
  r.getCell(1).alignment = { wrapText: true, vertical: 'top' };
}

function dongHeader(ws: ExcelJS.Worksheet, cols: string[]): void {
  const r = ws.addRow(cols);
  r.eachCell((c) => {
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAU.header } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });
  r.height = 30;
}

function keDuLieu(ws: ExcelJS.Worksheet, tu: number, den: number, fmt: Record<number, string>): void {
  for (let i = tu; i <= den; i++) {
    ws.getRow(i).eachCell((c, ci) => {
      c.border = { top: { style: 'hair' }, left: { style: 'hair' }, bottom: { style: 'hair' }, right: { style: 'hair' } };
      if (fmt[ci] && typeof c.value === 'number') c.numFmt = fmt[ci];
    });
  }
}

function dongTong(ws: ExcelJS.Worksheet, cells: (string | number | null)[], fmt: Record<number, string>): void {
  const r = ws.addRow(cells);
  r.eachCell((c, ci) => {
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAU.tong } };
    if (fmt[ci] && typeof c.value === 'number') c.numFmt = fmt[ci];
    c.border = { top: { style: 'thin' }, bottom: { style: 'double' } };
  });
}

/** Tên sheet Excel: tối đa 31 ký tự, không chứa : \ / ? * [ ] */
function tenSheet(s: string): string {
  return s.replace(/[:\\/?*[\]]/g, '-').slice(0, 31);
}

const thangNhan = (thang: string) => `THÁNG ${thang.slice(5)}/${thang.slice(0, 4)}`;

/* ---------- Sheet: Top chi tiêu ---------- */
function sheetChiTieu(
  wb: ExcelJS.Workbook, ten: string, rows: DongChiTieu[], topN: number,
  thang: string, ghiChu: string, hienCotNV: boolean,
): void {
  const ws = wb.addWorksheet(tenSheet(ten));
  ws.columns = hienCotNV
    ? [{ width: 6 }, { width: 56 }, { width: 20 }, { width: 15 }, { width: 13 }, { width: 15 }, { width: 10 }, { width: 13 }, { width: 13 }]
    : [{ width: 6 }, { width: 56 }, { width: 20 }, { width: 13 }, { width: 15 }, { width: 10 }, { width: 13 }, { width: 13 }];
  const c0 = hienCotNV ? 1 : 0;   // dịch cột khi có thêm cột "Nhân viên"
  const FMT: Record<number, string> = {
    [3 + c0]: VND, [4 + c0]: VND, [5 + c0]: VND, [6 + c0]: PCT, [7 + c0]: PCT,
  };

  dongTieuDe(ws, `TOP CONTENT TIÊU NHIỀU TIỀN NHẤT — ${thangNhan(thang)}`, hienCotNV ? 9 : 8);
  dongGhiChu(ws, ghiChu, hienCotNV ? 9 : 8);

  for (const g of ['noiDia', 'quocTe'] as NhomDiaLy[]) {
    const all = rows.filter((d) => d.diaLy === g);
    if (!all.length) continue;
    ws.addRow([]);
    dongTieuDe(ws, NHAN_DIA_LY[g], hienCotNV ? 9 : 8, MAU.khoi);
    dongHeader(ws, ['#', 'Tên content', 'Phân loại', ...(hienCotNV ? ['Nhân viên'] : []),
      'Giá data', 'Ngân sách', 'SL data', 'Roas trong tháng', 'Roas 3 tháng']);

    const list = all.slice(0, topN);
    const tu = ws.rowCount + 1;
    list.forEach((d, i) => ws.addRow([
      i + 1, d.content, d.phanLoai, ...(hienCotNV ? [d.nhanVien] : []),
      d.chiSo.giaData, d.chiSo.chiPhi, d.chiSo.slData, d.chiSo.roasThang, d.chiSo.roas3Thang,
    ]));
    keDuLieu(ws, tu, ws.rowCount, FMT);

    // Dòng TỔNG là phép CỘNG của đúng các dòng đang liệt kê — ghi rõ, không phải số của Sheet.
    const chiPhi = list.reduce((s, d) => s + d.chiSo.chiPhi, 0);
    const slData = list.reduce((s, d) => s + d.chiSo.slData, 0);
    dongTong(ws, ['', `CỘNG ${list.length} CONTENT ĐANG LIỆT KÊ${all.length > list.length ? ` (trên tổng ${all.length})` : ''}`,
      '', ...(hienCotNV ? [''] : []), null, chiPhi, slData, null, null], FMT);
  }
}

/* ---------- Sheet: ROAS theo nhân viên ---------- */
function sheetRoas(wb: ExcelJS.Workbook, k: KhoiRoasNhanVien, thang: string): void {
  const ws = wb.addWorksheet(tenSheet(`ROAS - ${k.nhan}`));
  ws.columns = [{ width: 6 }, { width: 56 }, { width: 20 }, { width: 15 },
    { width: 10 }, { width: 13 }, { width: 14 }, { width: 14 }];
  const FMT = { 4: VND, 5: VND, 6: VND, 7: PCT, 8: PCT };

  dongTieuDe(ws, `CONTENT PHÁT SINH ROAS — ${k.full.toUpperCase()} — ${thangNhan(thang)}`, 8);
  dongGhiChu(ws, `Nguồn: tab "${k.roasTab}" trong file ROAS — đọc nguyên giá trị ô. Điều kiện: Roas trong tháng > 0 HOẶC Roas 3 tháng > 0.`, 8);

  for (const g of ['noiDia', 'quocTe'] as NhomDiaLy[]) {
    const khoi = k[g];
    ws.addRow([]);
    dongTieuDe(ws, NHAN_DIA_LY[g], 8, MAU.khoi);
    dongHeader(ws, ['#', 'Tên content', 'Phân loại', 'Chi phí', 'SL data', 'Giá data', 'Roas trong tháng', 'Roas 3 tháng']);

    if (!khoi.rows.length) {
      const e = ws.addRow(['', '(không có content nào phát sinh ROAS)']);
      e.getCell(2).font = { italic: true, color: { argb: 'FF808080' } };
      continue;
    }
    const tu = ws.rowCount + 1;
    khoi.rows.forEach((x, i) => {
      const c = x[g];
      ws.addRow([i + 1, x.content, x.phanLoai, c.chiPhi, c.slData, c.giaData, c.roasThang, c.roas3Thang]);
    });
    keDuLieu(ws, tu, ws.rowCount, FMT);
    dongTong(ws, ['', `CỘNG ${khoi.rows.length} CONTENT ĐANG LIỆT KÊ`, '', khoi.tongChiPhi, khoi.tongSlData, null, null, null], FMT);
  }
}

/* ---------- Sổ Excel hoàn chỉnh ---------- */
export async function buildExcel(data: AdsReportResult, topTeam = 30, topNV = 20): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Content Dashboard';
  wb.created = new Date();
  const thang = data.thang;
  const nhieuNV = data.chiTieu.theoNhanVien.length > 1;

  /* --- Tổng quan --- */
  const ws = wb.addWorksheet('Tổng quan');
  ws.columns = [{ width: 24 }, ...Array.from({ length: 15 }, () => ({ width: 14 }))];
  dongTieuDe(ws, `BÁO CÁO ADS ${thangNhan(thang)}`, 16);
  for (const n of data.meta.nguon) dongGhiChu(ws, '• ' + n, 16);
  for (const c of data.meta.canhBao) dongGhiChu(ws, '⚠ ' + c, 16);

  ws.addRow([]);
  dongTieuDe(ws, 'A. CHI TIÊU & ROAS THEO NHÂN VIÊN — đọc nguyên tab "Roas tổng"', 16, MAU.khoi);
  dongHeader(ws, ['Nhân viên',
    'NĐ Chi phí', 'NĐ SL data', 'NĐ Giá data', 'NĐ Roas tháng', 'NĐ Roas 3 tháng',
    'QT Chi phí', 'QT SL data', 'QT Giá data', 'QT Roas tháng', 'QT Roas 3 tháng',
    'Tổng Chi phí', 'Tổng SL data', 'Tổng Giá data', 'Tổng Roas tháng', 'Tổng Roas 3 tháng']);

  const FMT_A: Record<number, string> = {
    2: VND, 3: VND, 4: VND, 5: PCT, 6: PCT,
    7: VND, 8: VND, 9: VND, 10: PCT, 11: PCT,
    12: VND, 13: VND, 14: VND, 15: PCT, 16: PCT,
  };
  /** Ô Sheet không có (dòng cả team ở tháng loại Khiêm) → "—", không bịa số. */
  const hang = (t: TongChiTieu): (string | number)[] => {
    const v = (x: number, thieu: boolean) => (thieu ? TRONG : x);
    return [
      t.full,
      t.noiDia.chiPhi, t.noiDia.slData, v(t.noiDia.giaData, t.thieuChiSoGop), v(t.noiDia.roasThang, t.thieuChiSoGop), v(t.noiDia.roas3Thang, t.thieuChiSoGop),
      t.quocTe.chiPhi, t.quocTe.slData, v(t.quocTe.giaData, t.thieuChiSoGop), v(t.quocTe.roasThang, t.thieuChiSoGop), v(t.quocTe.roas3Thang, t.thieuChiSoGop),
      t.tong.chiPhi, t.tong.slData, v(t.tong.giaData, t.thieuChiSoGop), v(t.tong.roasThang, t.thieuChiSoGop), v(t.tong.roas3Thang, t.thieuChiSoGop),
    ];
  };
  const tuA = ws.rowCount + 1;
  for (const t of data.chiTieu.theoNhanVien) ws.addRow(hang(t));
  keDuLieu(ws, tuA, ws.rowCount, FMT_A);
  if (nhieuNV) {
    const t = data.chiTieu.team;
    dongTong(ws, [...hang(t).slice(0, 1).map(() => (t.tuSheet ? 'CẢ TEAM' : 'CẢ TEAM (cộng 4 dòng trên)')), ...hang(t).slice(1)], FMT_A);
  }

  ws.addRow([]);
  dongTieuDe(ws, 'B. CONTENT PHÁT SINH ROAS — đọc nguyên tab nhân viên', 16, MAU.khoi);
  dongHeader(ws, ['Nhân viên', 'NĐ SL content', 'NĐ Chi phí', 'NĐ SL data',
    'QT SL content', 'QT Chi phí', 'QT SL data', '', '', '', '', '', '', '', '', '']);
  const tuB = ws.rowCount + 1;
  for (const k of data.roas) {
    ws.addRow([k.full, k.noiDia.rows.length, k.noiDia.tongChiPhi, k.noiDia.tongSlData,
      k.quocTe.rows.length, k.quocTe.tongChiPhi, k.quocTe.tongSlData]);
  }
  keDuLieu(ws, tuB, ws.rowCount, { 2: VND, 3: VND, 4: VND, 5: VND, 6: VND, 7: VND });
  dongGhiChu(ws, 'Chi phí ở mục B chỉ cộng các content phát sinh ROAS — KHÔNG phải tổng chi tiêu cả kỳ (xem mục A).', 16);

  /* --- Top chi tiêu --- */
  sheetChiTieu(wb, nhieuNV ? 'Top chi tiêu - Cả team' : `Top - ${data.chiTieu.theoNhanVien[0]?.nhan ?? ''}`,
    data.chiTieu.rows, nhieuNV ? topTeam : topNV, thang, data.chiTieu.team.full, nhieuNV);
  if (nhieuNV) {
    for (const t of data.chiTieu.theoNhanVien) {
      sheetChiTieu(wb, `Top - ${t.nhan}`, data.chiTieu.rows.filter((d) => d.nhanVienKey === t.nhanVienKey),
        topNV, thang, t.full, false);
    }
  }
  /* --- ROAS từng người --- */
  for (const k of data.roas) sheetRoas(wb, k, thang);

  // exceljs trả kiểu Buffer riêng của nó (ArrayBuffer-like) — bọc lại thành Buffer của Node.
  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}
