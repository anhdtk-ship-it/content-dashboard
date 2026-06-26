import { useEffect, useMemo, useState } from 'react';
import {
  PageContainer, SectionHeader, KPICard, ChartCard, ContentCard,
  DataTable, EmptyState, LoadingSkeleton, StatusBadge,
  type DateRangeValue, type Column,
} from '../src/components/ui';
import { GlobalFilter } from './GlobalFilter';
import { editorLabel } from './editor-name';
import { DetailDrawer, type Item } from './ExplorerPage';

/* ---------- helpers ---------- */
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
const MK_COLOR: Record<string, string> = { noi_dia: '#5eead4', quoc_te: '#b6c2ff' };

interface Top20Row {
  stt?: number;
  content_code: string; title: string; editor_name: string; assignee_name: string; market: string;
  test_date_real: string | null; days: number; current_status: string; status_group: string; trello_link: string;
}
interface Lifecycle {
  source: string;
  kpi: { avgAge: number; ranCount: number; newToMaintain: number; endedInPeriod: number;
    longestMaintain: { content_code: string; days: number } | null;
    longestEnded: { content_code: string; days: number } | null; };
  byEditorAvg: { key: string; avgAge: number; count: number }[];
  byAssigneeAvg: { assignee: string; avgAge: number; count: number }[];
  byMarketAvg: { market: string; label: string; avgAge: number; count: number }[];
  distribution: { key: string; label: string; count: number }[];
  top20: Top20Row[];
}

/* bars tuổi thọ TB */
function AvgBars({ items }: { items: { label: string; avgAge: number; count: number }[] }) {
  const max = Math.max(...items.map((x) => x.avgAge), 1);
  return (
    <div className="flex flex-col gap-[9px]">
      {items.map((x) => (
        <div key={x.label} className="flex items-center gap-[10px]">
          <span className="w-[90px] shrink-0 truncate text-[13px] text-muted">{x.label}</span>
          <div className="h-[16px] flex-1 overflow-hidden rounded-[5px] bg-surface2"><div className="h-full rounded-[5px] bg-accent" style={{ width: `${(x.avgAge / max) * 100}%` }} /></div>
          <span className="w-[64px] text-right text-[13px] font-semibold tabular-nums text-fg">{x.avgAge}d <span className="text-[11px] font-normal text-muted">({x.count})</span></span>
        </div>
      ))}
    </div>
  );
}

