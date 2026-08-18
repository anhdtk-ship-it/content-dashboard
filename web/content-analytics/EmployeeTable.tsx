import { DataTable, type Column } from '../../src/components/ui';
import type { ByEmployeeItem } from './contentAnalyticsApi';
import { fmtNum, fmtPct } from './format';

const TOTAL_LABEL = 'Tổng cộng';
const OLD_COLOR = '#fb923c'; // khớp OverviewCards — không thêm token mới

/** Màu riêng cho 4 nhân viên thật + fallback cho "Không xác định" (chỉ đổi màu chữ, KHÔNG đổi dữ liệu). */
const EMPLOYEE_COLOR_CLASS: Record<string, string> = {
  KA: 'text-accent',
  Hiếu: 'text-success',
  Ánh: 'text-[#a855f7]',
  Liên: 'text-[#fb923c]',
};

/** Cộng dòng "Tổng cộng" cuối bảng để đối chiếu trực tiếp với KPI "Tổng Data" phía trên (PHASE 04). */
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

/** Thanh mini tỷ trọng Mới/Cũ ngay trong ô — chỉ minh hoạ trực quan, không phải cột số liệu mới. */
function RatioBar({ pctNew, pctOld }: { pctNew: number; pctOld: number }) {
  return (
    <div className="flex h-[6px] w-full max-w-[110px] overflow-hidden rounded-full bg-surface2">
      <div className="h-full" style={{ width: `${pctNew}%`, background: 'var(--success)' }} />
      <div className="h-full" style={{ width: `${pctOld}%`, background: OLD_COLOR }} />
    </div>
  );
}

/**
 * Bảng Nhân viên (PHASE 04, giao diện tinh chỉnh) — CHỈ 4 nhân viên thật KA/Hiếu/Ánh/Liên theo
 * thứ tự cố định (backend đã đảm bảo), cộng dòng "Không xác định" nếu có account_name không
 * khớp, + dòng Tổng cộng cuối bảng để đối chiếu KPI. KHÔNG hiển thị account_name kỹ thuật gốc.
 */
export function EmployeeTable({ rows }: { rows: ByEmployeeItem[] }) {
  const isTotal = (r: ByEmployeeItem) => r.employee === TOTAL_LABEL;
  const columns: Column<ByEmployeeItem>[] = [
    {
      key: 'employee', header: 'Nhân viên Ads',
      render: (r) => <span className={`text-[13px] font-semibold ${isTotal(r) ? 'text-fg' : (EMPLOYEE_COLOR_CLASS[r.employee] ?? 'text-muted')}`}>{r.employee}</span>,
    },
    { key: 'dataNew', header: 'Data Content mới', align: 'right', render: (r) => <span className={`tabular-nums text-fg ${isTotal(r) ? 'font-bold' : ''}`}>{fmtNum(r.dataNew)}</span> },
    { key: 'dataOld', header: 'Data Content cũ', align: 'right', render: (r) => <span className={`tabular-nums text-fg ${isTotal(r) ? 'font-bold' : ''}`}>{fmtNum(r.dataOld)}</span> },
    { key: 'dataTotal', header: 'Tổng Data', align: 'right', render: (r) => <b className="tabular-nums">{fmtNum(r.dataTotal)}</b> },
    { key: 'pctNew', header: 'Tỷ lệ mới', align: 'right', render: (r) => <span className={`tabular-nums text-fg ${isTotal(r) ? 'font-bold' : ''}`}>{fmtPct(r.pctNew)}</span> },
    { key: 'pctOld', header: 'Tỷ lệ cũ', align: 'right', render: (r) => <span className={`tabular-nums text-fg ${isTotal(r) ? 'font-bold' : ''}`}>{fmtPct(r.pctOld)}</span> },
    { key: 'ratio', header: 'Tỷ lệ', render: (r) => <RatioBar pctNew={r.pctNew} pctOld={r.pctOld} /> },
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
