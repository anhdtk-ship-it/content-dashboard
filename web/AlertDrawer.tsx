import { useEffect, useMemo, useState } from 'react';
import { ActionButton, SearchBox, StatusBadge, EmptyState, LoadingSkeleton } from '../src/components/ui';
import { editorLabel } from './editor-name';

/* ============================================================
 * AlertDrawer — Drill-down danh sách content của 1 nhóm "Cần xử lý".
 * Tái dùng API /api/v3/contents?alert=<key> (đã có sẵn) + giữ filter
 * hiện tại của Dashboard. KHÔNG đổi API/DB/logic — chỉ thêm UI.
 * ========================================================== */

export interface AlertFilters {
  from?: string; to?: string; market: string; assignee: string; status: string; editor: string;
}
export interface AlertDef { key: string; label: string; color: string; }

interface Row {
  content_code: string; title: string; market: string; assignee_name: string; editor_name: string;
  current_status: string; status_group: string;
  upload_date: string; upload_date_real: string | null;
  test_date: string; test_date_real: string | null; trello_link: string;
}

const MK_LABEL: Record<string, string> = { noi_dia: 'Nội Địa', quoc_te: 'Quốc Tế' };
const todayMs = (() => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); })();
function liveDays(iso: string | null): number | null {
  if (!iso) return null; const t = Date.parse(iso + 'T00:00:00Z'); if (isNaN(t)) return null;
  return Math.max(0, Math.floor((todayMs - t) / 86400000));
}

const SORTS: [string, string][] = [
  ['test_desc', 'Ngày Test (mới nhất)'],
  ['upload_desc', 'Ngày Upload (mới nhất)'],
  ['days_desc', 'Số ngày chạy (nhiều nhất)'],
  ['az', 'ID A → Z'],
  ['za', 'ID Z → A'],
];

/** Lấy toàn bộ content của nhóm (lặp trang vì pageSize tối đa 100). */
async function fetchAllContents(qs: string): Promise<Row[]> {
  const out: Row[] = [];
  let page = 1, totalPages = 1;
  do {
    const r = await fetch(`/api/v3/contents?${qs}&pageSize=100&page=${page}`);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    out.push(...(d.items ?? []));
    totalPages = d.totalPages ?? 1;
    page++;
  } while (page <= totalPages);
  return out;
}

function Badge({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill border border-line bg-surface2 px-2 py-0.5 text-[11px] text-fg">
      <span className="text-muted">{label}</span>
      <b className="tabular-nums" style={color ? { color } : undefined}>{value}</b>
    </span>
  );
}

