import 'dotenv/config';
import * as path from 'path';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import adsMonitorRouter from './ads-monitor/routes';

const PORT = Number(process.env.PORT ?? 4000);
const url = process.env.SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
if (!url || !serviceKey) throw new Error('Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY trong .env');

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

/* ============================================================
 * Types
 * ========================================================== */
interface Row {
  id?: number;
  content_code: string;
  title?: string;
  market: string;
  assignee_name: string;
  cgsd?: string;
  editor_name?: string;
  trello_link?: string;
  upload_date?: string;
  upload_date_real?: string | null; // DATE 'YYYY-MM-DD'
  current_status?: string;
  test_date?: string;
  test_date_real?: string | null;   // DATE 'YYYY-MM-DD'
  created_at?: string;
}
interface Enriched extends Row {
  status_group: string;
  content_date: string | null; // YYYY-MM-DD parse từ content_code (giữ tham chiếu)
}

/* ============================================================
 * Transform (chỉ ở tầng dashboard — KHÔNG đổi DB)
 * ========================================================== */
function statusGroup(s?: string): string {
  const v = (s ?? '').trim();
  if (v === '') return 'CHUA_PHAN_LOAI';
  if (v === 'Chờ chạy') return 'CHO_CHAY';
  if (v === 'Đang test') return 'DANG_TEST';
  if (v.startsWith('Duy trì')) return 'DUY_TRI';
  if (v === 'Đã test-ko chạy' || v === 'Đã chạy-Tắt') return 'DA_DUNG';
  if (v === 'Không test') return 'KHONG_TEST';   // PHASE 10: NV Ads quyết định KHÔNG test (trạng thái kết thúc)
  if (v === 'Không được duyệt') return 'KHONG_DUYET';
  return 'CHUA_PHAN_LOAI';
}
const GROUP_LABEL: Record<string, string> = {
  CHO_CHAY: 'Chờ chạy', DANG_TEST: 'Đang test', DUY_TRI: 'Duy trì',
  DA_DUNG: 'Đã dừng', KHONG_TEST: 'Không test', KHONG_DUYET: 'Không duyệt', CHUA_PHAN_LOAI: 'Chưa phân loại',
};

/** Parse YYMMDD ở đầu content_code -> 'YYYY-MM-DD'. */
function parseContentDate(code?: string): string | null {
  const m = String(code ?? '').match(/^(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  const yy = +m[1], mm = +m[2], dd = +m[3];
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `20${m[1]}-${m[2]}-${m[3]}`;
}

function enrich(rows: Row[]): Enriched[] {
  return rows.map((r) => ({
    ...r,
    status_group: statusGroup(r.current_status),
    content_date: parseContentDate(r.content_code),
  }));
}

/* ============================================================
 * Fetch + cache (tối ưu query)
 * ========================================================== */
let cache: { at: number; data: Enriched[] } | null = null;
const CACHE_TTL = 10_000;

async function getContents(): Promise<Enriched[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL) return cache.data;
  const all: Row[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from('contents').select('*').range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as Row[]));
    if (data.length < pageSize) break;
  }
  const enriched = enrich(all);
  cache = { at: Date.now(), data: enriched };
  return enriched;
}

/* ============================================================
 * Filters
 * ========================================================== */
interface Filters { market?: string; assignee?: string; status?: string; from?: string; to?: string; dateField?: 'upload_date_real' | 'test_date_real'; }

/** Lấy giá trị ngày dùng để lọc (mặc định upload_date_real). */
function filterDate(r: Enriched, f: Filters): string | null {
  const field = f.dateField === 'test_date_real' ? 'test_date_real' : 'upload_date_real';
  return (r[field] ?? null) as string | null;
}

/** Lọc theo market/assignee/status (KHÔNG theo ngày). */
function applyBase(rows: Enriched[], f: Filters): Enriched[] {
  return rows.filter((r) => {
    if (f.market && f.market !== 'ALL' && r.market !== f.market) return false;
    if (f.assignee && f.assignee !== 'ALL' && r.assignee_name !== f.assignee) return false;
    if (f.status && f.status !== 'ALL' && r.status_group !== f.status) return false;
    return true;
  });
}
/** Lọc theo khoảng ngày (mặc định upload_date_real). */
function applyDate(rows: Enriched[], f: Filters): Enriched[] {
  if (!f.from && !f.to) return rows;
  return rows.filter((r) => {
    const d = filterDate(r, f);
    if (!d) return false;
    if (f.from && d < f.from) return false;
    if (f.to && d > f.to) return false;
    return true;
  });
}

