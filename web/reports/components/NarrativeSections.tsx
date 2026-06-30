/* Weekly Report — II. Đánh giá + III. Hành động tuần tới, theo từng nhân viên (PHASE 8 · điều chỉnh).
 * Mỗi nhân viên ĐỘC LẬP: ≤2 ý, do Rule Engine sinh (gắn KPI cụ thể); nhập tay được; Xem trước = chỉ đọc.
 * Lưu cục bộ trong state trang (CHƯA persist). */
import type { EmployeeReport } from '../types/report';

const inp = 'w-full rounded-control border border-line bg-surface px-2 py-1 text-[13px] text-fg focus:border-accent focus:outline-none';
const MAX = 2;

/** Editor danh sách chuỗi (≤MAX) cho 1 nhân viên — dùng chung cho Đánh giá & Hành động. */
function EmployeeList({
  emp, items, preview, onChange, addLabel,
}: {
  emp: EmployeeReport; items: string[]; preview: boolean;
  onChange: (items: string[]) => void; addLabel: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-3">
      <div className="mb-2 text-[14px] font-bold text-fg">{emp.name}</div>
      {preview ? (
        <ul className="list-disc pl-5 text-[13px] text-fg">
          {items.filter((t) => t.trim()).map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((t, i) => (
            <div key={i} className="flex items-center gap-1">
              <input className={inp} value={t} onChange={(e) => onChange(items.map((x, idx) => (idx === i ? e.target.value : x)))} />
              <button className="text-[11px] text-muted hover:text-danger" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>✕</button>
            </div>
          ))}
          {items.length < MAX && (
            <button className="self-start text-[12px] text-accent hover:underline" onClick={() => onChange([...items, ''])}>+ {addLabel}</button>
          )}
        </div>
      )}
    </div>
  );
}

export function AssessmentSection({
  employees, assessments, preview, onChange,
}: {
  employees: EmployeeReport[];
  assessments: Record<string, string[]>;
  preview: boolean;
  onChange: (name: string, items: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {employees.map((e) => (
        <EmployeeList key={e.name} emp={e} items={assessments[e.name] ?? []} preview={preview}
          addLabel="Thêm đánh giá" onChange={(items) => onChange(e.name, items)} />
      ))}
    </div>
  );
}

export function ActionSection({
  employees, actions, preview, onChange,
}: {
  employees: EmployeeReport[];
  actions: Record<string, string[]>;
  preview: boolean;
  onChange: (name: string, items: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {employees.map((e) => (
        <EmployeeList key={e.name} emp={e} items={actions[e.name] ?? []} preview={preview}
          addLabel="Thêm hành động" onChange={(items) => onChange(e.name, items)} />
      ))}
    </div>
  );
}