export function AlertDrawer({ alert, filters, onClose }: { alert: AlertDef; filters: AlertFilters; onClose: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('test_desc');

  // Query server: from/to/market/assignee/status + alert (giống định nghĩa card). Editor lọc client-side.
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.from) p.set('from', filters.from);
    if (filters.to) p.set('to', filters.to);
    if (filters.market !== 'ALL') p.set('market', filters.market);
    if (filters.assignee !== 'ALL') p.set('assignee', filters.assignee);
    if (filters.status !== 'ALL') p.set('status', filters.status);
    p.set('alert', alert.key);
    return p.toString();
  }, [filters, alert.key]);

  useEffect(() => {
    let alive = true; setLoading(true);
    fetchAllContents(qs)
      .then((items) => { if (alive) { setRows(items); setError(null); } })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [qs]);

  // Nhóm theo filter hiện tại (editor lọc client-side để khớp "toàn bộ filter")
  const group = useMemo(() => {
    if (!rows) return [];
    return filters.editor === 'ALL' ? rows : rows.filter((r) => (r.editor_name || '') === filters.editor);
  }, [rows, filters.editor]);

  // Thống kê đầu Drawer
  const stats = useMemo(() => {
    const by = (sel: (r: Row) => string) => {
      const m = new Map<string, number>();
      for (const r of group) { const k = sel(r) || '(trống)'; m.set(k, (m.get(k) ?? 0) + 1); }
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    return { assignee: by((r) => r.assignee_name), market: by((r) => MK_LABEL[r.market] ?? r.market), editor: by((r) => editorLabel(r.editor_name)) };
  }, [group]);

  // Tìm kiếm realtime + sort
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q ? group.filter((r) => r.content_code.toLowerCase().includes(q) || (r.title || '').toLowerCase().includes(q)) : group;
    const cmpStr = (a?: string | null, b?: string | null) => String(a ?? '').localeCompare(String(b ?? ''));
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'test_desc': return cmpStr(b.test_date_real, a.test_date_real);
        case 'upload_desc': return cmpStr(b.upload_date_real, a.upload_date_real);
        case 'days_desc': return ((liveDays(b.test_date_real) ?? -1) - (liveDays(a.test_date_real) ?? -1));
        case 'az': return cmpStr(a.content_code, b.content_code);
        case 'za': return cmpStr(b.content_code, a.content_code);
        default: return 0;
      }
    });
    return list;
  }, [group, search, sort]);

  const exportCsv = () => {
    const head = ['ID Content', 'Tiêu đề', 'Trạng thái', 'Địa lý', 'Nhân viên Ads', 'Biên tập', 'Ngày Upload', 'Ngày Test', 'Số ngày chạy'];
    const cell = (v: any) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [head.join(',')];
    for (const r of visible) lines.push([
      r.content_code, r.title, r.current_status, MK_LABEL[r.market] ?? r.market, r.assignee_name,
      editorLabel(r.editor_name), r.upload_date_real ?? '', r.test_date_real ?? '', liveDays(r.test_date_real) ?? '',
    ].map(cell).join(','));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `can-xu-ly_${alert.key}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[600px] flex-col border-l border-line bg-bg shadow-2xl">
        {/* Header + accent màu theo mức độ */}
        <div className="border-b-2 px-4 py-3" style={{ borderColor: alert.color, background: `${alert.color}14` }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[15px] font-bold" style={{ color: alert.color }}>{alert.label}</div>
              <div className="text-[12px] text-muted">Có <b className="text-fg">{group.length}</b> content (theo bộ lọc hiện tại)</div>
            </div>
            <button onClick={onClose} className="rounded-lg px-2 text-muted hover:bg-surface2 hover:text-fg">✕</button>
          </div>
          {/* Thống kê dạng badge */}
          {group.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="flex flex-wrap gap-1.5">{stats.assignee.map(([k, v]) => <Badge key={'a' + k} label={k} value={v} />)}</div>
              <div className="flex flex-wrap gap-1.5">{stats.market.map(([k, v]) => <Badge key={'m' + k} label={k} value={v} />)}</div>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] text-muted">Biên tập:</span>
                {stats.editor.map(([k, v]) => <Badge key={'e' + k} label={k} value={v} color={alert.color} />)}
              </div>
            </div>
          )}
        </div>

        {/* Toolbar: search + sort + export */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
          <SearchBox value={search} onChange={setSearch} placeholder="Tìm ID / tiêu đề…" className="w-[180px]" />
          <select value={sort} onChange={(e) => setSort(e.target.value)}
            className="h-9 rounded-control border border-line bg-surface px-2 text-[13px] text-fg focus:border-accent focus:outline-none">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <ActionButton variant="ghost" onClick={exportCsv} icon={<span>⬇</span>}>Excel</ActionButton>
          <span className="ml-auto text-[12px] text-muted">{visible.length} hiển thị</span>
        </div>

        {/* Danh sách */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {error ? <EmptyState icon="⚠️" message={`Lỗi: ${error}`} />
            : loading && !rows ? <LoadingSkeleton variant="table" count={6} />
            : visible.length === 0 ? <EmptyState message="Không có content khớp" />
            : (
            <div className="flex flex-col gap-2">
              {visible.map((r, i) => {
                const days = liveDays(r.test_date_real);
                return (
                  <div key={r.content_code + i} className="rounded-card border border-line bg-surface p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-fg">
                        {r.trello_link
                          ? <a href={r.trello_link} target="_blank" rel="noopener" className="text-accent">{r.content_code}</a>
                          : r.content_code}
                      </span>
                      <StatusBadge value={r.status_group} label={r.current_status} />
                    </div>
                    {r.title && <div className="mt-1 truncate text-[13px] text-muted">{r.title}</div>}
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
                      <div><div className="text-[10px] text-muted">Địa lý</div><StatusBadge kind="market" value={r.market} /></div>
                      <div><div className="text-[10px] text-muted">Nhân viên Ads</div><b className="text-fg">{r.assignee_name}</b></div>
                      <div><div className="text-[10px] text-muted">Biên tập</div><b className="text-fg">{r.editor_name ? editorLabel(r.editor_name) : '—'}</b></div>
                      <div><div className="text-[10px] text-muted">Ngày Upload</div><span className="text-fg">{r.upload_date_real ?? '—'}</span></div>
                      <div><div className="text-[10px] text-muted">Ngày Test</div><span className="text-fg">{r.test_date_real ?? '—'}</span></div>
                      <div><div className="text-[10px] text-muted">Số ngày chạy</div><b className="text-fg">{days != null ? `${days} ngày` : '—'}</b></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
