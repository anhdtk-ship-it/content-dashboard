/* Ads Monitor — interface cho tầng đồng bộ (PHASE 3: CHỈ khai báo, CHƯA implement).
 * PHASE 4 sẽ implement provider này để đọc Google Sheet → ads_monitor. */
import type { AdsMonitorRecord } from './types';

export interface AdsMonitorSyncProvider {
  /** Lấy danh sách bản ghi từ nguồn (Phase 4: Google Sheet). Trả về record THÔ (không kèm status). */
  fetchRecords(): Promise<AdsMonitorRecord[]>;
}

/* PHASE 4 (chưa làm):
 *   export class GoogleSheetAdsSyncProvider implements AdsMonitorSyncProvider {
 *     async fetchRecords(): Promise<AdsMonitorRecord[]> { ... đọc Sheet ... }
 *   }
 */
