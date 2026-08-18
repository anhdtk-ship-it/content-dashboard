import type { ContentAnalyticsOverview } from './contentAnalyticsApi';
import { fmtNum, fmtPct, fmtDateTime } from './format';

const OLD_COLOR = '#fb923c'; // khớp OverviewCards/EmployeeTable — không thêm token màu mới

/**
 * Khối tóm tắt cuối trang (PHASE CONTENT-ANALYTICS-05 UI) — CHỈ tổng hợp lại đúng 3 số đã có ở
 * OverviewCards (Content Mới/Cũ/Tổng), KHÔNG liệt kê tên Content nào. Mục đích: 1 dòng chốt cuối
 * để đối chiếu nhanh trước khi rời trang, kèm mốc thời điểm dữ liệu được tải (client-side).
 */
export function ContentSummaryPanel({
  overview, month, updatedAt,
}: {
  overview: ContentAnalyticsOverview;
  month: string;
  updatedAt: Date | null;
}) {
  const { dataNew, dataOld, dataTotal, pctNew, pctOld } = overview;

  return (
    <div className="mt-5 rounded-card border border-line bg-surface p-4">
      <div className="mb-3 text-[13px] font-semibold text-fg">Tổng quan phân tích Content</div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[20px]" style={{ background: 'rgba(52,211,153,0.15)' }}>📄</span>
          <div>
            <div className="text-[12px] text-muted">Content Mới</div>
            <div className="text-[22px] font-bold text-success">{fmtNum(dataNew)}</div>
            <div className="text-[11px] text-muted">{fmtPct(pctNew)} tổng data</div>
          </div>
        </div>

        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between text-[12px] font-semibold">
            <span className="text-success">{fmtPct(pctNew)}</span>
            <span style={{ color: OLD_COLOR }}>{fmtPct(pctOld)}</span>
          </div>
          <div className="flex h-[10px] overflow-hidden rounded-full bg-surface2">
            {dataTotal > 0 ? (
              <>
                <div className="h-full" style={{ width: `${pctNew}%`, background: 'var(--success)' }} title={`Content Mới: ${fmtNum(dataNew)}`} />
                <div className="h-full" style={{ width: `${pctOld}%`, background: OLD_COLOR }} title={`Content Cũ: ${fmtNum(dataOld)}`} />
              </>
            ) : <div className="h-full w-full" />}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted">
            <span>Content Mới</span>
            <span>Content Cũ</span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:flex-row-reverse sm:text-right">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[20px]" style={{ background: 'rgba(251,146,60,0.15)' }}>📄</span>
          <div>
            <div className="text-[12px] text-muted">Content Cũ</div>
            <div className="text-[22px] font-bold" style={{ color: OLD_COLOR }}>{fmtNum(dataOld)}</div>
            <div className="text-[11px] text-muted">{fmtPct(pctOld)} tổng data</div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[11px] text-muted">
        <span>
          Tháng phân tích: <b className="text-fg">{month}</b>
          <span className="mx-1.5">·</span>
          Tổng Data: <b className="text-fg">{fmtNum(dataTotal)}</b>
          <span className="mx-1.5">·</span>
          Content Mới: <b className="text-fg">{fmtNum(dataNew)} ({fmtPct(pctNew)})</b>
          <span className="mx-1.5">·</span>
          Content Cũ: <b className="text-fg">{fmtNum(dataOld)} ({fmtPct(pctOld)})</b>
        </span>
        {updatedAt && <span>Cập nhật: {fmtDateTime(updatedAt)}</span>}
      </div>
    </div>
  );
}
