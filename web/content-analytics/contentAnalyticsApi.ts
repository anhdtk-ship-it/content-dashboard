/* ============================================================
 * Content Analytics (PHASE CONTENT-ANALYTICS-03) — client API.
 * Gọi /api/content-analytics (bảo vệ bằng requireAuth). LƯU Ý: '/api/content-analytics'
 * KHÔNG nằm trong danh sách PROTECTED của `web/auth/authFetch.ts` (cố tình KHÔNG sửa file
 * đó — nằm ngoài phạm vi ADD-ONLY được phép chạm), nên module này tự gắn
 * `Authorization: Bearer <token>` bằng `getAccessToken()` (import read-only từ
 * supabaseClient.ts, không sửa file đó) thay vì dựa vào fetch interceptor toàn cục.
 * ĐỘC LẬP hoàn toàn với budgetApi.ts / zaloApi.ts. KHÔNG đọc/ghi Ads Monitor.
 * ========================================================== */
import { getAccessToken } from '../auth/supabaseClient';

export type ContentType = 'new' | 'old';
export type ContentTypeFilter = 'all' | ContentType;

export interface EmployeeDataSlice { employee: string; data: number }

export interface ByContentItem {
  content: string;
  employee: string;
  firstSeen: string;
  type: ContentType;
  data: number;
  pctOfTotal: number;
  employeeBreakdown: EmployeeDataSlice[];
}

export interface ByEmployeeItem {
  employee: string;
  dataNew: number;
  dataOld: number;
  dataTotal: number;
  pctNew: number;
  pctOld: number;
}

export interface ContentAnalyticsOverview {
  dataNew: number;
  dataOld: number;
  dataTotal: number;
  pctNew: number;
  pctOld: number;
}

export interface ContentAnalyticsMeta {
  historyStartDate: string | null;
  rowsRead: number;
  rowsAfterDedup: number;
  duplicateGroups: number;
  contentsUnknownEmployee: number;
  warnings: string[];
}

export interface ContentAnalyticsResult {
  month: string;
  overview: ContentAnalyticsOverview;
  byContent: ByContentItem[];
  byEmployee: ByEmployeeItem[];
  meta: ContentAnalyticsMeta;
}

export interface ContentAnalyticsQuery {
  month: string;
  employee: string; // 'ALL' hoặc account_name
  type: ContentTypeFilter;
  search: string;
}

export const UNKNOWN_EMPLOYEE = '(Không xác định)';

/** Tháng hiện tại 'YYYY-MM'. */
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function fetchContentAnalytics(q: ContentAnalyticsQuery): Promise<ContentAnalyticsResult> {
  const p = new URLSearchParams();
  p.set('month', q.month);
  if (q.employee && q.employee !== 'ALL') p.set('employee', q.employee);
  if (q.type && q.type !== 'all') p.set('type', q.type);
  if (q.search) p.set('search', q.search);

  const token = await getAccessToken();
  const headers: HeadersInit = token ? { Authorization: 'Bearer ' + token } : {};
  const res = await fetch('/api/content-analytics?' + p.toString(), { headers });
  const d = await res.json();
  if (!res.ok || d?.error) throw new Error(d?.error || `HTTP ${res.status}`);
  return d as ContentAnalyticsResult;
}
