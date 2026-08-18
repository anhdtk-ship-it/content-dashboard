import { KPICard } from '../../src/components/ui';
import type { ContentAnalyticsOverview } from './contentAnalyticsApi';
import { fmtNum, fmtPct } from './format';

/** Màu "Cũ" — dùng chung hex với tone="orange" đã có sẵn của KPICard (không thêm token mới). */
const OLD_COLOR = '#fb923c';

function CornerBadge({ label, tone }: { label: string; tone: 'good' | 'old' }) {
  return (
    <span
      className="absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={tone === 'good' ? { background: 'rgba(52,211,153,0.15)', color: 'var(--success)' } : { background: 'rgba(251,146,60,0.15)', color: OLD_COLOR }}
    >
      {label}
    </span>
  );
}

/** Donut CSS thuần (conic-gradient) — không thêm thư viện chart. */
function RatioDonutCard({ pctNew, pctOld }: { pctNew: number; pctOld: number }) {
  const hasData = pctNew > 0 || pctOld > 0;
  const angle = Math.min(100, Math.max(0, pctNew));
  return (
    <div className="rounded-card border border-line bg-surface px-[15px] py-[13px]">
      <div className="mb-2.5 text-xs text-muted">Tỷ lệ Content mới / cũ</div>
      <div className="flex items-center gap-3.5">
        <div className="relative h-[64px] w-[64px] shrink-0">
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: hasData ? `conic-gradient(var(--success) 0% ${angle}%, ${OLD_COLOR} ${angle}% 100%)` : 'var(--surface2)' }}
          />
          <div className="absolute inset-[9px] rounded-full bg-surface" />
        </div>
        <div className="flex flex-col gap-1.5 text-[12px]">
          <span className="flex items-center gap-1.5 text-fg">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--success)' }} />
            Mới <b className="tabular-nums">{fmtPct(pctNew)}</b>
          </span>
          <span className="flex items-center gap-1.5 text-fg">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: OLD_COLOR }} />
            Cũ <b className="tabular-nums">{fmtPct(pctOld)}</b>
          </span>
        </div>
      </div>
    </div>
  );
}

/** 3 KPI (Tổng/Mới/Cũ) + 1 donut tỷ lệ — đọc trong ~5s, không thêm biểu đồ phức tạp khác. */
export function OverviewCards({ overview }: { overview: ContentAnalyticsOverview }) {
  const { dataNew, dataOld, dataTotal, pctNew, pctOld } = overview;
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KPICard label="Tổng Data" value={fmtNum(dataTotal)} tone="accent" sub="100% tổng data"
        tooltip="Tổng purchases của mọi Content trong tháng đang xem (đã áp dụng bộ lọc)." />

      <div className="relative">
        <KPICard label="Data Content mới" value={fmtNum(dataNew)} tone="good" sub={`${fmtPct(pctNew)} tổng data`}
          tooltip="Tổng purchases của các Content có first_seen (MIN ngày xuất hiện, toàn lịch sử Raw_Data) rơi vào tháng đang xem." />
        <CornerBadge label="MỚI" tone="good" />
      </div>

      <div className="relative">
        <KPICard label="Data Content cũ" value={fmtNum(dataOld)} tone="orange" sub={`${fmtPct(pctOld)} tổng data`}
          tooltip="Tổng purchases của các Content đã xuất hiện từ trước tháng đang xem (chạy lại)." />
        <CornerBadge label="CŨ" tone="old" />
      </div>

      <RatioDonutCard pctNew={pctNew} pctOld={pctOld} />
    </div>
  );
}
