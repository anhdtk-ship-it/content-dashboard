/* Weekly Report — hook lấy dữ liệu (PHASE 8). Bọc WeeklyReportService + state tuần/địa lý. */
import { useEffect, useState } from 'react';
import { weeklyReportService } from '../services/WeeklyReportService';
import { currentWeek, shiftWeek } from '../utils/week';
import type { Geo, WeekRange, WeeklyReportData } from '../types/report';

export function useWeeklyReport() {
  const [week, setWeek] = useState<WeekRange>(() => currentWeek());
  const [geo, setGeo] = useState<Geo>('ALL');
  const [data, setData] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    weeklyReportService.getReport(week, geo)
      .then((d) => { if (!alive) return; setData(d); setError(null); })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [week, geo]);

  return {
    week, geo, data, loading, error,
    setGeo,
    prevWeek: () => setWeek((w) => shiftWeek(w, -1)),
    nextWeek: () => setWeek((w) => shiftWeek(w, 1)),
    thisWeek: () => setWeek(currentWeek()),
  };
}
