/* Weekly Report — Phần I: Tổng quan team (6 KPI) + block từng nhân viên (PHASE 8). */
import { KPICard } from '../../../src/components/ui';
import { fmtPct, fmtNum } from '../services/reportService';
import type { ReportMetrics, EmployeeReport } from '../types/report';

export function TeamSummaryBlock({ team }: { team: ReportMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <KPICard label="Đã cấp" value={fmtNum(team.capped)} tone="accent" />
      <KPICard label="Đã test" value={fmtNum(team.tested)} />
      <KPICard label="Đã sử dụng" value={fmtNum(team.used)} tone="info" tooltip="Đã test trừ 'Đã test-ko chạy' (content đã đưa vào chạy)." />
      <KPICard label="Tỷ lệ sử dụng" value={fmtPct(team.usageRate)} tone="warn" tooltip="Đã sử dụng ÷ Đã test" />
      <KPICard label="Content test win" value={fmtNum(team.win)} tone="good" tooltip="Thành công = Duy trì + Đã chạy-Tắt" />
      <KPICard label="Tỷ lệ test win" value={fmtPct(team.winRate)} tone="good" tooltip="Content test win ÷ Đã test" />
    </div>
  );
}

/** 1 block/nhân viên — ngắn gọn, KHÔNG bảng lớn. */
export function EmployeeBlock({ emp }: { emp: EmployeeReport }) {
  const m = emp.metrics;
  const row = (label: string, val: string, strong = false) => (
    <div className="flex items-center justify-between gap-2 text-[13px]">
      <span className="text-muted">{label}</span>
      <span className={strong ? 'font-semibold tabular-nums text-fg' : 'tabular-nums text-fg'}>{val}</span>
    </div>
  );
  return (
    <div className="rounded-card border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[14px] font-bold text-fg">{emp.name}</span>
        <span className="rounded-pill bg-surface2 px-2 py-0.5 text-[11px] text-muted">{fmtNum(m.capped)} content</span>
      </div>
      <div className="flex flex-col gap-1">
        {row('Đã cấp', fmtNum(m.capped))}
        {row('Đã test', fmtNum(m.tested))}
        {row('Chưa test', fmtNum(m.notTested))}
        {row('Đã sử dụng', fmtNum(m.used))}
        {row('Tỷ lệ sử dụng', fmtPct(m.usageRate), true)}
        {row('Content test win', `${fmtNum(m.win)} (${fmtPct(m.winRate)})`, true)}
      </div>
    </div>
  );
}
