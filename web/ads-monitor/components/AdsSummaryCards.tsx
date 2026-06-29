/* Ads Monitor — thanh KPI 6 card (PHASE 5: dữ liệu từ API qua prop summary). */
import { KPICard } from '../../../src/components/ui';
import type { AdsSummary } from '../types/ads';
import { formatNumber, formatVND } from '../utils/format';

export function AdsSummaryCards({ summary }: { summary: AdsSummary }) {
  const s = summary;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <KPICard label="Tổng Ads" value={formatNumber(s.total)} tone="accent" />
      <KPICard label="Đang duy trì" value={formatNumber(s.duyTri)} tone="good" />
      <KPICard label="Đang test" value={formatNumber(s.test)} tone="orange" />
      <KPICard label="Mới chạy" value={formatNumber(s.moiChay)} tone="warn" />
      <KPICard label="Đã tắt" value={formatNumber(s.daTat)} tone="danger" />
      <KPICard label="Tổng Amount Spent" tone="accent"
        value={<span className="text-[15px] leading-tight">{formatVND(s.totalAmount)}</span>} />
    </div>
  );
}