function successRate(duyTri: number, daDung: number): number {
  const denom = duyTri + daDung;
  return denom === 0 ? 0 : duyTri / denom;
}
function countGroup(rows: Enriched[], g: string): number {
  return rows.filter((r) => r.status_group === g).length;
}

/* ============================================================
 * KPI nghiệp vụ (dựa trên current_status GỐC)
 * ========================================================== */
const S_TESTED = new Set(['Đang test', 'Duy trì - Chưa vít', 'Duy trì - Đã vít', 'Đã test-ko chạy', 'Đã chạy-Tắt']);
const S_SUCCESS = new Set(['Duy trì - Chưa vít', 'Duy trì - Đã vít', 'Đã chạy-Tắt']);
const S_FAIL = new Set(['Đã test-ko chạy']);
const safeRate = (num: number, den: number) => (den === 0 ? 0 : num / den);

/** Bộ chỉ số KPI cho 1 tập content (Tổng quan / Người nhận / Thị trường dùng chung). */
function metrics(rows: Enriched[]) {
  const total = rows.length; // Content được cấp
  let tested = 0, success = 0, fail = 0, dangTest = 0, khongDuyet = 0, choChay = 0, chuaPhanLoai = 0, khongTest = 0;
  for (const r of rows) {
    const v = (r.current_status ?? '').trim();
    if (v === 'Đang test') dangTest++;
    if (S_TESTED.has(v)) tested++;
    if (S_SUCCESS.has(v)) success++;
    if (S_FAIL.has(v)) fail++;
    if (v === 'Không test') khongTest++;         // PHASE 10 (không thuộc tested/tồn kho)
    if (v === 'Không được duyệt') khongDuyet++;
    else if (v === 'Chờ chạy') choChay++;
    else if (v === '') chuaPhanLoai++;
  }
  const tonKho = choChay + chuaPhanLoai; // đã cấp nhưng chưa test (không tính Không duyệt/Không test)
  return {
    capped: total,
    tested, success, fail, dangTest, khongDuyet, choChay, chuaPhanLoai, khongTest, tonKho,
    rateTested: safeRate(tested, total),     // Đã được test / Content được cấp
    rateSuccess: safeRate(success, tested),  // Thành công / Đã được test
    rateDangTest: safeRate(dangTest, total), // Đang test / Content được cấp
    rateTonKho: safeRate(tonKho, total),     // Tồn kho / Content được cấp
    rateKhongDuyet: safeRate(khongDuyet, total), // Không duyệt / Content được cấp
  };
}

/* ============================================================
 * Lifecycle (vòng đời) — chế độ derived từ upload/test/current_status
 * ========================================================== */
function todayUtcMs(): number {
  const n = new Date();
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
}
function daysFrom(iso: string | null | undefined, toMs: number): number | null {
  if (!iso) return null;
  const a = Date.parse(iso + 'T00:00:00Z');
  if (isNaN(a)) return null;
  return Math.floor((toMs - a) / 86400000);
}
const isActiveMaint = (r: Enriched) => (r.current_status ?? '').trim().startsWith('Duy trì');
const isEnded = (r: Enriched) => (r.current_status ?? '').trim() === 'Đã chạy-Tắt';
/** Tuổi thọ hiện tại (ngày) = hôm nay − upload_date_real (fallback test_date_real). */
function ageDays(r: Enriched, todayMs: number): number | null {
  const d = daysFrom(r.upload_date_real ?? r.test_date_real ?? null, todayMs);
  return d == null ? null : Math.max(0, d);
}
/** Số ngày duy trì = hôm nay − test_date_real (fallback upload) cho content nhóm Duy trì. */
function maintainDays(r: Enriched, todayMs: number): number | null {
  if (!isActiveMaint(r)) return null;
  const d = daysFrom(r.test_date_real ?? r.upload_date_real ?? null, todayMs);
  return d == null ? null : Math.max(0, d);
}
/** Số ngày kể từ khi bắt đầu test (dùng cho cảnh báo đang test quá lâu). */
function maintainOrTestAge(r: Enriched, todayMs: number): number | null {
  const d = daysFrom(r.test_date_real ?? r.upload_date_real ?? null, todayMs);
  return d == null ? null : Math.max(0, d);
}
/** VÒNG ĐỜI CHÍNH THỨC: số ngày kể từ Ngày Set Ads (test_date_real). KHÔNG dùng upload. */
function liveDays(r: Enriched, todayMs: number): number | null {
  const d = daysFrom(r.test_date_real ?? null, todayMs);
  return d == null ? null : Math.max(0, d);
}

