/* Weekly Report — Phần II (Vấn đề/Phương án) + Phần III (HĐ tuần tới), theo từng nhân viên (PHASE 8).
 * Tự sinh từ Dashboard (insights) làm mặc định; nhập tay được; Xem trước = chỉ đọc.
 * Lưu cục bộ trong state trang (CHƯA persist — không đổi DB). */
import type { EmployeeReport, IssueItem } from '../types/report';

const ta = 'w-full rounded-control border border-line bg-surface px-2 py-1 text-[13px] text-fg focus:border-accent focus:outline-none';
const MAX_ISSUES = 3;
const MAX_TASKS = 3;

/* ---------------- II. Vấn đề / Phương án ---------------- */
export function IssuesSection({
  employees, issues, preview, onChange,
}: {
  employees: EmployeeReport[];
  issues: Record<string, IssueItem[]>;
  preview: boolean;
  onChange: (name: string, items: IssueItem[]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {employees.map((e) => {
        const items = issues[e.name] ?? [];
        const set = (i: number, patch: Partial<IssueItem>) =>
          onChange(e.name, items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
        return (
          <div key={e.name} className="rounded-card border border-line bg-surface p-3">
            <div className="mb-2 text-[14px] font-bold text-fg">{e.name}</div>
            <div className="flex flex-col gap-2">
              {items.map((it, i) => (
                <div key={i} className="rounded-control border border-line bg-surface2 p-2">
                  {preview ? (
                    <>
                      <div className="text-[13px] text-fg"><span className="text-muted">Vấn đề: </span>{it.problem}</div>
                      <div className="text-[13px] text-fg"><span className="text-muted">Đề xuất: </span>{it.proposal}</div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <input className={ta} placeholder="Vấn đề…" value={it.problem} onChange={(ev) => set(i, { problem: ev.target.value })} />
                      <input className={ta} placeholder="Đề xuất…" value={it.proposal} onChange={(ev) => set(i, { proposal: ev.target.value })} />
                      <button className="self-end text-[11px] text-muted hover:text-danger"
                        onClick={() => onChange(e.name, items.filter((_, idx) => idx !== i))}>✕ Xoá ý</button>
                    </div>
                  )}
                </div>
              ))}
              {!preview && items.length < MAX_ISSUES && (
                <button className="self-start text-[12px] text-accent hover:underline"
                  onClick={() => onChange(e.name, [...items, { problem: '', proposal: '' }])}>+ Thêm ý</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- III. HĐ tuần tới + Đề xuất ---------------- */
export function NextWeekSection({
  employees, plans, preview, onChange,
}: {
  employees: EmployeeReport[];
  plans: Record<string, string[]>;
  preview: boolean;
  onChange: (name: string, tasks: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {employees.map((e) => {
        const tasks = plans[e.name] ?? [];
        return (
          <div key={e.name} className="rounded-card border border-line bg-surface p-3">
            <div className="mb-2 text-[14px] font-bold text-fg">{e.name}</div>
            {preview ? (
              <ul className="list-disc pl-5 text-[13px] text-fg">
                {tasks.filter((t) => t.trim()).map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            ) : (
              <div className="flex flex-col gap-1">
                {tasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <input className={ta} placeholder={`Đầu việc ${i + 1}…`} value={t}
                      onChange={(ev) => onChange(e.name, tasks.map((x, idx) => (idx === i ? ev.target.value : x)))} />
                    <button className="text-[11px] text-muted hover:text-danger"
                      onClick={() => onChange(e.name, tasks.filter((_, idx) => idx !== i))}>✕</button>
                  </div>
                ))}
                {tasks.length < MAX_TASKS && (
                  <button className="self-start text-[12px] text-accent hover:underline"
                    onClick={() => onChange(e.name, [...tasks, ''])}>+ Thêm việc</button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
