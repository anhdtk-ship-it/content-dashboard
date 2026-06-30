/* Weekly Report — bộ lọc: Khoảng thời gian TÙY CHỈNH (Từ/Đến theo ngày) + toggle Xem trước (PHASE 8).
 * Đã BỎ bộ lọc Địa lý. */
import { ActionButton } from '../../../src/components/ui';
import type { DateRange } from '../types/report';

const ctrl = 'h-9 rounded-control border border-line bg-surface px-2 text-[13px] text-fg focus:border-accent focus:outline-none';

export function ReportFilters({
  range, preview, onFrom, onTo, onThisWeek, onTogglePreview,
}: {
  range: DateRange; preview: boolean;
  onFrom: (v: string) => void; onTo: (v: string) => void;
  onThisWeek: () => void; onTogglePreview: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-0.5">
        <label className="text-[12px] text-muted">📅 Từ ngày</label>
        <input type="date" className={ctrl} value={range.from} max={range.to} onChange={(e) => onFrom(e.target.value)} />
      </div>
      <div className="flex flex-col gap-0.5">
        <label className="text-[12px] text-muted">Đến ngày</label>
        <input type="date" className={ctrl} value={range.to} min={range.from} onChange={(e) => onTo(e.target.value)} />
      </div>
      <ActionButton variant="ghost" onClick={onThisWeek}>Tuần này</ActionButton>
      <div className="ml-auto self-end">
        <ActionButton variant={preview ? 'primary' : 'ghost'} onClick={onTogglePreview}>
          {preview ? '✏️ Chỉnh sửa' : '👁 Xem trước'}
        </ActionButton>
      </div>
    </div>
  );
}
