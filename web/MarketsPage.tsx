import { useEffect, useMemo, useState } from 'react';
import {
  PageContainer, FilterBar, SectionHeader, KPICard, ChartCard, ContentCard,
  DataTable, EmptyState, LoadingSkeleton, ActionButton, StatusBadge, MetricTooltip,
  type DateRangeValue, type Column,
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
  if (!iso) return null; const t = Date.parse(iso + 'T00:00:00Z'); if (isNaN(t)) return null;
  return Math.max(0, Math.floor((todayMs - t) / 86400000));
};
const MK_COLOR: Record<string, string> = { noi_dia: '#5eead4', quoc_te: '#b6c2ff' };
const MK_LABEL: Record<string, string> = { noi_dia: 'Nội Địa', quoc_te: 'Quốc Tế' };

interface Row { market: string; editor_name: string; current_status: string; status_group: string; test_date_real: string | null; maintainDays: number | null; }
interface Agg {
  market: string; total: number; tested: number; dangTest: number; duyTri: number; daChayTat: number;
  daTestKoChay: number; choChay: number; khongDuyet: number; rateTested: number; rateSuccess: number;
  avgLife: number; d30: number; d60: number; d90: number; d180: number;
}
function aggregate(rows: Row[], market: string): Agg {
  const rs = rows.filter((r) => r.market === market);
  let dangTest = 0, duyTri = 0, daChayTat = 0, daTestKoChay = 0, choChay = 0, khongDuyet = 0;
  let lifeSum = 0, lifeN = 0, d30 = 0, d60 = 0, d90 = 0, d180 = 0;
  for (const r of rs) {
    const s = (r.current_status || '').trim();
    if (s === 'Đang test') dangTest++;
    else if (s.startsWith('Duy trì')) {
      duyTri++; const md = r.maintainDays ?? 0;
      if (md > 30) d30++; if (md > 60) d60++; if (md > 90) d90++; if (md > 180) d180++;
    }
    else if (s === 'Đã chạy-Tắt') daChayTat++;
    else if (s === 'Đã test-ko chạy') daTestKoChay++;
    else if (s === 'Chờ chạy') choChay++;
    else if (s === 'Không được duyệt') khongDuyet++;
    if (s.startsWith('Duy trì') || s === 'Đã chạy-Tắt') { const d = liveDays(r.test_date_real); if (d != null) { lifeSum += d; lifeN++; } }
  }
  const tested = dangTest + duyTri + daChayTat + daTestKoChay;
  const success = duyTri + daChayTat;
  return {
    market, total: rs.length, tested, dangTest, duyTri, daChayTat, daTestKoChay, choChay, khongDuyet,
    rateTested: rs.length ? tested / rs.length : 0, rateSuccess: tested ? success / tested : 0,
    avgLife: lifeN ? Math.round(lifeSum / lifeN) : 0, d30, d60, d90, d180,
  };
}

/* ---------- small metric w/ tooltip (không phải Card) ---------- */
function Metric({ label, value, tip, tone }: { label: string; value: React.ReactNode; tip?: string; tone?: 'good' | 'accent' }) {
  const col = tone === 'good' ? 'text-success' : tone === 'accent' ? 'text-accent' : 'text-fg';
  return (
    <div>
      <div className="flex items-center gap-1 text-[11px] text-muted">
        {label}
        {tip && <MetricTooltip tip={tip}><span className="inline-flex h-[13px] w-[13px] cursor-help items-center justify-center rounded-full bg-surface2 text-[9px] text-muted">i</span></MetricTooltip>}
      </div>
      <div className={`text-[18px] font-bold ${col}`}>{value}</div>
    </div>
  );
}

