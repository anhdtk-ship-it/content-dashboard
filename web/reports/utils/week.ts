/* Weekly Report — helper khoảng thời gian (PHASE 8). Tùy chỉnh theo ngày (Từ/Đến). */
import type { DateRange } from '../types/report';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dmy = (iso: string) => { const d = new Date(iso + 'T00:00:00'); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };

/** Tạo khoảng từ 2 ngày ISO; tự đảo nếu from > to. Label "dd/mm/yyyy – dd/mm/yyyy". */
export function makeRange(from: string, to: string): DateRange {
  let a = from, b = to;
  if (a && b && a > b) { const t = a; a = b; b = t; }
  return { from: a, to: b, label: `${dmy(a)} – ${dmy(b)}` };
}

/** Mặc định: tuần hiện tại (Thứ 2 → Chủ nhật) — vẫn cho phép chỉnh theo ngày sau đó. */
export function currentWeek(): DateRange {
  const mon = new Date(); mon.setHours(0, 0, 0, 0);
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  return makeRange(ymd(mon), ymd(sun));
}
