/* Ads Monitor — Service (PHASE 5). Gọi Repository.query() (SQL server-side) — KHÔNG tải toàn bộ.
 * status LUÔN tính bằng calculateAdsStatus(amount_spent) — KHÔNG đọc/lưu status.
 * KPI lấy thẳng từ SQL (function ads_monitor_query) — service KHÔNG COUNT/SUM trong JS. */
import { AdsMonitorRepository, type AdsSource } from './AdsMonitorRepository';
import { calculateAdsStatus } from './calculateAdsStatus';
import type { AdsMonitorDTO, AdsMonitorSummary, AdsQueryParams } from './types';

export interface AdsPagedResult {
  items: AdsMonitorDTO[];
  summary: AdsMonitorSummary;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  source: AdsSource;
}

export class AdsMonitorService {
  constructor(private readonly repo: AdsMonitorRepository = new AdsMonitorRepository()) {}

  /** Lấy đúng 1 trang (kèm status tính động) + KPI (từ SQL) + tổng + nguồn. 1 query. */
  async getData(params: AdsQueryParams): Promise<AdsPagedResult> {
    const { items: records, total, kpi } = await this.repo.query(params);
    // PHASE 7: trạng thái = chi tiêu ngày mới nhất + lifecycle (KHÔNG dựa amount_spent tổng).
    const items = records.map((r) => ({ ...r, status: calculateAdsStatus(r.latest_amount ?? 0, r.lifecycle ?? 'NEW') }));
    const summary: AdsMonitorSummary = {
      total: kpi.total, duyTri: kpi.duyTri, test: kpi.test,
      moiChay: kpi.moiChay, daTat: kpi.daTat, totalAmount: kpi.totalAmount,
    };
    const pageSize = params.pageSize;
    return {
      items, summary, total,
      page: params.page, pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      source: this.repo.source,
    };
  }
}
