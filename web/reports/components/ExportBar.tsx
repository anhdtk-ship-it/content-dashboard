/* Weekly Report — thanh xuất báo cáo (PHASE 9). Copy + Xuất PDF (in trình duyệt) chạy thật; DOCX để dành.
 * PDF KHÔNG dùng template riêng — gọi window.print() in chính ReportDocument (qua onPrint). */
import { useState } from 'react';
import { EXPORTERS } from '../services/exporters';
import type { WeeklyReportData, ReportNarrative } from '../types/report';

export function ExportBar({ data, narrative, onPrint }: {
  data: WeeklyReportData; narrative: ReportNarrative; onPrint: () => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 4000); };

  const run = async (i: number) => {
    const ex = EXPORTERS[i];
    if (ex.format === 'pdf') { onPrint(); return; }          // PDF = in chính báo cáo
    if (!ex.enabled) { flash(`${ex.label}: sắp có.`); return; }
    try { await ex.export(data, narrative); flash(`${ex.label}: đã sao chép báo cáo vào clipboard.`); }
    catch (e: any) { flash(`Lỗi: ${e?.message ?? e}`); }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {EXPORTERS.map((ex, i) => {
        const enabled = ex.format === 'pdf' ? true : ex.enabled;
        return (
          <button key={ex.format} onClick={() => run(i)} disabled={!enabled}
            title={enabled ? '' : 'Sắp có'}
            className={`rounded-control border px-3 py-1.5 text-[13px] ${
              enabled ? 'border-line bg-surface text-fg hover:border-accent' : 'border-line bg-surface text-muted opacity-60'
            }`}>
            {ex.label}{!enabled && ' (sắp có)'}
          </button>
        );
      })}
      {msg && <span className="text-[12px] text-muted">{msg}</span>}
    </div>
  );
}
