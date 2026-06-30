/* Weekly Report — bộ lọc: Tuần báo cáo (◀ ▶ + Tuần này) + Địa lý + toggle Xem trước (PHASE 8). */
import { ActionButton } from '../../../src/components/ui';
import { GEO_LABEL, type Geo, type WeekRange } from '../types/report';

const ctrl = 'h-9 rounded-control border border-line bg-surface px-2 text-[13px] text-fg focus:border-accent focus:outline-none';
const navBtn = 'h-9 w-9 rounded-control border border-line bg-surface text-fg hover:border-accent disabled:opacity-40';

export function ReportFilters({
  week, geo, preview, onPrevWeek, onNextWeek, onThisWeek, onGeo, onTogglePreview,
}: {
  week: WeekRange; geo: Geo; preview: boolean;
  onPrevWeek: () => void; onNextWeek: () => void; onThisWeek: () => void;
  onGeo: (g: Geo) => void; onTogglePreview: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-0.5">
        <label className="text-[12px] text-muted">📅 Tuần báo cáo</label>
        <div className="flex items-center gap-1">
          <button className={navBtn} onClick={onPrevWeek} title="Tuần trước">◀</button>
          <span className="inline-flex h-9 min-w-[210px] items-center justify-center rounded-control border border-line bg-surface px-3 text-[13px] font-medium text-fg">
            {week.label}
          </span>
          <button className={navBtn} onClick={onNextWeek} title="Tuần sau">▶</button>
          <ActionButton variant="ghost" onClick={onThisWeek}>Tuần này</ActionButton>
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <label className="text-[12px] text-muted">Địa lý</label>
        <select className={ctrl} value={geo} onChange={(e) => onGeo(e.target.value as Geo)}>
          {(['ALL', 'noi_dia', 'quoc_te'] as Geo[]).map((g) => <option key={g} value={g}>{GEO_LABEL[g]}</option>)}
        </select>
      </div>
      <div className="ml-auto self-end">
        <ActionButton variant={preview ? 'primary' : 'ghost'} onClick={onTogglePreview}>
          {preview ? '✏️ Chỉnh sửa' : '👁 Xem trước'}
        </ActionButton>
      </div>
    </div>
  );
}
