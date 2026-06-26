import { useEffect, useMemo, useState } from 'react';
import {
  PageContainer, SearchBox, ActionButton, StatusBadge,
  EmptyState, LoadingSkeleton,
  type DateRangeValue,
} from '../src/components/ui';
import { GlobalFilter } from './GlobalFilter';
import { editorLabel } from './editor-name';

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
const todayMs = (() => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); })();
const liveDays = (iso?: string | null): number | null => {
  if (!iso) return null; const t = Date.parse(iso + 'T00:00:00Z'); if (isNaN(t)) return null;
  return Math.max(0, Math.floor((todayMs - t) / 86400000));
};
export interface Item {
  content_code: string; title: string; editor_name: string; assignee_name: string; market: string;
  test_date_real: string | null; upload_date_real?: string | null; maintainDays: number | null;
  current_status: string; status_group: string; trello_link: string;
}

/* đọc filter ban đầu từ hash query (#/explorer?market=noi_dia&assignee=KA) — giữ filter khi drill */
function parseHashFilters() {
  const i = location.hash.indexOf('?');
  const q = new URLSearchParams(i >= 0 ? location.hash.slice(i + 1) : '');
  return {
    market: q.get('market') || 'ALL',
    assignee: q.get('assignee') || 'ALL',
    status: q.get('status') || 'ALL',
    editor: q.get('editor') || 'ALL',
    search: q.get('q') || '',
    preset: q.get('preset') || 'thismonth',
  };
}

