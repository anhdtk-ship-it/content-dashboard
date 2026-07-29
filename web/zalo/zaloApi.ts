/* Client API Zalo — gọi /api/zalo/* (authFetch tự gắn Bearer). ĐỘC LẬP với client Facebook. */

export interface FormatKpi {
  format: string; label: string;
  capped: number; khongTest: number; khongDuyet: number; ton: number; dangTest: number;
  duyTri: number; daDung: number; tested: number; rateTest: number; rateDuyTri: number;
}
export interface FormatProgress {
  format: string; label: string;
  actual: number; target: number | null; pctComplete: number | null;
  prevSame: number; deltaPrevPct: number | null;
  scheduleStatus: 'ahead' | 'on' | 'behind' | 'na';
  expected: number | null; forecast: number | null;
}
export interface FormatAttention {
  format: string; label: string;
  chuaPhanLoai: number; chuaTest: number; testQuaLau: number; thieuNgayTest: number;
}
export interface FormatQuality {
  format: string; label: string;
  thieuTrangThai: number; thieuNgayTest: number; trung: number; thieuBatBuoc: number;
}
export interface ZaloSummary {
  month: string; monthLabel: string; today: string; warningDays: number; warningThreshold: number;
  formats: string[];
  blocks: FormatKpi[]; progress: FormatProgress[]; attention: FormatAttention[]; quality: FormatQuality[];
  totals: FormatKpi; generatedAt: string;
}

export interface ZaloContentItem {
  content_code: string; title: string; assignee_name: string; content_format: string;
  current_status: string; status_group: string;
  upload_date: string; upload_date_real: string | null;
  test_date: string; test_date_real: string | null;
}
export interface ZaloContentsResp {
  items: ZaloContentItem[]; total: number; page: number; pageSize: number; totalPages: number;
}

export interface ZaloWeekly {
  range: { from: string; to: string; label: string };
  formats: string[];
  byFormat: FormatKpi[];
  team: FormatKpi;
  attention: FormatAttention[];
  narrative: { reviews: Record<string, string[]>; plans: string[] };
  generatedAt: string;
}

export interface ZaloSettings { targets: Record<string, number>; warningDays: number; warningThreshold: number }

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  const d = await r.json();
  if (!r.ok || d?.error) throw new Error(d?.error || `HTTP ${r.status}`);
  return d as T;
}

export const zaloApi = {
  summary: (month: string) => getJson<ZaloSummary>(`/api/zalo/summary?month=${encodeURIComponent(month)}`),
  contents: (params: Record<string, string | number>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== '' && v != null) p.set(k, String(v));
    return getJson<ZaloContentsResp>(`/api/zalo/contents?${p.toString()}`);
  },
  weekly: (from: string, to: string) => getJson<ZaloWeekly>(`/api/zalo/weekly?from=${from}&to=${to}`),
  settings: () => getJson<ZaloSettings>('/api/zalo/settings'),
  saveSetting: async (key: string, value: string) => {
    const r = await fetch('/api/zalo/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }),
    });
    const d = await r.json();
    if (!r.ok || d?.error) throw new Error(d?.error || `HTTP ${r.status}`);
    return d as { ok: boolean; settings: ZaloSettings };
  },
};

/* ---------- helpers hiển thị ---------- */
export const pct = (x: number | null | undefined) => (x == null ? '—' : `${Math.round((x ?? 0) * 1000) / 10}%`);
export const num = (n: number | null | undefined) => (n ?? 0).toLocaleString('vi-VN');
export const signedPct = (x: number | null | undefined) =>
  x == null ? '—' : `${x >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(x * 1000) / 10)}%`;

export const SCHEDULE_LABEL: Record<FormatProgress['scheduleStatus'], string> = {
  ahead: 'Vượt tiến độ', on: 'Đúng tiến độ', behind: 'Chậm tiến độ', na: '—',
};