/* ============================================================
 * Trend bucketing
 * ========================================================== */
function bucketKey(dateIso: string, mode: string): string {
  if (mode === 'month') return dateIso.slice(0, 7); // YYYY-MM
  if (mode === 'week') {
    const d = new Date(dateIso + 'T00:00:00Z');
    const day = (d.getUTCDay() + 6) % 7; // Mon=0
    d.setUTCDate(d.getUTCDate() - day);
    return d.toISOString().slice(0, 10);
  }
  return dateIso; // day
}

/* ============================================================
 * Build summary
 * ========================================================== */
function buildSummary(rows: Enriched[], f: Filters, trendMode: string) {
  // Tập đã lọc đầy đủ: date + market + assignee + status.
  // MỌI KPI / chart / bảng / alert đều tính trên tập này.
  const F = applyDate(applyBase(rows, f), f);

  const noiDia = F.filter((r) => r.market === 'noi_dia').length;
  const quocTe = F.filter((r) => r.market === 'quoc_te').length;
  const choChay = countGroup(F, 'CHO_CHAY');
  const dangTest = countGroup(F, 'DANG_TEST');
  const dangDuyTri = countGroup(F, 'DUY_TRI');
  const daDung = countGroup(F, 'DA_DUNG');

  const kpi = {
    total: F.length,               // Tổng Content (theo bộ lọc thời gian)
    noiDia, quocTe, choChay, dangTest, dangDuyTri, daDung,
    testSuccessRate: successRate(dangDuyTri, daDung),
  };

  // Funnel
  const funnel = [
    { stage: 'Tổng Content', value: F.length, conv: 1 },
    { stage: 'Chờ chạy', value: choChay, conv: F.length ? choChay / F.length : 0 },
    { stage: 'Đang test', value: dangTest, conv: choChay ? dangTest / choChay : 0 },
    { stage: 'Đang duy trì', value: dangDuyTri, conv: dangTest ? dangDuyTri / dangTest : 0 },
  ];

  // By assignee (kèm metrics nghiệp vụ) — sắp xếp theo tỷ lệ test thành công
  const assignees = [...new Set(F.map((r) => r.assignee_name || '(trống)'))];
  const byAssignee = assignees.map((a) => {
    const rs = F.filter((r) => (r.assignee_name || '(trống)') === a);
    return { assignee: a, m: metrics(rs) };
  }).sort((x, y) => y.m.rateSuccess - x.m.rateSuccess || y.m.capped - x.m.capped);

  // By market (kèm metrics nghiệp vụ)
  const byMarket = ['noi_dia', 'quoc_te'].map((mk) => {
    const rs = F.filter((r) => r.market === mk);
    return { market: mk, label: mk === 'noi_dia' ? 'Nội Địa' : 'Quốc Tế', m: metrics(rs) };
  });

  // Status breakdown (group + current_status gốc cho tooltip)
  const order = ['CHO_CHAY', 'DANG_TEST', 'DUY_TRI', 'DA_DUNG', 'KHONG_TEST', 'KHONG_DUYET', 'CHUA_PHAN_LOAI'];
  const byStatus = order.map((g) => {
    const rs = F.filter((r) => r.status_group === g);
    const bd = new Map<string, number>();
    for (const r of rs) { const k = (r.current_status ?? '').trim() || '(trống)'; bd.set(k, (bd.get(k) ?? 0) + 1); }
    return { group: g, label: GROUP_LABEL[g], value: rs.length, breakdown: [...bd.entries()].sort((a, b) => b[1] - a[1]).map(([status, count]) => ({ status, count })) };
  }).filter((x) => x.value > 0);

  // Alerts (cũng theo bộ lọc thời gian)
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const STALE_DAYS = 10; // "Test quá lâu": quá 10 ngày kể từ Ngày Set Ads (test_date_real)
  const staleBefore = new Date(today); staleBefore.setDate(staleBefore.getDate() - STALE_DAYS);
  const staleIso = staleBefore.toISOString().slice(0, 10);
  const alerts = {
    chuaPhanLoai: countGroup(F, 'CHUA_PHAN_LOAI'),
    // Đang test + Ngày test (test_date_real) cũ hơn 10 ngày (KHÔNG dùng upload_date).
    testQuaLau: F.filter((r) => r.status_group === 'DANG_TEST' && r.test_date_real && r.test_date_real < staleIso).length,
    chuaTest: F.filter((r) => !(r.test_date ?? '').trim() && !['DANG_TEST', 'DUY_TRI', 'DA_DUNG', 'KHONG_TEST'].includes(r.status_group)).length,
    thieuNgayTest: F.filter((r) => !(r.test_date ?? '').trim()).length,
    thieuTrello: F.filter((r) => !(r.trello_link ?? '').trim()).length,
  };

  // Trend (theo upload_date_real)
  const trendMap = new Map<string, { capped: number; test: number; duyTri: number }>();
  for (const r of F) {
    if (!r.upload_date_real) continue;
    const k = bucketKey(r.upload_date_real, trendMode);
    if (!trendMap.has(k)) trendMap.set(k, { capped: 0, test: 0, duyTri: 0 });
    const b = trendMap.get(k)!;
    b.capped++;
    if (r.status_group === 'DANG_TEST') b.test++;
    if (r.status_group === 'DUY_TRI') b.duyTri++;
  }
  const trend = [...trendMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([bucket, v]) => ({ bucket, ...v }));

  return { kpi, metrics: metrics(F), funnel, byAssignee, byMarket, byStatus, alerts, trend, generatedAt: new Date().toISOString() };
}

