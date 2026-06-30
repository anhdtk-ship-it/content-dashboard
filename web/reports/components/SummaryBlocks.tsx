/* Weekly Report — Phần I: Tổng quan team (6 KPI) + block từng nhân viên (PHASE 8).
 * KPI theo §6: Đã cấp · Đã test · Tồn · Tỷ lệ test · Content test win · Tỷ lệ win. Không bảng lớn, không biểu đồ. */
import { KPICard } from '../../../src/components/ui';
import { fmtNum, fmtPct1 } from '../utils/format';
import type { ReportMetrics, EmployeeReport } from '../types/report';

export function TeamSummaryBlock({ team }: { team: ReportMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <KPICard label="Đã cấp" value={fmtNum(team.capped)} tone="accent" />
      <KPICard label="Đã test" value={fmtNum(team.tested)} />
      <KPICard label="Tồn" value={fmtNum(team.ton)} tone="orange" tooltip="Đã cấp − Đã test (tính động)." />
      <KPICard label="Tỷ lệ test" value={fmtPct1(team.testRate)} tone="warn" tooltip="Đã test ÷ Đã cấp" />
      <KPICard label="Content test win" value={fmtNum(team.win)} tone="good" tooltip="Content chuyển test → maintain (đạt Duy trì)." />
      <KPICard label="Tỷ lệ win" value={fmtPct1(team.winRate)} tone="good" tooltip="Content test win ÷ Đã test" />
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
        {row('Tồn', fmtNum(m.ton))}
        {row('Tỷ lệ test', fmtPct1(m.testRate), true)}
        {row('Content test win', fmtNum(m.win))}
        {row('Tỷ lệ win', fmtPct1(m.winRate), true)}
      </div>
    </div>
  );
}
