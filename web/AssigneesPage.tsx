import { useEffect, useMemo, useState } from 'react';
import {
  PageContainer, FilterBar, SectionHeader, KPICard, StatCard, ChartCard,
  DataTable, EmptyState, LoadingSkeleton, ActionButton, StatusBadge,
  type DateRangeValue, type Column, type SortState,
} from '../src/components/ui';
import { GlobalFilter } from './GlobalFilter';

/* ---------- helpers ---------- */
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pct = (x: number) => `${Math.round((x ?? 0) * 100)}%`;
function presetRange(p: string): { from?: string; to?: string } {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = (x: number) => { const c = new Date(now); c.setDate(c.getDate() + x); return c; };
  const mon = (b: Date) => { const c = new Date(b); const w = (c.getDay() + 6) % 7; c.setDate(c.getDate() - w); return c; };
  switch (p) {
    case 'today': return { from: ymd(now), to: ymd(now) };
    case 'yesterday': return { from: ymd(d(-1)), to: ymd(d(-1)) };
    case 'last7': return { from: ymd(d(-6)), to: ymd(now) };
    case 'last30': return { from: ymd(d(-29)), to: ymd(now) };
    case 'thisweek': { const m = mon(now); const s = new Date(m); s.setDate(s.getDate() + 6); return { from: ymd(m), to: ymd(s) }; }
    case 'lastweek': { const m = mon(now); m.setDate(m.getDate() - 7); const s = new Date(m); s.setDate(s.getDate() + 6); return { from: ymd(m), to: ymd(s) }; }
    case 'thismonth': return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    case 'lastmonth': return { from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)) };
    default: return {};
  }
}
const todayMs = (() => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); })();
const liveDays = (iso: string | null): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso + 'T00:00:00Z'); if (isNaN(t)) return null;
  return Math.max(0, Math.floor((todayMs - t) / 86400000));
};
const selectCls = 'rounded-control border border-line bg-surface px-2 py-[6px] text-[13px] text-fg';

/* ---------- types ---------- */
interface Row {
  assignee_name: string; editor_name: string; market: string; current_status: string; status_group: string;
  test_date_real: string | null; maintainDays: number | null;
}
interface AggRow {
  assignee: string; total: number; tested: number; dangTest: number; duyTri: number;
  daChayTat: number; daTestKoChay: number; choChay: number; khongDuyet: number;
  rateTested: number; rateSuccess: number; avgLife: number;
  duyTri30: number; duyTri60: number; duyTri90: number; duyTri180: number;
  dangTestAll: number; // 'Đang test' ALL-TIME (giống KPI nghiệp vụ) — gán sau khi có dữ liệu all-time
}

function aggregate(rows: Row[]): AggRow[] {
  const map = new Map<string, Row[]>();
  for (const r of rows) {
    const k = r.assignee_name || '(trống)';
    (map.get(k) ?? map.set(k, []).get(k)!).push(r);
  }
  return [...map.entries()].map(([assignee, rs]) => {
    let dangTest = 0, duyTri = 0, daChayTat = 0, daTestKoChay = 0, choChay = 0, khongDuyet = 0;
    let lifeSum = 0, lifeN = 0, duyTri30 = 0, duyTri60 = 0, duyTri90 = 0, duyTri180 = 0;
    for (const r of rs) {
      const s = (r.current_status || '').trim();
      if (s === 'Đang test') dangTest++;
      else if (s.startsWith('Duy trì')) {
        duyTri++; const md = r.maintainDays ?? 0;
        if (md > 30) duyTri30++; if (md > 60) duyTri60++; if (md > 90) duyTri90++; if (md > 180) duyTri180++;
      }
      else if (s === 'Đã chạy-Tắt') daChayTat++;
      else if (s === 'Đã test-ko chạy') daTestKoChay++;
      else if (s === 'Chờ chạy') choChay++;
      else if (s === 'Không được duyệt') khongDuyet++;
      // tuổi thọ: ran = Duy trì + Đã chạy-Tắt, tính từ Ngày Set Ads
      if ((s.startsWith('Duy trì') || s === 'Đã chạy-Tắt')) {
        const d = liveDays(r.test_date_real); if (d != null) { lifeSum += d; lifeN++; }
      }
    }
    const tested = dangTest + duyTri + daChayTat + daTestKoChay;
    const coKetQua = duyTri + daChayTat + daTestKoChay; // đã có kết quả cuối (LOẠI 'Đang test')
    const success = duyTri;                             // Thành công = CHỈ Duy trì (Chưa vít + Đã vít)
    return {
      assignee, total: rs.length, tested, dangTest, duyTri, daChayTat, daTestKoChay, choChay, khongDuyet,
      rateTested: rs.length ? tested / rs.length : 0,
      rateSuccess: coKetQua ? success / coKetQua : 0,
      avgLife: lifeN ? Math.round(lifeSum / lifeN) : 0,
      duyTri30, duyTri60, duyTri90, duyTri180,
      dangTestAll: 0, // gán sau (merge từ dữ liệu all-time)
    };
  });
}