/* ============================================================
 * Routes
 * ========================================================== */
const app = express();
// Log request đầu tiên (chỉ ghi log, không đổi logic)
app.use((req, _res, next) => { console.log(req.method, req.url); next(); });
app.use(cors());
// Serve React dashboard (web/dist) built by Vite
app.use(express.static(path.join(process.cwd(), 'web', 'dist')));

// Healthcheck cho Railway / uptime probe
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/api/config', (_req, res) => res.json({ url, anonKey: anonKey ?? null }));

function parseFilters(q: any): Filters {
  return {
    market: q.market || 'ALL',
    assignee: q.assignee || 'ALL',
    status: q.status || 'ALL',
    from: q.from || undefined,
    to: q.to || undefined,
    dateField: q.dateField === 'test_date_real' ? 'test_date_real' : 'upload_date_real',
  };
}

app.get('/api/v3/summary', async (req, res) => {
  try {
    const rows = await getContents();
    const trendMode = ['day', 'week', 'month'].includes(req.query.trend as string) ? (req.query.trend as string) : 'day';
    res.json(buildSummary(rows, parseFilters(req.query), trendMode));
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});

app.get('/api/v3/contents', async (req, res) => {
  try {
    const rows = await getContents();
    const f = parseFilters(req.query);
    let list = applyDate(applyBase(rows, f), f);

    const todayMs = todayUtcMs();
    // Drill-down theo alert (tuỳ chọn) — gồm cả alert vòng đời
    const alert = req.query.alert as string | undefined;
    if (alert) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const staleBefore = new Date(today); staleBefore.setDate(staleBefore.getDate() - 10); // "Test quá lâu": >10 ngày từ Ngày Set Ads
      const staleIso = staleBefore.toISOString().slice(0, 10);
      const tested = ['DANG_TEST', 'DUY_TRI', 'DA_DUNG', 'KHONG_TEST']; // KHONG_TEST: không còn cần test
      list = list.filter((r) => {
        switch (alert) {
          case 'chuaPhanLoai': return r.status_group === 'CHUA_PHAN_LOAI';
          case 'testQuaLau': return r.status_group === 'DANG_TEST' && !!r.test_date_real && r.test_date_real < staleIso;
          case 'chuaTest': return !(r.test_date ?? '').trim() && !tested.includes(r.status_group);
          case 'thieuNgayTest': return !(r.test_date ?? '').trim();
          case 'thieuTrello': return !(r.trello_link ?? '').trim();
          // --- alert vòng đời ---
          case 'testOver7': return (r.current_status ?? '').trim() === 'Đang test' && (maintainOrTestAge(r, todayMs) ?? -1) > 7;
          case 'choChayOver30': return (r.current_status ?? '').trim() === 'Chờ chạy' && (ageDays(r, todayMs) ?? -1) > 30;
          case 'duyTriOver180': return isActiveMaint(r) && (maintainDays(r, todayMs) ?? -1) > 180;
          case 'thieuUpload': return !r.upload_date_real;
          case 'chuaTrangThai': return (r.current_status ?? '').trim() === '';
          default: return true;
        }
      });
    }
    // Lọc theo tuổi thọ (ngày) — drill-down phân bố vòng đời
    const ageMin = req.query.ageMin != null ? parseInt(req.query.ageMin as string) : null;
    const ageMax = req.query.ageMax != null ? parseInt(req.query.ageMax as string) : null;
    if (ageMin != null || ageMax != null) {
      list = list.filter((r) => {
        const a = ageDays(r, todayMs);
        if (a == null) return false;
        if (ageMin != null && a < ageMin) return false;
        if (ageMax != null && a > ageMax) return false;
        return true;
      });
    }
    // Lọc danh sách content_code cụ thể (drill Top vòng đời)
    const codes = (req.query.codes as string | undefined)?.split(',').map((s) => s.trim()).filter(Boolean);
    if (codes && codes.length) {
      const set = new Set(codes);
      list = list.filter((r) => set.has(r.content_code));
    }
    // Chỉ content đã kết thúc (Đã chạy-Tắt)
    if (req.query.endedExact === '1') list = list.filter(isEnded);

    // Tìm kiếm theo content_code/title (Content Explorer)
    const q = (req.query.q as string | undefined)?.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        (r.content_code ?? '').toLowerCase().includes(q) || (r.title ?? '').toLowerCase().includes(q));
    }
    // sort: mặc định upload_date_real desc; 'age_desc' theo tuổi thọ
    if (req.query.sort === 'age_desc') {
      list = [...list].sort((a, b) => (ageDays(b, todayMs) ?? -1) - (ageDays(a, todayMs) ?? -1));
    } else {
      list = [...list].sort((a, b) =>
        (b.upload_date_real ?? '').localeCompare(a.upload_date_real ?? '') || (b.id ?? 0) - (a.id ?? 0));
    }
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(req.query.pageSize as string) || 20));
    const total = list.length;
    const items = list.slice((page - 1) * pageSize, page * pageSize).map((r) => ({
      content_code: r.content_code,
      title: r.title ?? '',
      market: r.market,
      assignee_name: r.assignee_name,
      editor_name: r.editor_name ?? '', // additive — phục vụ drill "Cần xử lý" (cột Biên tập + thống kê)
      current_status: r.current_status ?? '',
      status_group: r.status_group,
      upload_date: r.upload_date ?? '',
      upload_date_real: r.upload_date_real ?? null,
      test_date: r.test_date ?? '',
      test_date_real: r.test_date_real ?? null,
      trello_link: r.trello_link ?? '',
    }));
    res.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});

