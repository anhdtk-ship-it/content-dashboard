import { DataTable, type Column } from '../../src/components/ui';
import type { ByEmployeeItem } from './contentAnalyticsApi';
import { fmtNum, fmtPct } from './format';

const TOTAL_LABEL = 'TỔNG';

/** Cộng dòng "TỔNG" cuối bảng để đối chiếu trực tiếp với KPI "Tổng Data" phía trên (PHASE 04). */
function withTotalRow(rows: ByEmployeeItem[]): ByEmployeeItem[] {
  if (!rows.length) return rows;
  const dataNew = rows.reduce((s, r) => s + r.dataNew, 0);
  const dataOld = rows.reduce((s, r) => s + r.dataOld, 0);
  const dataTotal = dataNew + dataOld;
  const total: ByEmployeeItem = {
    employee: TOTAL_LABEL, dataNew, dataOld, dataTotal,
    pctNew: dataTotal > 0 ? Math.round((dataNew / dataTotal) * 1000) / 10 : 0,
    pctOld: dataTotal > 0 ? Math.round((dataOld / dataTotal) * 1000) / 10 : 0,
  };
  return [...rows, total];
}

/**
 * Bảng Nhân viên (PHASE 04) — CHỈ 4 nhân viên thật KA/Hiếu/Ánh/Liên theo thứ tự cố định
 * (backend đã đảm bảo), cộng dòng "Không xác định" nếu có account_name không khớp, + dòng
 * TỔNG cuối bảng để đối chiếu KPI. KHÔNG hiển thị account_name kỹ thuật gốc.
 */
export function EmployeeTable({ rows }: { rows: ByEmployeeItem[] }) {
  const columns: Column<ByEmployeeItem>[] = [
    { key: 'employee', header: 'Nhân viên', render: (r) => <span className={`text-[13px] ${r.employee === TOTAL_LABEL ? 'font-bold text-fg' : 'text-fg'}`}>{r.employee}</span> },
    { key: 'dataNew', header: 'Data mới', align: 'right', render: (r) => <span className={`tabular-nums text-success ${r.employee === TOTAL_LABEL ? 'font-bold' : ''}`}>{fmtNum(r.dataNew)}</span> },
    { key: 'dataOld', header: 'Data cũ', align: 'right', render: (r) => <span className={`tabular-nums text-muted ${r.employee === TOTAL_LABEL ? 'font-bold' : ''}`}>{fmtNum(r.dataOld)}</span> },
    { key: 'dataTotal', header: 'Tổng data', align: 'right', render: (r) => <b className="tabular-nums">{fmtNum(r.dataTotal)}</b> },
    { key: 'pctNew', header: '% mới', align: 'right', render: (r) => <span className={`tabular-nums text-success ${r.employee === TOTAL_LABEL ? 'font-bold' : ''}`}>{fmtPct(r.pctNew)}</span> },
    { key: 'pctOld', header: '% cũ', align: 'right', render: (r) => <span className={`tabular-nums text-muted ${r.employee === TOTAL_LABEL ? 'font-bold' : ''}`}>{fmtPct(r.pctOld)}</span> },
  ];

  return (
    <DataTable
      columns={columns}
      rows={withTotalRow(rows)}
      rowKey={(r) => r.employee}
      empty="Không có Nhân viên nào khớp bộ lọc trong tháng này."
      maxHeight={420}
    />
  );
}
