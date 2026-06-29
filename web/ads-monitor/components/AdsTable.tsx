/* Ads Monitor — bảng dữ liệu (PHASE 2). Sticky header + phân trang + badge màu.
 * Trạng thái tính bằng computeStatus(amountSpent) — không lưu cứng. */
import { useState } from 'react';
import type { AdsRow, AdsStatus } from '../types/ads';
import { MARKET_LABEL, computeStatus, formatVND, formatDateTime } from '../utils/format';

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

const COLS: { label: string; align?: 'right' }[] = [
  { label: 'STT', align: 'right' }, { label: 'Content' }, { label: 'Địa lý' },
  { label: 'Nhân viên Ads' }, { label: 'Mã Page' }, { label: 'Amount Spent', align: 'right' },
  { label: 'Trạng thái' }, { label: 'Cập nhật' },
];
const PAGE_SIZE = 10;

export function AdsTable({ rows }: { rows: AdsRow[] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const td = 'border-b border-line px-[10px] py-2 align-middle';

  return (
    <div>
      <div className="overflow-auto rounded-card border border-line" style={{ maxHeight: '60vh' }}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.label}
                  className={`sticky top-0 z-10 border-b border-line bg-surface px-[10px] py-2 text-xs font-semibold text-muted ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => (
              <tr key={r.id} className="hover:bg-surface2">
                <td className={`${td} text-right tabular-nums text-muted`}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                <td className={`${td} max-w-[260px] truncate`}>{r.content}</td>
                <td className={td}>{MARKET_LABEL[r.market]}</td>
                <td className={td}>{r.assignee}</td>
                <td className={`${td} font-mono text-xs`}>{r.pageCode}</td>
                <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{formatVND(r.amountSpent)}</td>
                <td className={td}><StatusBadge status={computeStatus(r.amountSpent)} /></td>
                <td className={`${td} whitespace-nowrap text-muted`}>{formatDateTime(r.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-end gap-3 text-[13px] text-muted">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
          className="rounded-control px-3 py-1 hover:bg-surface2 disabled:opacity-40">← Trước</button>
        <span>Trang {page}/{totalPages} · {rows.length} dòng</span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
          className="rounded-control px-3 py-1 hover:bg-surface2 disabled:opacity-40">Sau →</button>
      </div>
    </div>
  );
}
