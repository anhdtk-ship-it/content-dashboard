/* ============================================================
 * Content Performance (CP-04) — client API. Gọi /api/content-performance (requireAuth).
 * KHÔNG nằm trong danh sách PROTECTED của `web/auth/authFetch.ts` (không sửa file đó) —
 * tự gắn Authorization: Bearer bằng getAccessToken(), giống contentAnalyticsApi.ts.
 * ĐỘC LẬP hoàn toàn với contentAnalyticsApi.ts/budgetApi.ts/zaloApi.ts.
 * ========================================================== */
import { getAccessToken } from '../auth/supabaseClient';

export type GeographyFilter = 'all' | 'noi_dia' | 'quoc_te';

export interface QualityMetrics {
  carePriceCount: number; carePriceRate: number;
  positiveCount: number; positiveRate: number;
  negativeCount: number; negativeRate: number;
  unknownCount: number; unknownRate: number;
}

export interface ContentPerformanceTableItem {
  content: string;
  editor: string;
  channel: string;
  cost: number;
  dataCount: number;
  dataPrice: number;
  roasMonth: number;
  roas3Month: number;
  quality: QualityMetrics | null;
}

export interface ContentPerformanceOverview {
  cost: number;
  dataCount: number;
  dataPrice: number;
  roasMonth: number;
  roas3Month: number;
}

export interface ContentPerformanceMeta {
  channelsAvailable: string[];
  editorsAvailable: string[];
  monthsAvailable: string[];
  contentsUnmatchedEditor: number;
  warnings: string[];
}

export interface ContentPerformanceResult {
  month: string;
  overview: ContentPerformanceOverview;
  table: ContentPerformanceTableItem[];
  meta: ContentPerformanceMeta;
}

export interface ContentPerformanceQuery {
  month: string;
  channel: string;   // 'ALL' hoặc đúng 1 trong 5 giá trị kênh Facebook
  editor: string;    // 'ALL' hoặc editor_name gốc
  geography: GeographyFilter;
  search: string;
}

/** Tháng hiện tại 'YYYY-MM'. */
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function fetchContentPerformance(q: ContentPerformanceQuery): Promise<ContentPerformanceResult> {
  const p = new URLSearchParams();
  p.set('month', q.month);
  if (q.channel && q.channel !== 'ALL') p.set('channel', q.channel);
  if (q.editor && q.editor !== 'ALL') p.set('editor', q.editor);
  if (q.geography && q.geography !== 'all') p.set('geography', q.geography);
  if (q.search) p.set('search', q.search.trim());

  const token = await getAccessToken();
  const headers: HeadersInit = token ? { Authorization: 'Bearer ' + token } : {};
  const res = await fetch('/api/content-performance?' + p.toString(), { headers });
  const d = await res.json();
  if (!res.ok || d?.error) throw new Error(d?.error || `HTTP ${res.status}`);
  return d as ContentPerformanceResult;
}
