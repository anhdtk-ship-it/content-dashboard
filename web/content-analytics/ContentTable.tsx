import { DataTable, type Column } from '../../src/components/ui';
import type { ByContentItem } from './contentAnalyticsApi';
import { fmtNum, fmtPct } from './format';

/** Bảng Content — mỗi Content 1 dòng (KHÔNG phải mỗi Ad 1 dòng). KHÔNG hiển thị ad_id/campaign/
 * adset/amount_spent/impressions/reach/frequency/CTR/CPM. */
export function ContentTable({ rows }: { rows: ByContentItem[] }) {
  const columns: Column<ByContentItem>[] = [
    { key: 'content', header: 'Content', render: (r) => <span title={r.content} className="line-clamp-2 max-w-[360px] text-[13px] text-fg">{r.content}</span> },
    { key: 'employee', header: 'Nhân viên', render: (r) => <span className="text-[13px] text-muted">{r.employee}</span> },
    { key: 'firstSeen', header: 'Ngày xuất hiện đầu', align: 'center', render: (r) => <span className="tabular-nums text-[13px]">{r.firstSeen ? r.firstSeen.split('-').reverse().join('/') : '—'}</span> },
    {
      key: 'type', header: 'Loại', align: 'center',
      render: (r) => (
        <span className={`rounded-pill px-2 py-0.5 text-[11px] font-semibold ${r.type === 'new' ? 'bg-success/15 text-success' : 'bg-surface2 text-muted'}`}>
          {r.type === 'new' ? 'Mới' : 'Cũ'}
        </span>
      ),
    },
    { key: 'data', header: 'Data', align: 'right', sortable: true, render: (r) => <b className="tabular-nums">{fmtNum(r.data)}</b> },
    { key: 'pctOfTotal', header: '% đóng góp', align: 'right', render: (r) => <span className="tabular-nums text-muted">{fmtPct(r.pctOfTotal)}</span> },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.content}
      empty="Không có Content nào khớp bộ lọc trong tháng này."
      maxHeight={520}
    />
  );
}
