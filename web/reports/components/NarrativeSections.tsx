/* Weekly Report — II. Đánh giá (theo TỪNG cá nhân) + III. Kế hoạch tuần tới (CẢ TEAM) — PHASE 12.
 * II: mỗi nhân viên 1 block (.emp-block → không bị cắt khi in), chỉ "Đánh giá" (Rule Engine sinh, nhập tay được).
 * III: 1 danh sách kế hoạch chung của team (KHÔNG chia nhân viên).
 * Xem trước/IN = chỉ đọc (bullet/checklist); Chỉnh sửa = input. */
import type { EmployeeReport } from '../types/report';

const inp = 'w-full rounded-control border border-line bg-surface px-2 py-1 text-[13px] text-fg focus:border-accent focus:outline-none';
const MAX_ASSESS = 3;   // ≤3 đánh giá / nhân viên
const MAX_PLAN = 6;     // ≤6 mục kế hoạch team

/** Danh sách chuỗi editable — bullet khi xem/in, input khi sửa. */
function EditList({ items, preview, onChange, addLabel, max, marker = 'disc' }: {
  items: string[]; preview: boolean; onChange: (items: string[]) => void; addLabel: string; max: number; marker?: 'disc' | 'check';
}) {
  if (preview) {
    const shown = items.filter((t) => t.trim());
    if (marker === 'check') {
      return (
        <div className="flex flex-col gap-0.5 text-[13px] text-fg">
          {shown.length === 0 ? <span className="text-muted">(chưa có kế hoạch)</span> : shown.map((t, i) => <div key={i}>☐ {t}</div>)}
        </div>
      );
    }
    return (
      <ul className="ml-1 list-disc pl-4 text-[13px] leading-relaxed text-fg">
        {shown.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      {items.map((t, i) => (
        <div key={i} className="flex items-center gap-1">
          <input className={inp} value={t} onChange={(e) => onChange(items.map((x, idx) => (idx === i ? e.target.value : x)))} />
          <button className="no-print text-[11px] text-muted hover:text-danger" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>✕</button>
        </div>
      ))}
      {items.length < max && (
        <button className="no-print self-start text-[12px] text-accent hover:underline" onClick={() => onChange([...items, ''])}>+ {addLabel}</button>
      )}
    </div>
  );
}

/** II. ĐÁNH GIÁ — theo TỪNG nhân viên (chỉ Đánh giá, không còn Hành động riêng). */
export function SectionII({
  employees, assessments, preview, onAssessment,
}: {
  employees: EmployeeReport[];
  assessments: Record<string, string[]>;
  preview: boolean;
  onAssessment: (name: string, items: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {employees.map((e) => (
        <div key={e.name} className="emp-block rounded-card border border-line p-3">
          <div className="mb-1 text-[13px] font-bold uppercase tracking-wide text-fg">{e.name}</div>
          <EditList items={assessments[e.name] ?? []} preview={preview} max={MAX_ASSESS} addLabel="Thêm đánh giá" onChange={(it) => onAssessment(e.name, it)} />
        </div>
      ))}
    </div>
  );
}

/** III. KẾ HOẠCH TUẦN TỚI — của CẢ TEAM (1 danh sách checklist, không chia nhân viên). */
export function SectionIII({
  teamActions, preview, onTeamActions,
}: {
  teamActions: string[];
  preview: boolean;
  onTeamActions: (items: string[]) => void;
}) {
  return (
    <div className="emp-block rounded-card border border-line p-3">
      <div className="mb-1 text-[13px] font-bold uppercase tracking-wide text-fg">Kế hoạch chung của team</div>
      <EditList items={teamActions} preview={preview} max={MAX_PLAN} addLabel="Thêm kế hoạch" marker="check" onChange={onTeamActions} />
    </div>
  );
}
