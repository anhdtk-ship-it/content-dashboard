/* Weekly Report — II. Đánh giá (Đánh giá + Hành động tuần tới) + III. Kế hoạch tuần tới (PHASE 9).
 * Mỗi nhân viên 1 block (.emp-block → không bị cắt khi in). ≤2 ý/mục, Rule Engine sinh, nhập tay được.
 * Xem trước/IN = chỉ đọc (bullet/checklist); Chỉnh sửa = input. */
import type { EmployeeReport } from '../types/report';

const inp = 'w-full rounded-control border border-line bg-surface px-2 py-1 text-[13px] text-fg focus:border-accent focus:outline-none';
const MAX = 2;

/** Danh sách chuỗi ≤MAX của 1 nhân viên — bullet khi xem/in, input khi sửa. */
function EditList({ items, preview, onChange, addLabel }: {
  items: string[]; preview: boolean; onChange: (items: string[]) => void; addLabel: string;
}) {
  if (preview) {
    return (
      <ul className="ml-1 list-disc pl-4 text-[13px] leading-relaxed text-fg">
        {items.filter((t) => t.trim()).map((t, i) => <li key={i}>{t}</li>)}
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
      {items.length < MAX && (
        <button className="no-print self-start text-[12px] text-accent hover:underline" onClick={() => onChange([...items, ''])}>+ {addLabel}</button>
      )}
    </div>
  );
}

/** II. ĐÁNH GIÁ — mỗi nhân viên: Đánh giá + Hành động tuần tới. */
export function SectionII({
  employees, assessments, actions, preview, onAssessment, onAction,
}: {
  employees: EmployeeReport[];
  assessments: Record<string, string[]>;
  actions: Record<string, string[]>;
  preview: boolean;
  onAssessment: (name: string, items: string[]) => void;
  onAction: (name: string, items: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {employees.map((e) => (
        <div key={e.name} className="emp-block rounded-card border border-line p-3">
          <div className="mb-1 text-[13px] font-bold uppercase tracking-wide text-fg">{e.name}</div>
          <div className="mb-0.5 text-[12px] font-semibold text-muted">Đánh giá</div>
          <EditList items={assessments[e.name] ?? []} preview={preview} addLabel="Thêm đánh giá" onChange={(it) => onAssessment(e.name, it)} />
          <div className="mb-0.5 mt-2 text-[12px] font-semibold text-muted">Hành động tuần tới</div>
          <EditList items={actions[e.name] ?? []} preview={preview} addLabel="Thêm hành động" onChange={(it) => onAction(e.name, it)} />
        </div>
      ))}
    </div>
  );
}

/** III. KẾ HOẠCH TUẦN TỚI — checklist (□) theo từng nhân viên (lấy từ Hành động tuần tới). */
export function SectionIII({ employees, actions }: { employees: EmployeeReport[]; actions: Record<string, string[]> }) {
  return (
    <div className="flex flex-col gap-3">
      {employees.map((e) => {
        const tasks = (actions[e.name] ?? []).filter((t) => t.trim());
        return (
          <div key={e.name} className="emp-block rounded-card border border-line p-3">
            <div className="mb-1 text-[13px] font-bold uppercase tracking-wide text-fg">{e.name}</div>
            <div className="flex flex-col gap-0.5 text-[13px] text-fg">
              {tasks.length === 0 ? <span className="text-muted">(chưa có kế hoạch)</span>
                : tasks.map((t, i) => <div key={i}>☐ {t}</div>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
