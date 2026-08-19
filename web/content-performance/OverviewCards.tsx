import { KPICard } from '../../src/components/ui';
import type { ContentPerformanceOverview } from './contentPerformanceApi';
import { fmtNum, fmtVND, fmtPct } from './format';

/** 5 KPI (Chi phí/SL Data/Giá Data/ROAS tháng/ROAS 3 tháng) — đúng scope V1 đã chốt (CP-02 §21). */
export function OverviewCards({ overview }: { overview: ContentPerformanceOverview }) {
  const { cost, dataCount, dataPrice, roasMonth, roas3Month } = overview;
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <KPICard label="Chi phí" value={fmtVND(cost)} tone="accent"
        tooltip="Tổng Chi phí (kênh Facebook) trong tháng/bộ lọc đang xem — từ Performance Sheet." />
      <KPICard label="SL Data" value={fmtNum(dataCount)} tone="info"
        tooltip="Tổng số lượng Data trong tháng/bộ lọc đang xem." />
      <KPICard label="Giá Data" value={fmtVND(dataPrice)} tone="default"
        tooltip="Chi phí ÷ SL Data (tính lại trên tổng đã lọc, KHÔNG lấy trung bình cộng)." />
      <KPICard label="ROAS tháng" value={fmtPct(roasMonth)} tone="good"
        tooltip="ROAS trong tháng, weighted theo Chi phí trên tổng đã lọc (không phải trung bình cộng % đơn giản)." />
      <KPICard label="ROAS 3 tháng" value={fmtPct(roas3Month)} tone="orange"
        tooltip="ROAS rolling 3 tháng — lấy từ giá trị ĐÃ TÍNH SẴN trong Performance Sheet, weighted theo Chi phí." />
    </div>
  );
}
