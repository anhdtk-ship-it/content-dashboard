/* Ads Monitor — Repository (PHASE 5): truy vấn SERVER-SIDE qua Postgres function `ads_monitor_query`.
 * KHÔNG còn findAll() tải toàn bộ bảng vào RAM. Phân trang/filter/KPI đều tính ở SQL.
 * KHÔNG dùng repo/bảng của module khác. KHÔNG đọc cột `status` (status tính ở tầng app / CASE WHEN SQL).
 * Fallback an toàn về MOCK (tính trong RAM — mock chỉ ~30 dòng) khi function/bảng chưa tồn tại / đọc lỗi. */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { AdsMonitorRecord, AdsQueryParams, AdsQueryResult, Lifecycle } from './types';
import { calculateAdsStatus, lifecycleFromLifetime } from './calculateAdsStatus';
import { MOCK_ADS_RECORDS } from './mock';

export type AdsSource = 'supabase' | 'mock';

export class AdsMonitorRepository {
  /** Nguồn dữ liệu của lần query gần nhất (để API báo minh bạch). */
  public source: AdsSource = 'mock';
  private readonly supa: SupabaseClient | null;
  /** Đã cấu hình Supabase? (có URL + service key). */
  private readonly configured: boolean;
  /**
   * Cho phép fallback mock hay không (PHASE 6 — Go Live):
   *   - CHƯA cấu hình Supabase  → mock (môi trường dev/chưa kết nối).
   *   - ĐÃ cấu hình             → KHÔNG mock; lỗi RPC sẽ NÉM ra (không che dữ liệu thật bằng mock),
   *                               TRỪ khi đặt rõ cờ dev ADS_USE_MOCK=true.
   */
  private readonly allowMock: boolean;

  constructor() {
    const url = process.env.SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    this.configured = !!(url && key);
    this.supa = this.configured ? createClient(url!, key!, { auth: { persistSession: false } }) : null;
    this.allowMock = !this.configured || process.env.ADS_USE_MOCK === 'true';
  }

  /** Truy vấn 1 trang + KPI bằng SQL (function ads_monitor_query). 1 round-trip. */
  async query(p: AdsQueryParams): Promise<AdsQueryResult> {
    // Chưa cấu hình Supabase → chỉ có thể dùng mock (dev).
    if (!this.supa) { this.source = 'mock'; return mockQuery(p); }
    try {
      const { data, error } = await this.supa.rpc('ads_monitor_query', {
        p_content: p.content ?? null,
        p_ads_owner: p.adsOwner ?? null,
        p_location: p.location ?? null,
        p_page_code: p.pageCode ?? null,
        p_status: p.status ?? null,
        p_date_from: p.dateFrom ?? null,
        p_date_to: p.dateTo ?? null,
        p_sort_field: p.sortField ?? 'updated_at',
        p_sort_dir: p.sortDir ?? 'desc',
        p_page: p.page,
        p_page_size: p.pageSize,
      });
      if (error) throw error;
      const r = (data ?? {}) as any;
      this.source = 'supabase';
      return {
        items: (r.items ?? []).map(normalizeRow),
        total: Number(r.total) || 0,
        kpi: normalizeKpi(r.kpi),
        owners: Array.isArray(r.owners) ? r.owners : [],
      };
    } catch (e: any) {
      // PHASE 6: đã cấu hình mà vẫn dùng mock sẽ che lỗi production → chỉ mock khi được phép (dev).
      if (this.allowMock) {
        console.warn(`[ads_monitor] RPC lỗi → fallback mock (ADS_USE_MOCK/dev): ${e?.message ?? e}`);
        this.source = 'mock';
        return mockQuery(p);
      }
      console.error(`[ads_monitor] RPC ads_monitor_query lỗi (đã cấu hình Supabase, KHÔNG fallback mock): ${e?.message ?? e}`);
      throw new Error(`Ads Monitor đọc Supabase lỗi: ${e?.message ?? e}`);
    }
  }
}

function normalizeRow(x: any): AdsMonitorRecord {
  return {
    id: x.id,
    content: x.content ?? '',
    location: x.location ?? '',
    ads_owner: x.ads_owner ?? '',
    page_code: x.page_code ?? '',
    amount_spent: Number(x.amount_spent) || 0,   // = TỔNG chi tiêu trong kỳ
    updated_at: x.updated_at,
    created_at: x.created_at ?? x.updated_at,
    sheet_date: x.sheet_date ?? null,
    latest_amount: Number(x.latest_amount) || 0, // chi tiêu ngày mới nhất trong kỳ
    lifecycle: (x.lifecycle as any) ?? 'NEW',
  };
}

function normalizeKpi(k: any): AdsQueryResult['kpi'] {
  return {
    total: Number(k?.total) || 0,
    duyTri: Number(k?.duyTri) || 0,
    test: Number(k?.test) || 0,
    moiChay: Number(k?.moiChay) || 0,
    daTat: Number(k?.daTat) || 0,
    totalAmount: Number(k?.totalAmount) || 0,
  };
}

