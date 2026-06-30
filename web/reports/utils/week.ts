/* Weekly Report — helper tuần (PHASE 8). Tuần = Thứ 2 → Chủ nhật. */
import type { WeekRange } from '../types/report';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dm = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

function mondayOf(anchor: Date): Date {
  const d = new Date(anchor); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Mon=0 … Sun=6
  return d;
}

export function weekRange(anchor: Date): WeekRange {
  const mon = mondayOf(anchor);
  const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  return { from: ymd(mon), to: ymd(sun), label: `Tuần ${dm(mon)} – ${pad(sun.getDate())}/${pad(sun.getMonth() + 1)}/${sun.getFullYear()}` };
}

export const currentWeek = (): WeekRange => weekRange(new Date());

export function shiftWeek(w: WeekRange, deltaWeeks: number): WeekRange {
  const mon = new Date(w.from + 'T00:00:00');
  mon.setDate(mon.getDate() + deltaWeeks * 7);
  return weekRange(mon);
}