// Module Đồng bộ dữ liệu: lịch sử sync + độ tươi dữ liệu
app.get('/api/v3/sync-status', async (_req, res) => {
  try {
    const rows = await getContents();
    const total = rows.length;
    const uploadReal = rows.filter((r) => r.upload_date_real).length;
    const testReal = rows.filter((r) => r.test_date_real).length;
    const byMarket = {
      noi_dia: rows.filter((r) => r.market === 'noi_dia').length,
      quoc_te: rows.filter((r) => r.market === 'quoc_te').length,
    };
    let logs: any[] = [];
    const { data, error } = await supabase
      .from('sync_logs').select('*').order('id', { ascending: false }).limit(20);
    if (!error && data) logs = data;
    res.json({
      totals: {
        total, uploadReal, uploadNull: total - uploadReal,
        testReal, testNull: total - testReal, byMarket,
      },
      logs,
      lastSync: logs[0] ?? null,
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});

/* ============================================================
 * Module Content Lifecycle (vòng đời content)
 * ========================================================== */
async function historyHasData(): Promise<boolean> {
  const { count, error } = await supabase
    .from('content_status_history').select('*', { count: 'exact', head: true });
  if (error) return false;
  return (count ?? 0) > 0;
}

const LIFECYCLE_BUCKETS = [
  { key: '0-7', label: '0–7 ngày', min: 0, max: 7 },
  { key: '8-30', label: '8–30 ngày', min: 8, max: 30 },
  { key: '31-60', label: '31–60 ngày', min: 31, max: 60 },
  { key: '61-90', label: '61–90 ngày', min: 61, max: 90 },
  { key: '91-180', label: '91–180 ngày', min: 91, max: 180 },
  { key: '180+', label: 'Trên 180 ngày', min: 181, max: Infinity },
];

app.get('/api/v3/lifecycle', async (req, res) => {
  try {
    const rows = await getContents();
    // Vòng đời lọc theo Ngày Set Ads (test_date_real), KHÔNG dùng upload_date.
    const f: Filters = { ...parseFilters(req.query), dateField: 'test_date_real' };
    const todayMs = todayUtcMs();
    const base = applyBase(rows, f);
    const P = applyDate(base, f); // content có Ngày Set Ads trong kỳ lọc

    const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
    const life = (r: Enriched) => liveDays(r, todayMs); // hôm nay − test_date_real (derived cho cả Đã chạy-Tắt)

    // Quần thể "đã chạy" để đánh giá chất lượng: Duy trì hoặc Đã chạy-Tắt, đã set ads
    const ran = P.filter((r) => (isActiveMaint(r) || isEnded(r)) && r.test_date_real);
    const lives = ran.map((r) => life(r)!).filter((x) => x != null);
    const duyTri = P.filter((r) => isActiveMaint(r) && r.test_date_real);
    const endedRows = P.filter((r) => isEnded(r) && r.test_date_real);

    const slim = (r?: Enriched, days?: number) => r ? {
      content_code: r.content_code, title: r.title ?? '', editor_name: r.editor_name ?? '',
      assignee_name: r.assignee_name, market: r.market, days: days ?? 0,
    } : null;

    const topMaintain = duyTri.map((r) => ({ r, d: life(r)! })).sort((a, b) => b.d - a.d);
    const longestMaint = topMaintain[0];
    const longestEnded = endedRows.map((r) => ({ r, d: life(r)! })).sort((a, b) => b.d - a.d)[0];

    const kpi = {
      avgAge: Math.round(avg(lives)),
      ranCount: ran.length,
      longestMaintain: longestMaint ? slim(longestMaint.r, longestMaint.d) : null,
      longestEnded: longestEnded ? slim(longestEnded.r, longestEnded.d) : null,
      newToMaintain: duyTri.length,   // Content mới vào Duy trì trong kỳ
      endedInPeriod: endedRows.length, // Content kết thúc trong kỳ
    };

    // Tuổi thọ TB theo Biên tập / Người nhận / Thị trường (trên quần thể ran)
    const groupAvg = (keyFn: (r: Enriched) => string) => {
      const m = new Map<string, number[]>();
      for (const r of ran) {
        const k = keyFn(r) || '(trống)'; const d = life(r); if (d == null) continue;
        (m.get(k) ?? m.set(k, []).get(k)!).push(d);
      }
      return [...m.entries()].map(([key, arr]) => ({ key, avgAge: Math.round(avg(arr)), count: arr.length }))
        .sort((a, b) => b.avgAge - a.avgAge);
    };
    const byEditorAvg = groupAvg((r) => r.editor_name ?? '');
    const byAssigneeAvg = groupAvg((r) => r.assignee_name ?? '').map((x) => ({ assignee: x.key, avgAge: x.avgAge, count: x.count }));
    const byMarketAvg = ['noi_dia', 'quoc_te'].map((mk) => {
      const arr = ran.filter((r) => r.market === mk).map((r) => life(r)!).filter((x) => x != null);
      return { market: mk, label: mk === 'noi_dia' ? 'Nội Địa' : 'Quốc Tế', avgAge: Math.round(avg(arr)), count: arr.length };
    });

    // Card nhỏ: phân bố vòng đời (trên ran)
    const distribution = LIFECYCLE_BUCKETS.map((b) => ({
      key: b.key, label: b.label,
      count: ran.filter((r) => { const d = life(r); return d != null && d >= b.min && d <= b.max; }).length,
    }));

    // Top 20 Content đang duy trì lâu nhất
    const top20 = topMaintain.slice(0, 20).map((x) => ({
      content_code: x.r.content_code, title: x.r.title ?? '', editor_name: x.r.editor_name ?? '',
      assignee_name: x.r.assignee_name, market: x.r.market, test_date_real: x.r.test_date_real ?? null,
      days: x.d, current_status: x.r.current_status ?? '',
      status_group: x.r.status_group, trello_link: x.r.trello_link ?? '',
    }));

    const hasHistory = await historyHasData();
    res.json({ source: hasHistory ? 'history' : 'derived', kpi, byEditorAvg, byAssigneeAvg, byMarketAvg, distribution, top20, generatedAt: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});

// Trang chi tiết content: timeline
app.get('/api/v3/content-detail', async (req, res) => {
  try {
    const rows = await getContents();
    const code = (req.query.code as string || '').trim();
    const market = (req.query.market as string || '').trim();
    const assignee = (req.query.assignee as string || '').trim();
    const r = rows.find((x) => x.content_code === code &&
      (!market || x.market === market) && (!assignee || x.assignee_name === assignee));
    if (!r) return res.status(404).json({ error: 'Không tìm thấy content' });

    const todayMs = todayUtcMs();
    let history: any[] = [];
    if (r.id != null) {
      const { data } = await supabase.from('content_status_history')
        .select('*').eq('content_id', r.id).order('changed_at', { ascending: true });
      if (data) history = data;
    }

    let timeline: { label: string; date: string | null }[];
    let source: string;
    if (history.length) {
      source = 'history';
      timeline = [
        { label: 'Upload', date: r.upload_date_real ?? null },
        ...history.map((h) => ({ label: h.status, date: (h.changed_at ?? '').slice(0, 10) || null })),
      ];
    } else {
      source = 'derived';
      timeline = [
        { label: 'Ngày upload', date: r.upload_date_real ?? null },
        { label: 'Ngày test', date: r.test_date_real ?? null },
        { label: 'Trạng thái hiện tại: ' + ((r.current_status ?? '').trim() || '—'), date: null },
      ];
    }

    res.json({
      source,
      content: {
        content_code: r.content_code, title: r.title ?? '', market: r.market, assignee_name: r.assignee_name,
        cgsd: r.cgsd ?? '', editor_name: r.editor_name ?? '', trello_link: r.trello_link ?? '',
        current_status: r.current_status ?? '', status_group: r.status_group,
        upload_date: r.upload_date ?? '', upload_date_real: r.upload_date_real ?? null,
        test_date: r.test_date ?? '', test_date_real: r.test_date_real ?? null,
        ageDays: ageDays(r, todayMs), maintainDays: maintainDays(r, todayMs),
      },
      timeline,
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});

// Bảng chi tiết vòng đời: danh sách đã tính tuổi thọ (client tự search/sort/export)
app.get('/api/v3/lifecycle-table', async (req, res) => {
  try {
    const rows = await getContents();
    const f = parseFilters(req.query);
    const todayMs = todayUtcMs();
    const list = applyDate(applyBase(rows, f), f);
    const items = list.map((r) => ({
      content_code: r.content_code, title: r.title ?? '',
      editor_name: r.editor_name ?? '',
      assignee_name: r.assignee_name, market: r.market,
      upload_date_real: r.upload_date_real ?? null, test_date_real: r.test_date_real ?? null,
      current_status: r.current_status ?? '', status_group: r.status_group,
      ageDays: ageDays(r, todayMs), maintainDays: maintainDays(r, todayMs),
      trello_link: r.trello_link ?? '',
    }));
    res.json({ items, total: items.length, generatedAt: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});

// Ads Monitor — API nội bộ độc lập (PHASE 3, mock). Đăng ký TRƯỚC SPA fallback.
app.use('/ads-monitor', adsMonitorRouter);

// SPA fallback — trả về web/dist/index.html cho mọi route không phải /api/*
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'web', 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`✅ Dashboard V3 (Operations) chạy tại http://localhost:${PORT}`));
