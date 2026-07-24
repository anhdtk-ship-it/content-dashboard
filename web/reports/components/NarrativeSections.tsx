/* Weekly Report — III. Đánh giá nhân viên (chia Nội địa / Quốc tế) + IV. Phương án tuần tới (theo market).
 * Nội dung do Rule Engine dùng chung sinh ra (giống hệt PDF), nhập tay chỉnh được.
 * Xem trước/IN = chỉ đọc (bullet/checklist); Chỉnh sửa = input. .emp-block không bị cắt khi in. */
import type { MarketBlock, MarketKey, WeeklyReportData, ReportNarrative } from '../types/report';

const inp = 'w-full rounded-control border border-line bg-surface px-2 py-1 text-[13px] text-fg focus:border-accent focus:outline-none';
const MAX_REVIEW = 4;
const MAX_PLAN = 5;

function EditList({ items, preview, onChange, addLabel, max, marker = 'none' }: {
  items: string[]; preview: boolean; onChange: (items: string[]) => void; addLabel: string; max: number; marker?: 'none' | 'check';
}) {
  if (preview) {
    const shown = items.filter((t) => t.trim());
    if (!shown.length) return <span className="text-[13px] text-muted">(chưa có nội dung)</span>;
    return (
      <div className="flex flex-col gap-0.5 text-[13px] leading-relaxed text-fg">
        {shown.map((t, i) => <div key={i}>{marker === 'check' ? `☐ ${t}` : t}</div>)}
      </div>
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

/** III. ĐÁNH GIÁ NHÂN VIÊN — mỗi nhân viên 1 block, bên trong tách Nội địa / Quốc tế. */
export function SectionReviews({ data, narrative, preview, onReview, employeeNames }: {
  data: WeeklyReportData;
  narrative: ReportNarrative;
  preview: boolean;
  onReview: (key: string, items: string[]) => void;
  employeeNames: string[];
}) {
  const has = (b: MarketBlock, name: string) => b.employees.some((e) => e.name === name);
  return (
    <div className="flex flex-col gap-3">
      {employeeNames.map((name) => (
        <div key={name} className="emp-block rounded-card border border-line p-3">
          <div className="mb-1.5 text-[13px] font-bold uppercase tracking-wide text-fg">{name}</div>
          <div className="flex flex-col gap-2">
            {data.markets.filter((b) => has(b, name)).map((b) => {
              const key = `${name}|${b.market}`;
              return (
                <div key={b.market}>
                  <div className="mb-0.5 text-[12px] font-semibold text-muted">{b.label}</div>
                  <EditList items={narrative.reviews[key] ?? []} preview={preview} max={MAX_REVIEW}
                    addLabel="Thêm đánh giá" onChange={(it) => onReview(key, it)} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** IV. PHƯƠNG ÁN TUẦN TỚI — checklist theo từng market (3–5 gạch đầu dòng). */
export function SectionPlans({ data, narrative, preview, onPlan }: {
  data: WeeklyReportData;
  narrative: ReportNarrative;
  preview: boolean;
  onPlan: (market: MarketKey, items: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {data.markets.map((b) => (
        <div key={b.market} className="emp-block rounded-card border border-line p-3">
          <div className="mb-1 text-[13px] font-bold uppercase tracking-wide text-fg">{b.label}</div>
          <EditList items={narrative.plans[b.market] ?? []} preview={preview} max={MAX_PLAN}
            marker="check" addLabel="Thêm kế hoạch" onChange={(it) => onPlan(b.market, it)} />
        </div>
      ))}
    </div>
  );
}
