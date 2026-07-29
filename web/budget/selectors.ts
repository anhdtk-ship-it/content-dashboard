/* ============================================================
 * FB-ADS-02 — SELECTORS (thuần, memoize được). Toàn bộ phép tính Budget Allocation.
 * KHÔNG I/O. KHÔNG sửa dữ liệu Ads. Chỉ nhận AdsRow[] → sinh field tính toán.
 *
 * BUSINESS RULE (chỉ của module này — KHÔNG đụng rule Ads Monitor):
 *   - Chỉ lấy Amount Spent > 0 (mọi trạng thái: Đang test/Đang duy trì/Đã tắt/Mới chạy).
 *   - Content Tươi = Ngày cấp thuộc THÁNG đang xem; Content Cũ = trước tháng đang xem.
 *   - Ngưỡng = BUDGET_THRESHOLD (config): < → "dưới 5tr", >= → "trên 5tr".
 * ========================================================== */
import type { AdsRow } from './budgetApi';

export const MARKETS = [
  { code: 'TQ', label: 'Nội Địa' },
  { code: 'NN', label: 'Quốc Tế' },
] as const;
export type MarketCode = (typeof MARKETS)[number]['code'];

export type GroupKey = 'old_lt' | 'old_gte' | 'fresh_lt' | 'fresh_gte';
export const GROUPS: { key: GroupKey; label: string; short: string; color: string }[] = [
  { key: 'old_lt', label: 'Cũ · dưới 5tr', short: 'Cũ <5tr', color: '#94a3b8' },
  { key: 'old_gte', label: 'Cũ · trên 5tr', short: 'Cũ >5tr', color: '#f59e0b' },
  { key: 'fresh_lt', label: 'Tươi · dưới 5tr', short: 'Tươi <5tr', color: '#38bdf8' },
  { key: 'fresh_gte', label: 'Tươi · trên 5tr', short: 'Tươi >5tr', color: '#22c55e' },
];
export const GROUP_LABEL: Record<GroupKey, string> = Object.fromEntries(GROUPS.map((g) => [g.key, g.short])) as Record<GroupKey, string>;

