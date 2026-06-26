import { useEffect, useMemo, useState } from 'react';
import { StatusBadge, EmptyState, LoadingSkeleton } from '../src/components/ui';
import { editorLabel } from './editor-name';

/* ============================================================
 * AlertDrawer — Drill-down danh sách content của 1 nhóm "Cần xử lý".
 * Tái dùng API /api/v3/contents?alert=<key> (đã có sẵn). Drawer có
 * ĐÚNG 2 bộ lọc: Nhân viên Ads + Địa lý — kế thừa filter dashboard
 * làm mặc định. KHÔNG đổi API/DB/logic — chỉ thêm UI.
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
const ASSIGNEES = ['Hiếu', 'Ánh', 'KA', 'Liên'];
const todayMs = (() => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); })();
function liveDays(iso: string | null): number | null {
  if (!iso) return null; const t = Date.parse(iso + 'T00:00:00Z'); if (isNaN(t)) return null;
  return Math.max(0, Math.floor((todayMs - t) / 86400000));
}

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

const ctrl = 'h-9 rounded-control border border-line bg-surface px-2 text-[13px] text-fg focus:border-accent focus:outline-none';

export function AlertDrawer({ alert, filters, onClose }: { alert: AlertDef; filters: AlertFilters; onClose: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 2 bộ lọc của Drawer — mặc định kế thừa filter hiện tại của Dashboard
  const [dMarket, setDMarket] = useState(filters.market);
  const [dAssignee, setDAssignee] = useState(filters.assignee);

  // Query server: from/to + status + alert (giống định nghĩa card).
  // Market/Assignee/Editor lọc client-side để 2 dropdown trong Drawer phản hồi tức thì.
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.from) p.set('from', filters.from);
    if (filters.to) p.set('to', filters.to);
    if (filters.status !== 'ALL') p.set('status', filters.status);
    p.set('alert', alert.key);
    return p.toString();
  }, [filters.from, filters.to, filters.status, alert.key]);

  useEffect(() => {
    let alive = true; setLoading(true);
    fetchAllContents(qs)
      .then((items) => { if (alive) { setRows(items); setError(null); } })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [qs]);

  // Áp 2 bộ lọc Drawer + editor (kế thừa) lên dữ liệu
  const list = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) =>
      (filters.editor === 'ALL' || (r.editor_name || '') === filters.editor) &&
      (dMarket === 'ALL' || r.market === dMarket) &&
      (dAssignee === 'ALL' || r.assignee_name === dAssignee));
  }, [rows, filters.editor, dMarket, dAssignee]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[600px] flex-col border-l border-line bg-bg shadow-2xl">
        {/* Header — accent màu theo mức độ */}
        <div className="border-b-2 px-4 py-3" style={{ borderColor: alert.color, background: `${alert.color}14` }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[15px] font-bold" style={{ color: alert.color }}>{alert.label}</div>
              <div className="text-[12px] text-muted">Có <b className="text-fg">{list.length}</b> content (theo bộ lọc hiện tại)</div>
            </div>
            <button onClick={onClose} className="rounded-lg px-2 text-muted hover:bg-surface2 hover:text-fg">✕</button>
          </div>
          {/* 2 bộ lọc: Nhân viên Ads + Địa lý */}
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-[11px] text-muted">Nhân viên Ads
              <select className={ctrl + ' mt-0.5'} value={dAssignee} onChange={(e) => setDAssignee(e.target.value)}>
                <option value="ALL">Tất cả</option>
                {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label className="flex flex-col text-[11px] text-muted">Địa lý
              <select className={ctrl + ' mt-0.5'} value={dMarket} onChange={(e) => setDMarket(e.target.value)}>
                <option value="ALL">Tất cả</option>
                <option value="noi_dia">Nội Địa</option>
                <option value="quoc_te">Quốc Tế</option>
              </select>
            </label>
          </div>
        </div>

        {/* Danh sách */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {error ? <EmptyState icon="⚠️" message={`Lỗi: ${error}`} />
            : loading && !rows ? <LoadingSkeleton variant="table" count={6} />
            : list.length === 0 ? <EmptyState message="Không có content khớp bộ lọc" />
            : (
            <div className="flex flex-col gap-2">
              {list.map((r, i) => {
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
                      <div><div className="text-[10px] text-muted">Số ngày đã chạy</div><b className="text-fg">{days != null ? `${days} ngày` : '—'}</b></div>
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
