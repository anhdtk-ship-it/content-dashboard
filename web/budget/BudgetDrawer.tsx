/* FB-ADS-02 — Drawer drill-down: danh sách Content của 1 nhóm (đã có sẵn client-side, KHÔNG query lại). */
import { DataTable, type Column } from '../../src/components/ui';
import { fmtVND, MARKET_LABEL } from './format';
import type { EnrichedRow } from './selectors';

export function BudgetDrawer({ title, rows, onClose }: { title: string; rows: EnrichedRow[]; onClose: () => void }) {
  const sorted = [...rows].sort((a, b) => b.amount_spent - a.amount_spent);
  const total = sorted.reduce((s, r) => s + r.amount_spent, 0);
  const columns: Column<EnrichedRow>[] = [
    { key: 'content', header: 'Tên Content', render: (r) => <span className="text-[12px]">{r.content || '—'}</span> },
    { key: 'page_code', header: 'Ads (Trang)', render: (r) => <span className="font-mono text-[11px] text-muted">{r.page_code || '—'}</span> },
    { key: 'amount_spent', header: 'Amount Spent', align: 'right', render: (r) => <b className="tabular-nums">{fmtVND(r.amount_spent)}</b> },
    { key: 'capDate', header: 'Ngày cấp', align: 'right', render: (r) => (r.capDate ? r.capDate.split('-').reverse().join('/') : '—') },
    { key: 'status', header: 'Trạng thái' },
    { key: 'location', header: 'Thị trường', render: (r) => MARKET_LABEL[r.location] ?? r.location ?? '—' },
    { key: 'ads_owner', header: 'Nhân viên' },
  ];
  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="flex h-full w-full max-w-[900px] flex-col border-l border-line bg-bg shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-fg">{title}</div>
            <div className="text-xs text-muted">{sorted.length} content · {fmtVND(total)}</div>
          </div>
          <button onClick={onClose} className="rounded-control px-2 py-1 text-sm text-muted hover:bg-surface hover:text-fg">✕</button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <DataTable columns={columns} rows={sorted} rowKey={(r) => r.id} maxHeight={9999} empty="Không có content trong nhóm này" />
        </div>
      </div>
    </div>
  );
}