/* ---------- Drawer chi tiết (tái dùng cho các dashboard khác) ---------- */
export function DetailDrawer({ item, onClose }: { item: Item; onClose: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  useEffect(() => {
    const p = new URLSearchParams({ code: item.content_code, market: item.market, assignee: item.assignee_name });
    fetch('/api/v3/content-detail?' + p).then((r) => r.json()).then(setDetail).catch(() => setDetail({ error: 'Không tải được' }));
  }, [item]);
  const tuoiTho = liveDays(item.test_date_real);
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-[440px] overflow-y-auto border-l border-line bg-surface p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="font-mono text-[13px] text-fg">{item.content_code}</h3>
          <button onClick={onClose} className="rounded-lg px-2 text-muted hover:bg-surface2 hover:text-fg">✕</button>
        </div>
        {item.title && <p className="mb-3 text-[13px] text-muted">{item.title}</p>}

        <div className="grid grid-cols-2 gap-3 border-t border-line py-3 text-[13px]">
          <div><div className="text-[11px] text-muted">Trạng thái</div><StatusBadge value={item.status_group} label={item.current_status} /></div>
          <div><div className="text-[11px] text-muted">Thị trường</div><StatusBadge kind="market" value={item.market} /></div>
          <div><div className="text-[11px] text-muted">Nhân viên Ads</div><b className="text-fg">{item.assignee_name}</b></div>
          <div><div className="text-[11px] text-muted">Biên tập</div><b className="text-fg">{item.editor_name ? editorLabel(item.editor_name) : '—'}</b></div>
          <div><div className="text-[11px] text-muted">Tuổi thọ content</div><b className="text-fg">{tuoiTho != null ? `${tuoiTho} ngày` : '—'}</b></div>
          <div><div className="text-[11px] text-muted">Số ngày duy trì</div><b className="text-fg">{item.maintainDays != null ? `${item.maintainDays} ngày` : '—'}</b></div>
        </div>

        {item.trello_link && (
          <div className="border-t border-line py-3">
            <a href={item.trello_link} target="_blank" rel="noopener" className="text-[13px] text-accent">🔗 Mở thẻ Trello ↗</a>
          </div>
        )}

        <div className="border-t border-line py-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Timeline</div>
          {!detail ? <LoadingSkeleton variant="line" /> : detail.error ? <span className="text-[13px] text-danger">{detail.error}</span> : (
            <div className="relative pl-5">
              <div className="absolute bottom-1 left-[6px] top-1 w-px bg-line" />
              {detail.timeline.map((t: any, i: number) => (
                <div key={i} className="relative mb-3">
                  <span className="absolute -left-[14px] top-1 h-3 w-3 rounded-full border-2 border-bg bg-accent" />
                  <div className="text-[13px] font-medium text-fg">{t.label}</div>
                  <div className="text-[11px] text-muted">{t.date || '— chưa có ngày'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-line py-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Lịch sử thay đổi trạng thái</div>
          {detail?.source === 'history' && detail?.history?.length
            ? <ul className="space-y-1 text-[13px]">{detail.history.map((h: any, i: number) => <li key={i}>{(h.changed_at || '').slice(0, 10)} · {h.status}</li>)}</ul>
            : <span className="text-[13px] text-muted">Chưa có lịch sử (sẽ hiện khi content_status_history được ghi).</span>}
        </div>
      </aside>
    </>
  );
}

/* ============ Page ============ */
type SortKey = 'content_code' | 'title' | 'editor_name' | 'assignee_name' | 'market' | 'test_date_real' | 'maintainDays' | 'current_status';
const COLS: { key: SortKey; label: string; sticky?: boolean; align?: 'right' }[] = [
  { key: 'content_code', label: 'Mã Content', sticky: true },
  { key: 'title', label: 'Tiêu đề' },
  { key: 'editor_name', label: 'Biên tập' },
  { key: 'assignee_name', label: 'Nhân viên Ads' },
  { key: 'market', label: 'Thị trường' },
  { key: 'test_date_real', label: 'Ngày Test' },
  { key: 'maintainDays', label: 'Số ngày duy trì', align: 'right' },
  { key: 'current_status', label: 'Trạng thái' },
];

export function ExplorerPage() {
  const init = useMemo(parseHashFilters, []);
  const [range, setRange] = useState<DateRangeValue>({ preset: init.preset as any });
  const [market, setMarket] = useState(init.market);
  const [assignee, setAssignee] = useState(init.assignee);
  const [status, setStatus] = useState(init.status);
  const [editor, setEditor] = useState(init.editor);
  const [search, setSearch] = useState(init.search);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'test_date_real', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<Item | null>(null);

  const period = range.preset === 'custom' ? { from: range.from, to: range.to } : presetRange(range.preset);
  const serverQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (period.from) p.set('from', period.from); if (period.to) p.set('to', period.to);
    if (market !== 'ALL') p.set('market', market);
    if (assignee !== 'ALL') p.set('assignee', assignee);
    if (status !== 'ALL') p.set('status', status);
    return p.toString();
  }, [period.from, period.to, market, assignee, status]);

  useEffect(() => {
    let alive = true; setLoading(true);
    fetch('/api/v3/lifecycle-table?' + serverQuery + (refreshKey ? `&_=${refreshKey}` : ''))
      .then((r) => r.json())
      .then((d) => { if (!alive) return; if (d.error) throw new Error(d.error); setRows(d.items); setError(null); })
      .catch((e) => alive && setError(e.message)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [serverQuery, refreshKey]);

  // lọc client: search + editor (editor='ALL' nghĩa là không lọc — so khớp giá trị editor_name gốc)
  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      (!q || r.content_code.toLowerCase().includes(q) || (r.title || '').toLowerCase().includes(q)) &&
      (editor === 'ALL' || (r.editor_name || '') === editor));
  }, [rows, search, editor]);

  const sorted = useMemo(() => {
    const s = sort.dir === 'desc' ? -1 : 1;
    return [...filtered].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      if (sort.key === 'maintainDays') return (((x as number) ?? -1) - ((y as number) ?? -1)) * s;
      return String(x ?? '').localeCompare(String(y ?? '')) * s;
    });
  }, [filtered, sort]);

  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [serverQuery, search, editor, sort]);

  const onSort = (key: SortKey) => setSort((s) => s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' });
  const reset = () => { setRange({ preset: 'thismonth' }); setMarket('ALL'); setAssignee('ALL'); setStatus('ALL'); setEditor('ALL'); setSearch(''); };

  const exportCsv = () => {
    const head = ['content_code', 'title', 'editor', 'assignee', 'market', 'test_date', 'maintain_days', 'status', 'trello'];
    const cell = (v: any) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [head.join(',')];
    for (const r of sorted) lines.push([r.content_code, r.title, editorLabel(r.editor_name), r.assignee_name, r.market, r.test_date_real || '', r.maintainDays ?? '', r.current_status, r.trello_link].map(cell).join(','));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'content_explorer.csv';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  };

  const arrow = (k: SortKey) => sort.key === k ? (sort.dir === 'desc' ? ' ▼' : ' ▲') : '';
  // class cho ô sticky cột Mã Content (theo trạng thái header/hover)
  const stickyHead = 'sticky left-0 top-0 z-30 bg-surface';
  const stickyCell = 'sticky left-0 z-10 bg-surface group-hover:bg-surface2';

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
        onReset={reset}
        right={
          <div className="flex items-end gap-2">
            <SearchBox value={search} onChange={setSearch} placeholder="Tìm mã / tiêu đề…" className="w-[200px]" />
            <ActionButton variant="ghost" onClick={exportCsv} icon={<span>⬇</span>}>Excel</ActionButton>
            <ActionButton variant="ghost" onClick={() => setRefreshKey((k) => k + 1)} icon={<span>⟳</span>}>Refresh</ActionButton>
          </div>
        }
      />

      <PageContainer>
        {error ? <EmptyState icon="⚠️" message={`Lỗi: ${error}`} />
          : loading && !rows ? <LoadingSkeleton variant="table" count={10} />
          : (
          <>
            <div className="mb-2 text-[13px] text-muted">{sorted.length} content · trang {page}/{totalPages}</div>
            <div className="overflow-auto rounded-card border border-line" style={{ maxHeight: '70vh' }}>
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    {COLS.map((c) => (
                      <th key={c.key} onClick={() => onSort(c.key)}
                        className={`cursor-pointer select-none border-b border-line px-[9px] py-2 text-xs font-semibold text-muted hover:text-fg ${c.align === 'right' ? 'text-right' : 'text-left'} ${c.sticky ? stickyHead : 'sticky top-0 z-20 bg-surface'}`}>
                        {c.label}{arrow(c.key)}
                      </th>
                    ))}
                    <th className="sticky top-0 z-20 border-b border-line bg-surface px-[9px] py-2 text-left text-xs font-semibold text-muted">Trello</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr><td colSpan={COLS.length + 1} className="px-3 py-8 text-center text-muted">Không có content khớp bộ lọc</td></tr>
                  ) : pageRows.map((r, i) => (
                    <tr key={r.content_code + i} onClick={() => setSelected(r)} className="group cursor-pointer border-b border-line hover:bg-surface2">
                      <td className={`whitespace-nowrap px-[9px] py-2 font-mono text-xs ${stickyCell}`}>{r.content_code}</td>
                      <td className="max-w-[240px] truncate px-[9px] py-2">{r.title || <span className="text-muted">—</span>}</td>
                      <td className="px-[9px] py-2">{r.editor_name ? editorLabel(r.editor_name) : <span className="text-muted">—</span>}</td>
                      <td className="px-[9px] py-2">{r.assignee_name}</td>
                      <td className="px-[9px] py-2"><StatusBadge kind="market" value={r.market} /></td>
                      <td className="whitespace-nowrap px-[9px] py-2">{r.test_date_real || <span className="text-muted">—</span>}</td>
                      <td className="px-[9px] py-2 text-right tabular-nums">{r.maintainDays ?? <span className="text-muted">—</span>}</td>
                      <td className="px-[9px] py-2"><StatusBadge value={r.status_group} label={r.current_status} /></td>
                      <td className="px-[9px] py-2">{r.trello_link ? <a href={r.trello_link} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="text-accent">🔗</a> : <span className="text-muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-end gap-3 text-[13px] text-muted">
              <ActionButton variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Trước</ActionButton>
              <span>Trang {page}/{totalPages}</span>
              <ActionButton variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Sau →</ActionButton>
            </div>
          </>
        )}
      </PageContainer>

      {selected && <DetailDrawer item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
