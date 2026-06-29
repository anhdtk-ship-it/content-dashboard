/* Ads Monitor — Service (PHASE 3). Ghép Repository + tính status bằng calculateAdsStatus().
 * Hiện chỉ MOCK, chưa đọc Google Sheet. */
import { AdsMonitorRepository } from './AdsMonitorRepository';
import { calculateAdsStatus } from './calculateAdsStatus';
import type { AdsMonitorDTO, AdsMonitorSummary, AdsStatus } from './types';

export class AdsMonitorService {
  constructor(private readonly repo: AdsMonitorRepository = new AdsMonitorRepository()) {}

  /** Danh sách bản ghi kèm status (tính từ amount_spent). */
  async list(): Promise<AdsMonitorDTO[]> {
    const records = await this.repo.findAll();
    return records.map((r) => ({ ...r, status: calculateAdsStatus(r.amount_spent) }));
  }

  /** KPI tổng hợp — đếm theo status (tính động), tổng amount. */
  async summary(): Promise<AdsMonitorSummary> {
    const items = await this.list();
    const count = (s: AdsStatus) => items.filter((x) => x.status === s).length;
    return {
      total: items.length,
      duyTri: count('Đang duy trì'),
      test: count('Đang test'),
      moiChay: count('Mới chạy'),
      daTat: count('Đã tắt'),
      totalAmount: items.reduce((sum, x) => sum + x.amount_spent, 0),
    };
  }
}
