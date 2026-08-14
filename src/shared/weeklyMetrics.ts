/* ============================================================
 * Weekly Report — MODULE TÍNH KPI DÙNG CHUNG (web Dashboard + PDF).
 * ------------------------------------------------------------
 * MỤC ĐÍCH: Dashboard Weekly Report và PDF phải hiển thị CÙNG MỘT SỐ LIỆU.
 * Vì vậy toàn bộ công thức KPI + sinh Đánh giá + Kế hoạch nằm DUY NHẤT ở đây;
 * cả `web/reports/services/WeeklyReportService.ts` và `reports/build_weekly_data.ts`
 * đều import module này → không thể lệch nhau.
 *
 * PURE: không I/O, không DOM, không fetch → chạy được cả trình duyệt lẫn Node.
 *
 * ĐỊNH NGHĨA KPI (chốt với chủ dự án):
 *   Đã cấp        = content UPLOAD trong kỳ (theo upload_date_real).
 *   Đã test       = trong "Đã cấp" & trạng thái ∈ {Đang test, Duy trì*, Đã test-ko chạy, Đã chạy-Tắt}.
 *   Tồn           = ĐÚNG trạng thái "Chờ chạy" (current_status === 'Chờ chạy'), KHÔNG tính
 *                   bất kỳ trạng thái nào khác (kể cả trống/chưa phân loại).
 *   Chờ đăng bài  = ĐÚNG trạng thái "Chờ đăng bài" (đã test/duyệt xong, chờ lên lịch đăng) —
 *                   nhóm RIÊNG, KHÔNG tính vào Tồn.
 *   Tỷ lệ test    = Đã test / Đã cấp.
 *   Duy trì tháng = trong "Đã cấp" & hiện đang "Duy trì" (giữ nguyên rule `win` cũ —
 *                   hệ thống KHÔNG lưu ngày đổi trạng thái nên dùng proxy này).
 *   Tỷ lệ Duy trì = Duy trì tháng / Đã test.
 *   Đang duy trì  = TOÀN BỘ content hiện ở trạng thái "Duy trì" (KHÔNG giới hạn kỳ upload).
 *
 * KHÔNG dùng chung logic với Ads Monitor / Dashboard Content (Business Rule riêng).
 * ========================================================== */

export type MarketKey = 'noi_dia' | 'quoc_te';
export const MARKETS: { key: MarketKey; label: string }[] = [
  { key: 'noi_dia', label: 'Nội địa' },
  { key: 'quoc_te', label: 'Quốc tế' },
];

/** Thứ tự dòng nhân viên theo yêu cầu; người ngoài danh sách xếp sau (A→Z). */
export const EMPLOYEE_ORDER = ['Hiếu', 'KA', 'Liên', 'Ánh'];

export interface DateRange { from: string; to: string; label: string }

/** Dòng content thô cần cho Weekly (đọc từ /api/v3/contents hoặc Supabase). */
export interface RawContent {
  market: string;
  assignee_name: string;
  current_status: string;
  upload_date_real: string | null; // 'YYYY-MM-DD'
}

export interface WeeklyKpi {
  capped: number;       // Đã cấp
  tested: number;       // Đã test
  ton: number;          // Tồn = đúng trạng thái "Chờ chạy"
  choDangBai: number;   // Chờ đăng bài = đúng trạng thái "Chờ đăng bài" (RIÊNG, không tính vào Tồn)
  rateTest: number;     // Đã test / Đã cấp
  duyTriThang: number;  // Duy trì tháng
  rateDuyTri: number;   // Duy trì tháng / Đã test
  dangDuyTri: number;   // Đang duy trì (all-time)
}

export interface EmployeeKpi { name: string; kpi: WeeklyKpi }

export interface MarketBlock {
  market: MarketKey;
  label: string;
  team: WeeklyKpi;
  employees: EmployeeKpi[];
}

export interface WeeklyReportData {
  range: DateRange;
  markets: MarketBlock[];
  generatedAt: string;
}

/** Đánh giá: key = `${tên nhân viên}|${market}`. Kế hoạch: theo market. */
export interface ReportNarrative {
  reviews: Record<string, string[]>;
  plans: Record<MarketKey, string[]>;
}

/* ---------- helpers ---------- */
const st = (r: RawContent) => (r.current_status ?? '').trim();
const isDuyTri = (s: string) => s.startsWith('Duy trì');
/** "Đã test" theo TRẠNG THÁI (chốt) — khớp định nghĩa đang dùng ở Dashboard Content. */
export const isTested = (s: string) =>
  s === 'Đang test' || isDuyTri(s) || s === 'Đã test-ko chạy' || s === 'Đã chạy-Tắt';
