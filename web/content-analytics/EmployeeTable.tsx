import { DataTable, type Column } from '../../src/components/ui';
import type { ByEmployeeItem } from './contentAnalyticsApi';
import { fmtNum, fmtPct } from './format';

/** Bảng Nhân viên — group theo account_name (KHÔNG chuẩn hóa/gộp tên, hiển thị nguyên giá trị). */
export function EmployeeTable({ rows }: { rows: ByEmployeeItem[] }) {
  const columns: Column<ByEmployeeItem>[] = [
    { key: 'employee', header: 'Nhân viên', render: (r) => <span className="text-[13px] text-fg">{r.employee}</span> },
    { key: 'dataNew', header: 'Data mới', align: 'right', render: (r) => <span className="tabular-nums text-success">{fmtNum(r.dataNew)}</span> },
    { key: 'dataOld', header: 'Data cũ', align: 'right', render: (r) => <span className="tabular-nums text-muted">{fmtNum(r.dataOld)}</span> },
    { key: 'dataTotal', header: 'Tổng data', align: 'right', sortable: true, render: (r) => <b className="tabular-nums">{fmtNum(r.dataTotal)}</b> },
    { key: 'pctNew', header: '% mới', align: 'right', render: (r) => <span className="tabular-nums text-success">{fmtPct(r.pctNew)}</span> },
    { key: 'pctOld', header: '% cũ', align: 'right', render: (r) => <span className="tabular-nums text-muted">{fmtPct(r.pctOld)}</span> },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.employee}
      empty="Không có Nhân viên nào khớp bộ lọc trong tháng này."
      maxHeight={420}
    />
  );
}