/* ============ Page ============ */
export function LifecyclePage() {
  const [range, setRange] = useState<DateRangeValue>({ preset: 'thismonth' });
  const [market, setMarket] = useState('ALL');
  const [assignee, setAssignee] = useState('ALL');
  // editor/status có trong GlobalFilter dùng chung nhưng endpoint /lifecycle không nhận 2 tham số này
  // → giữ trong state để đồng bộ giao diện, KHÔNG đưa vào query (không đổi logic/query).
  const [editor, setEditor] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [data, setData] = useState<Lifecycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);

  const period = range.preset === 'custom' ? { from: range.from, to: range.to } : presetRange(range.preset);
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (period.from) p.set('from', period.from); if (period.to) p.set('to', period.to);
    if (market !== 'ALL') p.set('market', market);
    if (assignee !== 'ALL') p.set('assignee', assignee);
    return p.toString();
  }, [period.from, period.to, market, assignee]);

  useEffect(() => {
    let alive = true; setLoading(true);
    fetch('/api/v3/lifecycle?' + query).then((r) => r.json())
      .then((d) => { if (!alive) return; if (d.error) throw new Error(d.error); setData(d); setError(null); })
      .catch((e) => alive && setError(e.message)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [query]);

  // gộp distribution về 5 nhóm yêu cầu (0-30, 31-60, 61-90, 91-180, >180)
  const dist5 = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of data?.distribution ?? []) m[d.key] = d.count;
    return [
      { label: '0–30 ngày', count: (m['0-7'] ?? 0) + (m['8-30'] ?? 0) },
      { label: '31–60 ngày', count: m['31-60'] ?? 0 },
      { label: '61–90 ngày', count: m['61-90'] ?? 0 },
      { label: '91–180 ngày', count: m['91-180'] ?? 0 },
      { label: 'Trên 180 ngày', count: m['180+'] ?? 0 },
    ];
  }, [data]);
  const distMax = Math.max(...dist5.map((d) => d.count), 1);

  const openContent = (t: Top20Row) => setSelected({
    content_code: t.content_code, title: t.title, editor_name: t.editor_name, assignee_name: t.assignee_name,
    market: t.market, test_date_real: t.test_date_real, maintainDays: t.days,
    current_status: t.current_status, status_group: t.status_group, trello_link: t.trello_link,
  });

  const columns: Column<Top20Row>[] = [
    { key: 'stt', header: 'STT', align: 'right', render: (r) => r.stt },
    { key: 'content_code', header: 'Content', render: (r) => <span className="font-mono text-xs">{r.content_code}</span> },
    { key: 'editor_name', header: 'Biên tập', render: (r) => r.editor_name ? editorLabel(r.editor_name) : <span className="text-muted">—</span> },
    { key: 'assignee_name', header: 'Nhân viên Ads' },
    { key: 'market', header: 'Thị trường', render: (r) => <StatusBadge kind="market" value={r.market} /> },
    { key: 'test_date_real', header: 'Ngày Test', render: (r) => r.test_date_real ?? <span className="text-muted">—</span> },
    { key: 'days', header: 'Số ngày duy trì', align: 'right', render: (r) => <b>{r.days}</b> },
    { key: 'current_status', header: 'Trạng thái', render: (r) => <StatusBadge value={r.status_group} label={r.current_status} /> },
  ];

  const k = data?.kpi;

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
        onReset={() => { setRange({ preset: 'thismonth' }); setMarket('ALL'); setAssignee('ALL'); setEditor('ALL'); setStatus('ALL'); }}
      />

      <PageContainer>
        {error ? <EmptyState icon="⚠️" message={`Lỗi: ${error}`} />
          : loading && !data ? <div className="space-y-4"><LoadingSkeleton variant="kpi" count={5} /><LoadingSkeleton variant="block" /></div>
          : !k ? <EmptyState message="Không có dữ liệu" />
          : (
          <>
            <SectionHeader title={`Vòng đời tính từ Ngày Set Ads (test) · nguồn: ${data!.source}`} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <KPICard label="Tuổi thọ trung bình" value={`${k.avgAge}d`} tone="accent"
                tooltip="TB số ngày = Hôm nay − Ngày Test, trên content Duy trì + Đã chạy-Tắt. Không dùng upload_date." />
              <KPICard label="Đang duy trì lâu nhất" value={`${k.longestMaintain?.days ?? 0}d`}
                sub={k.longestMaintain?.content_code.slice(0, 22)} tone="good"
                tooltip="Content nhóm Duy trì có (Hôm nay − Ngày Test) lớn nhất." />
              <KPICard label="Đã từng duy trì lâu nhất" value={`${k.longestEnded?.days ?? 0}d`}
                sub={k.longestEnded?.content_code.slice(0, 22)}
                tooltip="Content Đã chạy-Tắt có vòng đời (Ngày tắt − Ngày Test) dài nhất." />
              <KPICard label="Mới vào Duy trì trong kỳ" value={k.newToMaintain}
                tooltip="Số content Duy trì có Ngày Test trong kỳ lọc." />
              <KPICard label="Kết thúc trong kỳ" value={k.endedInPeriod}
                tooltip="Số content Đã chạy-Tắt có Ngày Test trong kỳ lọc." />
            </div>

            <div className="mt-4">
              <ChartCard title="Top 20 Content đang duy trì lâu nhất (click để xem chi tiết)">
                <DataTable columns={columns} rows={data!.top20.map((r, i) => ({ ...r, stt: i + 1 }))}
                  rowKey={(r, i) => r.content_code + i}
                  onRowClick={openContent}
                  empty="Không có content Duy trì trong kỳ" maxHeight={460} />
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title="Top Biên tập theo tuổi thọ TB">
                <AvgBars items={data!.byEditorAvg.slice(0, 10).map((x) => ({ label: editorLabel(x.key), avgAge: x.avgAge, count: x.count }))} />
              </ChartCard>
              <ChartCard title="Top Nhân viên Ads theo tuổi thọ TB">
                <AvgBars items={data!.byAssigneeAvg.map((x) => ({ label: x.assignee, avgAge: x.avgAge, count: x.count }))} />
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <ChartCard title="So sánh tuổi thọ TB: Nội Địa vs Quốc Tế" className="lg:col-span-2">
                <div className="flex flex-col gap-[9px]">
                  {data!.byMarketAvg.map((m) => {
                    const max = Math.max(...data!.byMarketAvg.map((x) => x.avgAge), 1);
                    return (
                      <div key={m.market} className="flex items-center gap-[10px]">
                        <span className="w-[70px] shrink-0 text-[13px] text-muted">{m.label}</span>
                        <div className="h-[18px] flex-1 overflow-hidden rounded-[5px] bg-surface2"><div className="h-full rounded-[5px]" style={{ width: `${(m.avgAge / max) * 100}%`, background: MK_COLOR[m.market] }} /></div>
                        <span className="w-[52px] text-right font-semibold tabular-nums text-fg">{m.avgAge}d</span>
                      </div>
                    );
                  })}
                </div>
              </ChartCard>
              <ContentCard title="Phân bố vòng đời">
                <div className="flex flex-col gap-2">
                  {dist5.map((d) => (
                    <div key={d.label} className="flex items-center gap-2 text-[12px]">
                      <span className="w-[84px] shrink-0 text-muted">{d.label}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-sm bg-surface2"><div className="h-full bg-accent" style={{ width: `${(d.count / distMax) * 100}%` }} /></div>
                      <b className="w-7 text-right tabular-nums">{d.count}</b>
                    </div>
                  ))}
                </div>
              </ContentCard>
            </div>
          </>
        )}
      </PageContainer>

      {selected && <DetailDrawer item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