const inPeriod = (r: RawContent, from: string, to: string) =>
  !!r.upload_date_real && r.upload_date_real >= from && r.upload_date_real <= to;
const rate = (a: number, b: number) => (b > 0 ? a / b : 0);

export const fmtNum = (n: number) => (n ?? 0).toLocaleString('vi-VN');
export const fmtPct = (x: number) => `${Math.round((x ?? 0) * 1000) / 10}%`;

/** KPI cho 1 tập content (đã lọc sẵn market/nhân viên). `all` = tập KHÔNG lọc kỳ (cho Đang duy trì). */
export function calcKpi(all: RawContent[], range: DateRange): WeeklyKpi {
  const coh = all.filter((r) => inPeriod(r, range.from, range.to));
  const capped = coh.length;
  const tested = coh.filter((r) => isTested(st(r))).length;
  // Tồn = ĐÚNG trạng thái "Chờ chạy", không tính trạng thái nào khác.
  const ton = coh.filter((r) => st(r) === 'Chờ chạy').length;
  // Chờ đăng bài = ĐÚNG trạng thái "Chờ đăng bài" — nhóm riêng, KHÔNG gộp vào Tồn.
  const choDangBai = coh.filter((r) => st(r) === 'Chờ đăng bài').length;
  const duyTriThang = coh.filter((r) => isDuyTri(st(r))).length;
  const dangDuyTri = all.filter((r) => isDuyTri(st(r))).length; // ALL-TIME
  return {
    capped,
    tested,
    ton,
    choDangBai,
    rateTest: rate(tested, capped),
    duyTriThang,
    rateDuyTri: rate(duyTriThang, tested),
    dangDuyTri,
  };
}

function sortEmployees(names: string[]): string[] {
  const known = EMPLOYEE_ORDER.filter((n) => names.includes(n));
  const rest = names.filter((n) => !EMPLOYEE_ORDER.includes(n)).sort((a, b) => a.localeCompare(b, 'vi'));
  return [...known, ...rest];
}

/** Dựng toàn bộ dữ liệu báo cáo: 2 khối market, mỗi khối có team + danh sách nhân viên. */
export function buildWeeklyReport(rows: RawContent[], range: DateRange, generatedAt: string): WeeklyReportData {
  const markets: MarketBlock[] = MARKETS.map(({ key, label }) => {
    const mrows = rows.filter((r) => r.market === key);
    const names = sortEmployees([...new Set(mrows.map((r) => (r.assignee_name || '(trống)')))]);
    const employees: EmployeeKpi[] = names
      .map((name) => ({ name, kpi: calcKpi(mrows.filter((r) => (r.assignee_name || '(trống)') === name), range) }))
      // bỏ nhân viên không có gì để hiển thị ở market này
      .filter((e) => e.kpi.capped > 0 || e.kpi.dangDuyTri > 0);
    return { market: key, label, team: calcKpi(mrows, range), employees };
  });
  return { range, markets, generatedAt };
}

/* ============================================================
 * ĐÁNH GIÁ theo TỪNG nhân viên × TỪNG market — sinh từ KPI THỰC TẾ.
 * Mỗi ý gắn số cụ thể (không câu chung chung). ✓ = tốt · ⚠ = cần xử lý.
 * ========================================================== */
const LOW_TEST_RATE = 0.7;   // tỷ lệ test dưới ngưỡng → cần tăng tốc đưa vào Ads
const HIGH_TON = 3;          // tồn từ ngưỡng này → ưu tiên xử lý
const HIGH_CHO_DANG_BAI = 3; // chờ đăng bài từ ngưỡng này → ưu tiên lên lịch đăng
const GOOD_DUYTRI_RATE = 0.1; // tỷ lệ Duy trì đạt ngưỡng → chọn content hiệu quả
const MANY_DANG_DUYTRI = 5;  // đang duy trì nhiều → quản lý ổn định

