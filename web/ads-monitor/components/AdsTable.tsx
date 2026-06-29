/* Ads Monitor — bảng dữ liệu (PHASE 5). Sticky header + phân trang SERVER-SIDE + sort + badge màu.
 * rows = ĐÚNG 1 trang từ API (đã filter/sort/paginate ở SQL). KHÔNG slice/sort/filter ở client. */
import type { AdsItem, AdsStatus } from '../types/ads';
import { MARKET_LABEL, formatVND, formatDateTime } from '../utils/format';

const STATUS_STYLE: Record<AdsStatus, { dot: string; color: string }> = {
  'Đã tắt': { dot: '🔴', color: '#f87171' },
  'Mới chạy': { dot: '🟡', color: '#fbbf24' },
  'Đang test': { dot: '🟠', color: '#fb923c' },
  'Đang duy trì': { dot: '🟢', color: '#34d399' },
};

function StatusBadge({ status }: { status: AdsStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[12px] font-medium"
      style={{ background: `${s.color}1f`, color: s.color }}>
      <span>{s.dot}</span>{status}
    </span>
  );
}

// sortKey = cột sort phía server (null = không sort được, vd STT/Trạng thái vì status không lưu).
const COLS: { label: string; align?: 'right'; sortKey?: string }[] = [
  { label: 'STT', align: 'right' },
  { label: 'Content', sortKey: 'content' },
  { label: 'Địa lý', sortKey: 'location' },
  { label: 'Nhân viên Ads', sortKey: 'ads_owner' },
  { label: 'Mã Page', sortKey: 'page_code' },
  { label: 'Amount Spent', align: 'right', sortKey: 'amount_spent' },
  { label: 'Trạng thái' },
  { label: 'Cập nhật', sortKey: 'updated_at' },
];

export function AdsTable({
  rows, total, page, pageSize, totalPages, sortField, sortDir, onPageChange, onSort,
}: {
  rows: AdsItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sortField: string;
  sortDir: 'asc' | 'desc';
  onPageChange: (page: number) => void;
  onSort: (field: string) => void;
}) {
  const td = 'border-b border-line px-[10px] py-2 align-middle';
  const arrow = (key?: string) => (key && key === sortField ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  return (
    <div>
      <div className="overflow-auto rounded-card border border-line" style={{ maxHeight: '60vh' }}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.label}
                  onClick={c.sortKey ? () => onSort(c.sortKey!) : undefined}
                  className={`sticky top-0 z-10 border-b border-line bg-surface px-[10px] py-2 text-xs font-semibold text-muted ${c.align === 'right' ? 'text-right' : 'text-left'} ${c.sortKey ? 'cursor-pointer select-none hover:text-fg' : ''}`}>
                  {c.label}{arrow(c.sortKey)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={COLS.length} className="px-3 py-8 text-center text-muted">Không có dữ liệu</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.id} className="hover:bg-surface2">
                <td className={`${td} text-right tabular-nums text-muted`}>{(page - 1) * pageSize + i + 1}</td>
                <td className={`${td} max-w-[260px] truncate`}>{r.content}</td>
                <td className={td}>{MARKET_LABEL[r.location] ?? r.location}</td>
                <td className={td}>{r.ads_owner}</td>
                <td className={`${td} font-mono text-xs`}>{r.page_code}</td>
                <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{formatVND(r.amount_spent)}</td>
                <td className={td}><StatusBadge status={r.status} /></td>
                <td className={`${td} whitespace-nowrap text-muted`}>{formatDateTime(r.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-end gap-3 text-[13px] text-muted">
        <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}
          className="rounded-control px-3 py-1 hover:bg-surface2 disabled:opacity-40">← Trước</button>
        <span>Trang {page}/{totalPages} · {total} dòng</span>
        <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}
          className="rounded-control px-3 py-1 hover:bg-surface2 disabled:opacity-40">Sau →</button>
      </div>
    </div>
  );
}