/* ============ Drill: Content Explorer (in-app) ============ */
function ExplorerView({ assignee, from, to, market, onBack }: { assignee: string; from?: string; to?: string; market: string; onBack: () => void }) {
  const [data, setData] = useState<{ items: any[]; total: number; page: number; totalPages: number } | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ assignee, page: String(page), pageSize: '20' });
    if (from) p.set('from', from); if (to) p.set('to', to);
    if (market !== 'ALL') p.set('market', market);
    fetch('/api/v3/contents?' + p.toString()).then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, [assignee, from, to, market, page]);

  const columns: Column<any>[] = [
    { key: 'content_code', header: 'content_code', render: (r) => r.trello_link
        ? <a href={r.trello_link} target="_blank" rel="noopener" className="font-mono text-xs text-accent">{r.content_code}</a>
        : <span className="font-mono text-xs">{r.content_code}</span> },
    { key: 'market', header: 'TT', render: (r) => <StatusBadge kind="market" value={r.market} /> },
    { key: 'current_status', header: 'Trạng thái', render: (r) => <StatusBadge value={r.status_group} label={r.current_status} /> },
    { key: 'upload_date_real', header: 'Upload', render: (r) => r.upload_date_real ?? <span className="text-muted">—</span> },
    { key: 'test_date_real', header: 'Ngày test', render: (r) => r.test_date_real ?? <span className="text-muted">—</span> },
  ];
  return (
    <PageContainer>
      <div className="mb-3 flex items-center gap-3">
        <ActionButton variant="ghost" onClick={onBack}>← Quay lại</ActionButton>
        <SectionHeader title={`Content Explorer · ${assignee}`} />
      </div>
      {loading && !data ? <LoadingSkeleton variant="table" count={8} /> : (
        <>
          <DataTable columns={columns} rows={data?.items ?? []} rowKey={(r, i) => r.content_code + i}
            empty="Không có content" maxHeight={520} />
          <div className="mt-3 flex items-center justify-end gap-3 text-[13px] text-muted">
            <ActionButton variant="ghost" disabled={(data?.page ?? 1) <= 1} onClick={() => setPage((p) => p - 1)}>← Trước</ActionButton>
            <span>Trang {data?.page ?? 1}/{Math.max(1, data?.totalPages ?? 1)} · {data?.total ?? 0} content</span>
            <ActionButton variant="ghost" disabled={(data?.page ?? 1) >= (data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>Sau →</ActionButton>
          </div>
        </>
      )}
    </PageContainer>
  );
}

/* ---------- status chart (per assignee, màu tối giản) ---------- */
const SEGMENTS = [
  { key: 'success', label: 'Thành công', color: 'var(--success)' },
  { key: 'dangTest', label: 'Đang test', color: 'var(--warn)' },
  { key: 'fail', label: 'Test thất bại', color: 'var(--slate)' },
  { key: 'other', label: 'Chưa test/khác', color: 'var(--surface2)' },
] as const;
function StatusChart({ rows }: { rows: AggRow[] }) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3 text-[11px] text-muted">
        {SEGMENTS.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
      {rows.map((r) => {
        const success = r.duyTri + r.daChayTat;
        const other = r.total - r.tested;
        const seg = [
          { v: success, c: 'var(--success)' }, { v: r.dangTest, c: 'var(--warn)' },
          { v: r.daTestKoChay, c: 'var(--slate)' }, { v: other, c: 'var(--surface2)' },
        ];
        return (
          <div key={r.assignee} className="flex items-center gap-[10px]">
            <span className="w-[70px] shrink-0 text-[13px] text-muted">{r.assignee}</span>
            <div className="flex h-[18px] flex-1 overflow-hidden rounded-[5px] bg-surface2" style={{ width: `${(r.total / max) * 100}%` }}>
              {seg.map((s, i) => <div key={i} style={{ width: `${(s.v / r.total) * 100}%`, background: s.c }} />)}
            </div>
            <span className="w-[40px] text-right font-semibold tabular-nums text-fg">{r.total}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ============ Page ============ */
// `embedded`: nhúng vào Tổng Quan → ẩn khối KPI "Hiệu suất tổng" (Tổng Quan đã có KPI nghiệp vụ).
// `filter`: nếu truyền vào (khi nhúng) → dùng bộ lọc của Tổng Quan và ẩn thanh lọc riêng bên dưới.
// Cách tính/biểu đồ/bảng giữ nguyên 100%.
export function AssigneesPage({ embedded = false, filter }: {
  embedded?: boolean;
  filter?: { preset: string; from?: string; to?: string; market: string; assignee: string; status: string; editor: string };
}) {
  const [range, setRange] = useState<DateRangeValue>({ preset: 'thismonth' });
  const [market, setMarket] = useState('ALL');
  const [assignee, setAssignee] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [editor, setEditor] = useState('ALL');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [allRows, setAllRows] = useState<Row[] | null>(null); // toàn bộ (KHÔNG giới hạn kỳ) — cho cột 'Đang test' all-time
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState | null>(null);
  const [drill, setDrill] = useState<string | null>(null);

  // Khi nhúng kèm `filter` (từ Tổng Quan) → dùng bộ lọc trên cùng; ngược lại dùng state nội bộ.
  const controlled = embedded && !!filter;
  const cRange: DateRangeValue = controlled
    ? { preset: filter!.preset as DateRangeValue['preset'], from: filter!.from, to: filter!.to }
    : range;
  const cMarket = controlled ? filter!.market : market;
  const cAssignee = controlled ? filter!.assignee : assignee;
  const cStatus = controlled ? filter!.status : status;
  const cEditor = controlled ? filter!.editor : editor;

  const period = cRange.preset === 'custom' ? { from: cRange.from, to: cRange.to } : presetRange(cRange.preset);
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (period.from) p.set('from', period.from);
    if (period.to) p.set('to', period.to);
    if (cMarket !== 'ALL') p.set('market', cMarket);
    if (cAssignee !== 'ALL') p.set('assignee', cAssignee);
    if (cStatus !== 'ALL') p.set('status', cStatus);
    return p.toString();
  }, [period.from, period.to, cMarket, cAssignee, cStatus]);

  useEffect(() => {
    let alive = true; setLoading(true);
    fetch('/api/v3/lifecycle-table?' + query).then((r) => r.json())
      .then((d) => { if (!alive) return; if (d.error) throw new Error(d.error); setRows(d.items); setError(null); })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [query]);

  // Query all-time = CÙNG bộ lọc nhưng BỎ from/to (giống KPI 'Đang test': không giới hạn kỳ).
  const allTimeQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (cMarket !== 'ALL') p.set('market', cMarket);
    if (cAssignee !== 'ALL') p.set('assignee', cAssignee);
    if (cStatus !== 'ALL') p.set('status', cStatus);
    return p.toString();
  }, [cMarket, cAssignee, cStatus]);

  useEffect(() => {
    let alive = true;
    fetch('/api/v3/lifecycle-table?' + allTimeQuery).then((r) => r.json())
      .then((d) => { if (alive && !d.error) setAllRows(d.items); })
      .catch(() => { /* cột all-time là phụ trợ — lỗi không chặn bảng */ });
    return () => { alive = false; };
  }, [allTimeQuery]);

  // Lọc "Biên tập" phía client (additive — không đổi công thức KPI)
  const rowsF = useMemo(() => (rows && cEditor !== 'ALL' ? rows.filter((r) => (r.editor_name || '') === cEditor) : rows), [rows, cEditor]);
  const agg = useMemo(() => (rowsF ? aggregate(rowsF) : []), [rowsF]);

  // Đếm 'Đang test' ALL-TIME theo Nhân viên Ads (giống công thức KPI nghiệp vụ: current_status === 'Đang test').
  const dangTestAllMap = useMemo(() => {
    const src = allRows ? (cEditor !== 'ALL' ? allRows.filter((r) => (r.editor_name || '') === cEditor) : allRows) : [];
    const m = new Map<string, number>();
    for (const r of src) {
      if ((r.current_status || '').trim() === 'Đang test') {
        const k = r.assignee_name || '(trống)';
        m.set(k, (m.get(k) ?? 0) + 1);
      }
    }
    return m;
  }, [allRows, cEditor]);

  // Gộp số 'Đang test' all-time vào từng dòng (chỉ cho cột hiển thị — KHÔNG đụng tested/tỷ lệ/biểu đồ).
  const aggAll = useMemo(() => agg.map((r) => ({ ...r, dangTestAll: dangTestAllMap.get(r.assignee) ?? 0 })), [agg, dangTestAllMap]);

  const ranked = useMemo(() => {
    const arr = [...aggAll];
    if (!sort) {
      // Ranking: 1) % thành công  2) tuổi thọ TB  3) tổng content
      arr.sort((a, b) => b.rateSuccess - a.rateSuccess || b.avgLife - a.avgLife || b.total - a.total);
    } else {
      const k = sort.key as keyof AggRow; const s = sort.dir === 'desc' ? -1 : 1;
      arr.sort((a, b) => (typeof a[k] === 'number' ? ((a[k] as number) - (b[k] as number)) * s
        : String(a[k]).localeCompare(String(b[k])) * s));
    }
    return arr;
  }, [aggAll, sort]);

  const overall = useMemo(() => {
    const total = agg.reduce((s, r) => s + r.total, 0);
    const tested = agg.reduce((s, r) => s + r.tested, 0);
    const coKetQua = agg.reduce((s, r) => s + r.duyTri + r.daChayTat + r.daTestKoChay, 0); // đã có kết quả cuối
    const success = agg.reduce((s, r) => s + r.duyTri, 0);                                  // Thành công = CHỈ Duy trì
    const duyTri30 = agg.reduce((s, r) => s + r.duyTri30, 0);
    const duyTri60 = agg.reduce((s, r) => s + r.duyTri60, 0);
    const duyTri90 = agg.reduce((s, r) => s + r.duyTri90, 0);
    const duyTri180 = agg.reduce((s, r) => s + r.duyTri180, 0);
    const lifeW = agg.reduce((s, r) => s + r.avgLife * (r.duyTri + r.daChayTat), 0);
    const lifeN = agg.reduce((s, r) => s + r.duyTri + r.daChayTat, 0);
    return { total, rateTested: total ? tested / total : 0, rateSuccess: coKetQua ? success / coKetQua : 0,
      avgLife: lifeN ? Math.round(lifeW / lifeN) : 0, duyTri30, duyTri60, duyTri90, duyTri180 };
  }, [agg]);

  const onSort = (key: string) => setSort((s) => s && s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' });

  const columns: Column<AggRow>[] = [
    { key: 'assignee', header: 'Nhân viên Ads', render: (r) => <b>{r.assignee}</b> },
    { key: 'total', header: 'Tổng', align: 'right', sortable: true },
    { key: 'tested', header: 'Đã test', align: 'right', sortable: true },
    { key: 'dangTestAll', header: 'Đang test', align: 'right', render: (r) => r.dangTestAll },
    { key: 'duyTri', header: 'Duy trì', align: 'right', render: (r) => <span className="text-success">{r.duyTri}</span> },
    { key: 'daChayTat', header: 'Chạy-Tắt', align: 'right' },
    { key: 'daTestKoChay', header: 'Test-ko chạy', align: 'right', render: (r) => <span className="text-muted">{r.daTestKoChay}</span> },
    { key: 'choChay', header: 'Chờ chạy', align: 'right', render: (r) => <span className="text-muted">{r.choChay}</span> },
    { key: 'khongDuyet', header: 'Ko duyệt', align: 'right', render: (r) => <span className="text-muted">{r.khongDuyet}</span> },
    { key: 'rateTested', header: '% Đã test', align: 'right', sortable: true, render: (r) => pct(r.rateTested) },
    { key: 'rateSuccess', header: '% Thành công', align: 'right', sortable: true, render: (r) => <b className="text-success">{pct(r.rateSuccess)}</b> },
    { key: 'avgLife', header: 'Tuổi thọ TB', align: 'right', sortable: true, render: (r) => `${r.avgLife}d` },
  ];

  if (drill) return (
    <div className="text-fg">
      <FilterBar title="Tiến độ Test Content → Explorer" />
      <ExplorerView assignee={drill} from={period.from} to={period.to} market={cMarket} onBack={() => setDrill(null)} />
    </div>
  );

  const resetAll = () => { setRange({ preset: 'thismonth' }); setMarket('ALL'); setAssignee('ALL'); setStatus('ALL'); setEditor('ALL'); setSort(null); };
  return (
    <div className="text-fg">
      {!controlled && (
        <GlobalFilter
          value={{ preset: range.preset, from: range.from, to: range.to, market, assignee, editor, status }}
          onChange={(p) => {
            if ('preset' in p || 'from' in p || 'to' in p)
              setRange({ preset: (p.preset ?? range.preset) as DateRangeValue['preset'], from: p.from ?? range.from, to: p.to ?? range.to });
            if (p.market !== undefined) setMarket(p.market);
            if (p.assignee !== undefined) setAssignee(p.assignee);
            if (p.editor !== undefined) setEditor(p.editor);
            if (p.status !== undefined) setStatus(p.status);
          }}
          onReset={resetAll}
        />
      )}

      <PageContainer>
        {error ? <EmptyState icon="⚠️" message={`Lỗi: ${error}`} />
          : loading && !rows ? <div className="space-y-4"><LoadingSkeleton variant="kpi" count={5} /><LoadingSkeleton variant="block" /></div>
          : agg.length === 0 ? <EmptyState message="Không có dữ liệu trong kỳ lọc" />
          : (
          <>
            {!embedded && (
              <>
                <SectionHeader title="Hiệu suất tổng (di chuột ⓘ xem công thức)" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  <StatCard label="Tổng content được cấp" value={overall.total} />
                  <KPICard label="Tỷ lệ đã test" value={pct(overall.rateTested)} tone="default"
                    tooltip="Đã được test ÷ Tổng. Đã test = Đang test + Duy trì + Đã test-ko chạy + Đã chạy-Tắt." />
                  <KPICard label="Tỷ lệ test thành công" value={pct(overall.rateSuccess)} tone="good"
                    tooltip="Thành công ÷ Đã có kết quả cuối. Thành công = Duy trì (Chưa vít + Đã vít). Mẫu = Duy trì + Đã test-ko chạy + Đã chạy-Tắt (loại Đang test)." />
                  <KPICard label="Tuổi thọ content TB" value={`${overall.avgLife}d`}
                    tooltip="Trung bình số ngày từ Ngày Set Ads (test) của content Duy trì + Đã chạy-Tắt." />
                  <KPICard label="Duy trì > 30 ngày" value={overall.duyTri30} tone="accent"
                    tooltip="Số content đang Duy trì có số ngày duy trì > 30." />
                  <KPICard label="Duy trì > 60 ngày" value={overall.duyTri60} tone="accent"
                    tooltip="Số content đang Duy trì có số ngày duy trì > 60." />
                  <KPICard label="Duy trì > 90 ngày" value={overall.duyTri90} tone="accent"
                    tooltip="Số content đang Duy trì có số ngày duy trì > 90." />
                  <KPICard label="Duy trì > 180 ngày" value={overall.duyTri180} tone="accent"
                    tooltip="Số content đang Duy trì có số ngày duy trì > 180." />
                </div>
              </>
            )}

            <div className="mt-4">
              <ChartCard title="Content theo trạng thái (theo Nhân viên Ads)">
                <StatusChart rows={ranked} />
              </ChartCard>
            </div>

            <SectionHeader title="Bảng xếp hạng (mặc định: % thành công → tuổi thọ → tổng · click một nhân viên để xem content)"
              action={<span className="text-xs text-muted">Cột “Đang test” tính all-time (giống KPI), các cột khác theo kỳ lọc</span>} />
            <DataTable columns={columns} rows={ranked} rowKey={(r) => r.assignee}
              sort={sort ?? undefined} onSort={onSort} onRowClick={(r) => setDrill(r.assignee)} maxHeight={520} />
          </>
        )}
      </PageContainer>
    </div>
  );
}
