/* Weekly Report — thanh xuất báo cáo (PHASE 8). Copy chạy thật; PDF/DOCX disabled (chỉ thiết kế). */
import { useState } from 'react';
import { EXPORTERS } from '../services/exporters';
import type { WeeklyReportData, ReportNarrative } from '../types/report';

export function ExportBar({ data, narrative }: { data: WeeklyReportData; narrative: ReportNarrative }) {
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (i: number) => {
    const ex = EXPORTERS[i];
    if (!ex.enabled) { setMsg(`${ex.label}: sắp có (Phase 8 chỉ thiết kế interface).`); return; }
    try { await ex.export(data, narrative); setMsg(`${ex.label}: đã sao chép báo cáo vào clipboard.`); }
    catch (e: any) { setMsg(`Lỗi: ${e?.message ?? e}`); }
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {EXPORTERS.map((ex, i) => (
        <button key={ex.format} onClick={() => run(i)} disabled={!ex.enabled}
          title={ex.enabled ? '' : 'Sắp có — Phase 8 chỉ thiết kế interface'}
          className={`rounded-control border px-3 py-1.5 text-[13px] ${
            ex.enabled ? 'border-line bg-surface text-fg hover:border-accent' : 'border-line bg-surface text-muted opacity-60'
          }`}>
          {ex.label}{!ex.enabled && ' (sắp có)'}
        </button>
      ))}
      {msg && <span className="text-[12px] text-muted">{msg}</span>}
    </div>
  );
}
