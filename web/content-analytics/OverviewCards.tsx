import { KPICard } from '../../src/components/ui';
import type { ContentAnalyticsOverview } from './contentAnalyticsApi';
import { fmtNum, fmtPct } from './format';

/** 3 KPI (Tổng/Mới/Cũ) + 1 thanh Stacked Bar Mới/Cũ — đọc trong ~5s, không thêm biểu đồ khác. */
export function OverviewCards({ overview }: { overview: ContentAnalyticsOverview }) {
  const { dataNew, dataOld, dataTotal, pctNew, pctOld } = overview;
  return (
    <div className="mb-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KPICard label="Tổng Data" value={fmtNum(dataTotal)} tone="accent"
          tooltip="Tổng purchases của mọi Content trong tháng đang xem (đã áp dụng bộ lọc)." />
        <KPICard label="Data mới" value={fmtNum(dataNew)} tone="good"
          sub={fmtPct(pctNew)}
          tooltip="Tổng purchases của các Content có first_seen (MIN ngày xuất hiện, toàn lịch sử Raw_Data) rơi vào tháng đang xem." />
        <KPICard label="Data cũ" value={fmtNum(dataOld)} tone="default"
          sub={fmtPct(pctOld)}
          tooltip="Tổng purchases của các Content đã xuất hiện từ trước tháng đang xem (chạy lại)." />
      </div>

      <div className="mt-3 rounded-card border border-line bg-surface p-3">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted">
          <span>Tỷ trọng Mới / Cũ</span>
          <span>{fmtPct(pctNew)} · {fmtPct(pctOld)}</span>
        </div>
        <div className="flex h-[18px] overflow-hidden rounded-[5px] bg-surface2">
          {dataTotal > 0 ? (
            <>
              <div className="h-full" style={{ width: `${pctNew}%`, background: 'var(--success)' }} title={`Mới: ${fmtNum(dataNew)}`} />
              <div className="h-full" style={{ width: `${pctOld}%`, background: 'var(--slate)' }} title={`Cũ: ${fmtNum(dataOld)}`} />
            </>
          ) : (
            <div className="h-full w-full" />
          )}
        </div>
        <div className="mt-1.5 flex gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--success)' }} />Mới</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--slate)' }} />Cũ</span>
        </div>
      </div>
    </div>
  );
}