export function reviewEmployee(kpi: WeeklyKpi): string[] {
  const out: string[] = [];
  if (kpi.capped === 0 && kpi.dangDuyTri === 0) return ['Không có content trong kỳ.'];

  if (kpi.capped > 0 && kpi.rateTest < LOW_TEST_RATE) {
    out.push(`⚠ Cần tăng tốc độ đưa Content vào Ads (mới test ${fmtNum(kpi.tested)}/${fmtNum(kpi.capped)} = ${fmtPct(kpi.rateTest)}).`);
  }
  if (kpi.ton >= HIGH_TON) {
    out.push(`⚠ Cần ưu tiên xử lý Content tồn (còn ${fmtNum(kpi.ton)} chưa đưa vào Ads).`);
  }
  if (kpi.choDangBai >= HIGH_CHO_DANG_BAI) {
    out.push(`⚠ Có ${fmtNum(kpi.choDangBai)} Content chờ đăng bài, cần lên lịch đăng sớm.`);
  }
  if (kpi.duyTriThang > 0 && kpi.rateDuyTri >= GOOD_DUYTRI_RATE) {
    out.push(`✓ Khả năng lựa chọn Content hiệu quả (${fmtNum(kpi.duyTriThang)} Duy trì / ${fmtNum(kpi.tested)} đã test = ${fmtPct(kpi.rateDuyTri)}).`);
  } else if (kpi.tested >= 5 && kpi.duyTriThang === 0) {
    out.push(`⚠ Chưa có Content đạt Duy trì trong kỳ (0/${fmtNum(kpi.tested)} đã test).`);
  }
  if (kpi.dangDuyTri >= MANY_DANG_DUYTRI) {
    out.push(`✓ Đang quản lý ổn định ${fmtNum(kpi.dangDuyTri)} Content hiệu quả.`);
  }
  if (out.length === 0) {
    out.push(`✓ Tiến độ ổn định, tiếp tục duy trì (đã cấp ${fmtNum(kpi.capped)}, test ${fmtPct(kpi.rateTest)}, Duy trì ${fmtNum(kpi.duyTriThang)}).`);
  }
  return out.slice(0, 4);
}

/** Kế hoạch tuần tới cho 1 market: 3–5 gạch đầu dòng, ngắn gọn, có tính hành động. */
export function planForMarket(block: MarketBlock): string[] {
  const t = block.team;
  const out: string[] = [];

  if (t.ton > 0) out.push(`Xử lý dứt điểm ${fmtNum(t.ton)} Content tồn chưa đưa vào Ads.`);
  if (t.choDangBai > 0) out.push(`Lên lịch đăng bài cho ${fmtNum(t.choDangBai)} Content đang chờ đăng.`);
  if (t.capped > 0 && t.rateTest < LOW_TEST_RATE) out.push(`Nâng tỷ lệ test lên trên ${Math.round(LOW_TEST_RATE * 100)}% (hiện ${fmtPct(t.rateTest)}).`);
  if (t.tested > 0 && t.rateDuyTri < GOOD_DUYTRI_RATE) out.push(`Rà soát tiêu chí chọn Content để nâng tỷ lệ Duy trì (hiện ${fmtPct(t.rateDuyTri)}).`);
  if (t.duyTriThang > 0) out.push(`Nhân rộng hướng nội dung của ${fmtNum(t.duyTriThang)} Content đạt Duy trì.`);

  const needHelp = block.employees.filter((e) => e.kpi.ton >= HIGH_TON).map((e) => e.name);
  if (needHelp.length) out.push(`Hỗ trợ ${needHelp.join(', ')} giải phóng Content tồn.`);

  // Mục nền tảng — đảm bảo tối thiểu 3 gạch đầu dòng.
  const fallback = [
    `Theo dõi sát ${fmtNum(t.dangDuyTri)} Content đang duy trì để giữ hiệu quả.`,
    `Duy trì tiến độ cấp Content đều trong tuần.`,
    `Rà soát Content chưa đạt để rút kinh nghiệm chọn đề tài.`,
  ];
  for (const f of fallback) { if (out.length >= 3) break; if (!out.includes(f)) out.push(f); }

  return out.slice(0, 5);
}

/** Sinh toàn bộ phần soạn thảo (Đánh giá + Kế hoạch) từ dữ liệu — dùng chung web & PDF. */
export function buildNarrative(data: WeeklyReportData): ReportNarrative {
  const reviews: Record<string, string[]> = {};
  const plans = {} as Record<MarketKey, string[]>;
  for (const b of data.markets) {
    for (const e of b.employees) reviews[`${e.name}|${b.market}`] = reviewEmployee(e.kpi);
    plans[b.market] = planForMarket(b);
  }
  return { reviews, plans };
}

/** Danh sách nhân viên xuất hiện ở BẤT KỲ market nào (để render phần Đánh giá theo người). */
export function allEmployeeNames(data: WeeklyReportData): string[] {
  const set = new Set<string>();
  for (const b of data.markets) for (const e of b.employees) set.add(e.name);
  return sortEmployees([...set]);
}