/* ---------- market card ---------- */
function MarketCard({ a, onDrill }: { a: Agg; onDrill: () => void }) {
  const statuses: [string, number, string?][] = [
    ['Đã test', a.tested], ['Đang test', a.dangTest], ['Duy trì', a.duyTri, 'text-success'],
    ['Đã chạy-Tắt', a.daChayTat], ['Test-ko chạy', a.daTestKoChay, 'text-muted'],
    ['Chờ chạy', a.choChay, 'text-muted'], ['Không duyệt', a.khongDuyet, 'text-muted'],
  ];
  return (
    <div role="button" tabIndex={0} onClick={onDrill} className="cursor-pointer rounded-card transition hover:opacity-95">
      <ContentCard
        title={<span className="flex items-center gap-2 text-base"><StatusBadge kind="market" value={a.market} /> <span className="text-muted">·</span> Tổng <b className="text-fg">{a.total}</b></span>}
        action={<span className="rounded-pill bg-success/15 px-2 py-0.5 text-[11px] text-success">Thành công {pct(a.rateSuccess)}</span>}
      >
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
          {statuses.map(([l, v, c]) => (
            <div key={l}><div className="text-[11px] text-muted">{l}</div><div className={`text-[15px] font-semibold ${c ?? 'text-fg'}`}>{v}</div></div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 border-t border-line pt-3">
          <Metric label="Tỷ lệ đã test" value={pct(a.rateTested)} tip="Đã được test ÷ Tổng. Đã test = Đang test + Duy trì + Đã test-ko chạy + Đã chạy-Tắt." />
          <Metric label="Tỷ lệ test thành công" value={pct(a.rateSuccess)} tone="good" tip="Thành công ÷ Đã được test. Thành công = Duy trì + Đã chạy-Tắt." />
          <Metric label="Tuổi thọ content TB" value={`${a.avgLife}d`} tip="TB số ngày từ Ngày Set Ads (test) của content Duy trì + Đã chạy-Tắt." />
        </div>
        <div className="mt-3 grid grid-cols-4 gap-3 border-t border-line pt-3">
          <Metric label="Duy trì >30d" value={a.d30} tip="Content Duy trì có số ngày duy trì > 30." />
          <Metric label="Duy trì >60d" value={a.d60} tip="Content Duy trì có số ngày duy trì > 60." />
          <Metric label="Duy trì >90d" value={a.d90} tip="Content Duy trì có số ngày duy trì > 90." />
          <Metric label="Duy trì >180d" value={a.d180} tip="Content Duy trì có số ngày duy trì > 180." />
        </div>
        <div className="mt-3 text-right text-[13px] text-accent">Xem content →</div>
      </ContentCard>
    </div>
  );
}

/* ---------- charts ---------- */
function CompareChart({ noi, quoc }: { noi: Agg; quoc: Agg }) {
  const metrics: [string, number, number][] = [
    ['Tổng content', noi.total, quoc.total],
    ['Đang test', noi.dangTest, quoc.dangTest],
    ['Duy trì', noi.duyTri, quoc.duyTri],
    ['Đã chạy-Tắt', noi.daChayTat, quoc.daChayTat],
  ];
  const max = Math.max(...metrics.flatMap(([, a, b]) => [a, b]), 1);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: MK_COLOR.noi_dia }} /> Nội Địa</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: MK_COLOR.quoc_te }} /> Quốc Tế</span>
      </div>
      {metrics.map(([label, a, b]) => (
        <div key={label} className="flex items-center gap-[10px]">
          <span className="w-[96px] shrink-0 text-[13px] text-muted">{label}</span>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2"><div className="h-3 rounded-[3px]" style={{ width: `${(a / max) * 100}%`, minWidth: 2, background: MK_COLOR.noi_dia }} /><span className="text-[11px] tabular-nums text-muted">{a}</span></div>
            <div className="flex items-center gap-2"><div className="h-3 rounded-[3px]" style={{ width: `${(b / max) * 100}%`, minWidth: 2, background: MK_COLOR.quoc_te }} /><span className="text-[11px] tabular-nums text-muted">{b}</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}
function DuoBar({ noi, quoc, suffix = '' }: { noi: number; quoc: number; suffix?: string }) {
  const max = Math.max(noi, quoc, 1);
  const row = (label: string, v: number, color: string) => (
    <div className="flex items-center gap-[10px]">
      <span className="w-[70px] shrink-0 text-[13px] text-muted">{label}</span>
      <div className="h-[18px] flex-1 overflow-hidden rounded-[5px] bg-surface2"><div className="h-full rounded-[5px]" style={{ width: `${(v / max) * 100}%`, background: color }} /></div>
      <span className="w-[52px] text-right font-semibold tabular-nums text-fg">{v}{suffix}</span>
    </div>
  );
  return <div className="flex flex-col gap-[9px]">{row('Nội Địa', noi, MK_COLOR.noi_dia)}{row('Quốc Tế', quoc, MK_COLOR.quoc_te)}</div>;
}

/* ---------- drill explorer ---------- */
function ExplorerView({ market, from, to, onBack }: { market: string; from?: string; to?: string; onBack: () => void }) {
  const [data, setData] = useState<any>(null); const [page, setPage] = useState(1); const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ market, page: String(page), pageSize: '20' });
    if (from) p.set('from', from); if (to) p.set('to', to);
    fetch('/api/v3/contents?' + p).then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, [market, from, to, page]);
  const columns: Column<any>[] = [
    { key: 'content_code', header: 'content_code', render: (r) => r.trello_link ? <a href={r.trello_link} target="_blank" rel="noopener" className="font-mono text-xs text-accent">{r.content_code}</a> : <span className="font-mono text-xs">{r.content_code}</span> },
    { key: 'assignee_name', header: 'Nhân viên Ads' },
    { key: 'current_status', header: 'Trạng thái', render: (r) => <StatusBadge value={r.status_group} label={r.current_status} /> },
    { key: 'upload_date_real', header: 'Upload', render: (r) => r.upload_date_real ?? <span className="text-muted">—</span> },
    { key: 'test_date_real', header: 'Ngày test', render: (r) => r.test_date_real ?? <span className="text-muted">—</span> },
  ];
  return (
    <PageContainer>
      <div className="mb-3 flex items-center gap-3">
        <ActionButton variant="ghost" onClick={onBack}>← Quay lại</ActionButton>
        <SectionHeader title={`Content Explorer · ${MK_LABEL[market] ?? market}`} />
      </div>
      {loading && !data ? <LoadingSkeleton variant="table" count={8} /> : (
        <>
          <DataTable columns={columns} rows={data?.items ?? []} rowKey={(r, i) => r.content_code + i} empty="Không có content" maxHeight={520} />
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

/* ============ Page ============ */
export function MarketsPage() {
  const [range, setRange] = useState<DateRangeValue>({ preset: 'thismonth' });
  const [market, setMarket] = useState('ALL');
  const [assignee, setAssignee] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [editor, setEditor] = useState('ALL');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<string | null>(null);

  const period = range.preset === 'custom' ? { from: range.from, to: range.to } : presetRange(range.preset);
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (period.from) p.set('from', period.from); if (period.to) p.set('to', period.to);
    if (market !== 'ALL') p.set('market', market);
    if (assignee !== 'ALL') p.set('assignee', assignee);
    if (status !== 'ALL') p.set('status', status);
    return p.toString();
  }, [period.from, period.to, market, assignee, status]);

  useEffect(() => {
    let alive = true; setLoading(true);
    fetch('/api/v3/lifecycle-table?' + query).then((r) => r.json())
      .then((d) => { if (!alive) return; if (d.error) throw new Error(d.error); setRows(d.items); setError(null); })
      .catch((e) => alive && setError(e.message)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [query]);

  // Lọc "Biên tập" phía client (additive — không đổi công thức)
  const rowsF = useMemo(() => (rows && editor !== 'ALL' ? rows.filter((r) => (r.editor_name || '') === editor) : rows), [rows, editor]);
  const noi = useMemo(() => rowsF ? aggregate(rowsF, 'noi_dia') : null, [rowsF]);
  const quoc = useMemo(() => rowsF ? aggregate(rowsF, 'quoc_te') : null, [rowsF]);

  if (drill) return (
    <div className="text-fg">
      <FilterBar title="Thị Trường → Explorer" />
      <ExplorerView market={drill} from={period.from} to={period.to} onBack={() => setDrill(null)} />
    </div>
  );

  return (
    <div className="text-fg">
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
        onReset={() => { setRange({ preset: 'thismonth' }); setMarket('ALL'); setAssignee('ALL'); setStatus('ALL'); setEditor('ALL'); }}
      />

      <PageContainer>
        {error ? <EmptyState icon="⚠️" message={`Lỗi: ${error}`} />
          : loading && !rows ? <div className="space-y-4"><LoadingSkeleton variant="block" /><LoadingSkeleton variant="block" /></div>
          : !noi || !quoc || noi.total + quoc.total === 0 ? <EmptyState message="Không có dữ liệu trong kỳ lọc" />
          : (
          <>
            <SectionHeader title="Theo thị trường (di chuột ⓘ xem công thức · click thẻ để xem content)" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <MarketCard a={noi} onDrill={() => setDrill('noi_dia')} />
              <MarketCard a={quoc} onDrill={() => setDrill('quoc_te')} />
            </div>

            <div className="mt-2">
              <ChartCard title="So sánh Nội Địa vs Quốc Tế">
                <CompareChart noi={noi} quoc={quoc} />
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title="Tuổi thọ content trung bình (ngày)"><DuoBar noi={noi.avgLife} quoc={quoc.avgLife} suffix="d" /></ChartCard>
              <ChartCard title="Tỷ lệ test thành công"><DuoBar noi={Math.round(noi.rateSuccess * 100)} quoc={Math.round(quoc.rateSuccess * 100)} suffix="%" /></ChartCard>
            </div>
          </>
        )}
      </PageContainer>
    </div>
  );
}
