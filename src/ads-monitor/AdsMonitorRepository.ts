/* Ads Monitor — Repository riêng (PHASE 3).
 * KHÔNG dùng bảng/repository của Dashboard Content. KHÔNG đọc Supabase/Sheet ở phase này.
 * Hiện trả MOCK; Phase 4+ sẽ đọc bảng `ads_monitor` (hoặc qua AdsMonitorSyncProvider). */
import type { AdsMonitorRecord } from './types';
import { MOCK_ADS_RECORDS } from './mock';

export class AdsMonitorRepository {
  /** Lấy toàn bộ bản ghi thô (chưa kèm status). */
  async findAll(): Promise<AdsMonitorRecord[]> {
    return MOCK_ADS_RECORDS;
  }

  /** Tìm theo page_code (mock). */
  async findByPageCode(pageCode: string): Promise<AdsMonitorRecord[]> {
    return MOCK_ADS_RECORDS.filter((r) => r.page_code === pageCode);
  }
}