/** Ngày cấp = 6 số đầu content (YYMMDD) → 'YYYY-MM-DD'. Trả null nếu không parse được. */
export function parseCapDate(content: string): string | null {
  const m = String(content ?? '').match(/^(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  const mm = +m[2], dd = +m[3];
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `20${m[1]}-${m[2]}-${m[3]}`;
}

export interface EnrichedRow extends AdsRow {
  capDate: string | null;
  isFresh: boolean;   // ngày cấp thuộc tháng đang xem
  group: GroupKey;
}
export interface GroupStat { key: GroupKey; label: string; color: string; content: number; budget: number; pctContent: number; pctBudget: number; avg: number }
export interface EmployeeRow {
  name: string;
  counts: Record<GroupKey, number>;
  budgets: Record<GroupKey, number>;
  totalContent: number;
  totalBudget: number;
  avg: number;
}
export interface MarketAnalysis {
  market: MarketCode;
  marketLabel: string;
  month: string;
  rows: EnrichedRow[];
  kpi: { totalBudget: number; totalContent: number; avgBudget: number; contentCu: number; contentTuoi: number };
  groups: GroupStat[];
  total: GroupStat;
  employees: EmployeeRow[];
  indices: { freshBudgetRatio: number; oldBudgetRatio: number; avgBudget: number; distributionIndex: number };
}

const rate = (a: number, b: number) => (b > 0 ? a / b : 0);
const emptyCounts = (): Record<GroupKey, number> => ({ old_lt: 0, old_gte: 0, fresh_lt: 0, fresh_gte: 0 });

function classify(row: AdsRow, month: string, threshold: number): { capDate: string | null; isFresh: boolean; group: GroupKey } {
  const capDate = parseCapDate(row.content);
  const isFresh = !!capDate && capDate.slice(0, 7) === month;   // thuộc tháng đang xem
  const gte = row.amount_spent >= threshold;
  const group: GroupKey = isFresh ? (gte ? 'fresh_gte' : 'fresh_lt') : (gte ? 'old_gte' : 'old_lt');
  return { capDate, isFresh, group };
}

/** Dựng toàn bộ phân tích cho 1 THỊ TRƯỜNG. `all` = Ads của tháng (cả 2 thị trường).
 *  `excludeOwners` = danh sách nhân viên Ads bị loại khỏi thị trường này (VD Nội Địa loại 'Br'). */
export function buildMarketAnalysis(all: AdsRow[], market: MarketCode, month: string, threshold: number, excludeOwners: string[] = []): MarketAnalysis {
  const marketLabel = MARKETS.find((m) => m.code === market)!.label;
  const excl = new Set(excludeOwners.map((s) => s.trim().toLowerCase()).filter(Boolean));
  // Rule: đúng thị trường + Amount Spent > 0 + không thuộc nhân viên bị loại.
  const rows: EnrichedRow[] = all
    .filter((r) => r.location === market && r.amount_spent > 0 && !excl.has((r.ads_owner || '').trim().toLowerCase()))
    .map((r) => ({ ...r, ...classify(r, month, threshold) }));

  const totalBudget = rows.reduce((s, r) => s + r.amount_spent, 0);
  const totalContent = rows.length;
  const contentTuoi = rows.filter((r) => r.isFresh).length;
  const contentCu = totalContent - contentTuoi;

  const groups: GroupStat[] = GROUPS.map((g) => {
    const rs = rows.filter((r) => r.group === g.key);
    const budget = rs.reduce((s, r) => s + r.amount_spent, 0);
    return {
      key: g.key, label: g.short, color: g.color,
      content: rs.length, budget,
      pctContent: rate(rs.length, totalContent), pctBudget: rate(budget, totalBudget),
      avg: rate(budget, rs.length),
    };
  });
  const total: GroupStat = {
    key: 'old_lt', label: 'Tổng', color: '#64748b',
    content: totalContent, budget: totalBudget, pctContent: 1, pctBudget: 1, avg: rate(totalBudget, totalContent),
  };

  // Theo nhân viên Ads.
  const byName = new Map<string, EmployeeRow>();
  for (const r of rows) {
    const name = r.ads_owner || '(trống)';
    let e = byName.get(name);
    if (!e) { e = { name, counts: emptyCounts(), budgets: emptyCounts(), totalContent: 0, totalBudget: 0, avg: 0 }; byName.set(name, e); }
    e.counts[r.group]++;
    e.budgets[r.group] += r.amount_spent;
    e.totalContent++;
    e.totalBudget += r.amount_spent;
  }
  const employees = [...byName.values()].map((e) => ({ ...e, avg: rate(e.totalBudget, e.totalContent) }))
    .sort((a, b) => b.totalBudget - a.totalBudget);

  // Chỉ số mới.
  const freshBudget = rows.filter((r) => r.isFresh).reduce((s, r) => s + r.amount_spent, 0);
  const oldBudget = totalBudget - freshBudget;
  const highValueBudget = rows.filter((r) => r.amount_spent >= threshold).reduce((s, r) => s + r.amount_spent, 0);
  const indices = {
    freshBudgetRatio: rate(freshBudget, totalBudget),
    oldBudgetRatio: rate(oldBudget, totalBudget),
    avgBudget: rate(totalBudget, totalContent),
    distributionIndex: rate(highValueBudget, totalBudget), // tỷ trọng ngân sách vào content ≥ ngưỡng
  };

  return {
    market, marketLabel, month, rows,
    kpi: { totalBudget, totalContent, avgBudget: rate(totalBudget, totalContent), contentCu, contentTuoi },
    groups, total, employees, indices,
  };
}
