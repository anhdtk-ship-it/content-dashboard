import { useEffect, useMemo, useState } from 'react';
import { SectionHeader, LoadingSkeleton, EmptyState } from '../src/components/ui';

/* ============================================================
 * So sánh tiến độ sử dụng Content — Tháng này vs Tháng trước.
 * Dùng lại API /api/v3/lifecycle-table (lọc theo Ngày Up Trello =
 * upload_date_real, mặc định của API). Đếm client-side theo ĐÚNG
 * định nghĩa nghiệp vụ hiện có — KHÔNG đổi API/logic/DB.
 * ========================================================== */

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function monthRange(offset: number): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: ymd(first), to: ymd(last) };
}

interface Row { current_status: string; status_group: string; market: string; assignee_name: string; editor_name: string; }
interface Counts { capped: number; tested: number; duyTri: number; daTat: number; khongDuyet: number; }

function countMetrics(items: Row[], editor: string): Counts {
  const rows = editor === 'ALL' ? items : items.filter((r) => (r.editor_name || '') === editor);
  let tested = 0, duyTri = 0, daTat = 0, khongDuyet = 0;
  for (const r of rows) {
    const s = (r.current_status || '').trim();
    const isDuyTri = s.startsWith('Duy trì');
    if (isDuyTri) duyTri++;
    if (s === 'Đã chạy-Tắt') daTat++;
    if (s === 'Không được duyệt') khongDuyet++;
    if (isDuyTri || s === 'Đang test' || s === 'Đã test-ko chạy' || s === 'Đã chạy-Tắt') tested++;
  }
  return { capped: rows.length, tested, duyTri, daTat, khongDuyet };
}

const METRICS: { key: keyof Counts; label: string }[] = [
  { key: 'capped', label: 'Content được cấp' },
  { key: 'tested', label: 'Đã test' },
  { key: 'duyTri', label: 'Đang duy trì' },
  { key: 'daTat', label: 'Đã tắt' },
  { key: 'khongDuyet', label: 'Không duyệt' },
];

function Delta({ now, prev }: { now: number; prev: number }) {
  if (prev === 0) {
    const up = now > 0;
    return <span className={`text-[12px] font-semibold ${up ? 'text-success' : 'text-muted'}`}>{up ? '▲ mới' : '—'}</span>;
  }
  const diff = now - prev;
  const pct = Math.round((diff / prev) * 100);
  if (diff === 0) return <span className="text-[12px] font-semibold text-muted">▬ 0%</span>;
  const up = diff > 0;
  return <span className={`text-[12px] font-semibold ${up ? 'text-success' : 'text-danger'}`}>{up ? '▲' : '▼'} {Math.abs(pct)}%</span>;
}

export function UsageCompare({ market, assignee, editor }: { market: string; assignee: string; editor: string }) {
  const [cur, setCur] = useState<Counts | null>(null);
  const [prev, setPrev] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKey = `${market}|${assignee}|${editor}`;
  const build = (r: { from: string; to: string }) => {
    const p = new URLSearchParams({ from: r.from, to: r.to });
    if (market !== 'ALL') p.set('market', market);
    if (assignee !== 'ALL') p.set('assignee', assignee);
    return p.toString();
  };

  useEffect(() => {
    let alive = true; setLoading(true);
    Promise.all([
      fetch('/api/v3/lifecycle-table?' + build(monthRange(0))).then((r) => r.json()),
      fetch('/api/v3/lifecycle-table?' + build(monthRange(-1))).then((r) => r.json()),
    ])
      .then(([a, b]) => {
        if (!alive) return;
        if (a.error || b.error) throw new Error(a.error || b.error);
        setCur(countMetrics(a.items ?? [], editor));
        setPrev(countMetrics(b.items ?? [], editor));
        setError(null);
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [fetchKey]);

  const ready = useMemo(() => cur && prev, [cur, prev]);

  return (
    <div className="mt-4">
      <SectionHeader title="So sánh tiến độ sử dụng Content" action={<span className="text-xs text-muted">Tháng này vs Tháng trước · theo Ngày Up Trello</span>} />
      {error ? <EmptyState icon="⚠️" message={`Lỗi: ${error}`} />
        : loading && !ready ? <LoadingSkeleton variant="kpi" count={5} />
        : !ready ? <EmptyState message="Không có dữ liệu" />
        : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {METRICS.map((m) => {
            const now = cur![m.key], pv = prev![m.key];
            return (
              <div key={m.key} className="rounded-card border border-line bg-surface p-3">
                <div className="text-[12px] text-muted">{m.label}</div>
                <div className="mt-0.5 flex items-end justify-between gap-2">
                  <span className="text-[24px] font-bold tabular-nums text-fg">{now}</span>
                  <Delta now={now} prev={pv} />
                </div>
                <div className="text-[11px] text-muted">Tháng trước: <b className="text-fg">{pv}</b></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
