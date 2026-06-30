/* Weekly Report — hook lấy dữ liệu (PHASE 8). Bọc WeeklyReportService + state khoảng thời gian (tùy chỉnh theo ngày). */
import { useEffect, useState } from 'react';
import { weeklyReportService } from '../services/WeeklyReportService';
import { currentWeek, makeRange } from '../utils/week';
import type { DateRange, WeeklyReportData } from '../types/report';

export function useWeeklyReport() {
  const [range, setRange] = useState<DateRange>(() => currentWeek());
  const [data, setData] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    weeklyReportService.getReport(range)
      .then((d) => { if (!alive) return; setData(d); setError(null); })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [range.from, range.to]);

  return {
    range, data, loading, error,
    setFrom: (from: string) => setRange((r) => makeRange(from || r.from, r.to)),
    setTo: (to: string) => setRange((r) => makeRange(r.from, to || r.to)),
    thisWeek: () => setRange(currentWeek()),
  };
}