/* ----------------------------------------------------------------------------
 * Fallback MOCK — mô phỏng ĐÚNG ngữ nghĩa SQL (PHASE 7):
 *   - Tổng chi tiêu trong kỳ = SUM theo (page_code, content) trong cửa sổ ngày.
 *   - latest_amount = chi tiêu ngày mới nhất trong kỳ → quyết định "Đã tắt".
 *   - lifecycle = theo TỔNG CHI TIÊU ĐỜI (mọi ngày, độc lập kỳ lọc).
 *   - Trạng thái = calculateAdsStatus(latest_amount, lifecycle).
 * Chỉ chạy khi không có DB / function chưa tạo (mock ~30 dòng → rẻ).
 * -------------------------------------------------------------------------- */
function statusMatches(latestAmount: number, lifecycle: Lifecycle, status?: string | null): boolean {
  if (!status) return true;
  return calculateAdsStatus(latestAmount, lifecycle) === status;
}

/** Nhân viên Ads bị LOẠI TRỪ khỏi Ads Monitor (đồng bộ với SQL function). */
const EXCLUDED_OWNERS = new Set(['Khiêm']);

function mockQuery(p: AdsQueryParams): AdsQueryResult {
  const ilike = (hay: string, needle?: string | null) => !needle || hay.toLowerCase().includes(needle.toLowerCase());
  const BASE = MOCK_ADS_RECORDS.filter((r) => !EXCLUDED_OWNERS.has(r.ads_owner));

  // Lifecycle ĐỜI: tổng chi tiêu theo (page_code, content) qua MỌI ngày (không theo kỳ lọc).
  const lifetimeMap = new Map<string, number>();
  for (const r of BASE) {
    const k = `${r.page_code}||${r.content}`;
    lifetimeMap.set(k, (lifetimeMap.get(k) ?? 0) + r.amount_spent);
  }

  // 1) lọc dimension + ngày TRƯỚC khi gộp (giống SQL).
  const rowsIn = BASE.filter((r) =>
    ilike(r.content, p.content) &&
    (!p.adsOwner || r.ads_owner === p.adsOwner) &&
    (!p.location || r.location === p.location) &&
    ilike(r.page_code, p.pageCode) &&
    (!p.dateFrom || (r.sheet_date ?? '') >= p.dateFrom) &&
    (!p.dateTo || (r.sheet_date ?? '') <= p.dateTo));

  // Ngày DỮ LIỆU MỚI NHẤT trong kỳ (global). Content không có dòng ngày này → latest_amount=0 → Đã tắt.
  const vmax = rowsIn.reduce((mx, r) => ((r.sheet_date ?? '') > mx ? (r.sheet_date ?? '') : mx), '');

  // 2) gộp theo (page_code, content): SUM (tổng kỳ) + latest_amount (chi tiêu ngày vmax) + lifecycle (đời).
  const aggMap = new Map<string, AdsMonitorRecord>();
  for (const r of rowsIn) {
    const k = `${r.page_code}||${r.content}`;
    let cur = aggMap.get(k);
    if (!cur) {
      cur = { ...r, amount_spent: 0, latest_amount: 0, lifecycle: lifecycleFromLifetime(lifetimeMap.get(k) ?? 0) };
      aggMap.set(k, cur);
    }
    cur.amount_spent += r.amount_spent;
    if ((r.sheet_date ?? '') === vmax) cur.latest_amount = (cur.latest_amount ?? 0) + r.amount_spent;
    if ((r.sheet_date ?? '') > (cur.sheet_date ?? '')) cur.sheet_date = r.sheet_date;
    if (r.updated_at > cur.updated_at) cur.updated_at = r.updated_at;
  }
  const dim = [...aggMap.values()];
  const lc = (r: AdsMonitorRecord) => r.lifecycle ?? 'NEW';
  const la = (r: AdsMonitorRecord) => r.latest_amount ?? 0;

  // 3) KPI trên tập dimension (KHÔNG lọc status) — theo (latest_amount, lifecycle).
  const kpi = {
    total: dim.length,
    daTat: dim.filter((r) => la(r) <= 0).length,
    moiChay: dim.filter((r) => la(r) > 0 && lc(r) === 'NEW').length,
    test: dim.filter((r) => la(r) > 0 && lc(r) === 'TEST').length,
    duyTri: dim.filter((r) => la(r) > 0 && lc(r) === 'MAINTAIN').length,
    totalAmount: dim.reduce((s, r) => s + r.amount_spent, 0),
  };

  // 4) filter status → 5) sort → 6) phân trang
  const filtered = dim.filter((r) => statusMatches(la(r), lc(r), p.status));
  const field = (p.sortField ?? 'updated_at') as keyof AdsMonitorRecord;
  const dir = p.sortDir === 'asc' ? 1 : -1;
  filtered.sort((a, b) => {
    const av = a[field] as any, bv = b[field] as any;
    if (av === bv) return 0;
    return (av > bv ? 1 : -1) * dir;
  });
  const start = (Math.max(1, p.page) - 1) * p.pageSize;
  const items = filtered.slice(start, start + p.pageSize);
  const owners = [...new Set(BASE.map((r) => r.ads_owner).filter(Boolean))].sort();
  return { items, total: filtered.length, kpi, owners };
}
