import { useState, useCallback } from 'react';

interface SubjectTotal {
  subject: string;
  total_minutes: number;
}

interface DailyAggregate {
  date: string;
  total_minutes: number;
  subjects: string[];
}

export function useStats() {
  const [subjectTotals, setSubjectTotals] = useState<SubjectTotal[]>([]);
  const [dailyData, setDailyData] = useState<DailyAggregate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStats = useCallback(async (startDate?: string, endDate?: string) => {
    setIsLoading(true);
    try {
      const [totals, daily] = await Promise.all([
        window.electronAPI.timer.getSubjectTotals(startDate, endDate),
        window.electronAPI.timer.getDailyAggregate(startDate, endDate),
      ]);
      setSubjectTotals(totals);
      setDailyData(daily);
    } catch (err) {
      console.error('[Stats] Fetch failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { subjectTotals, dailyData, isLoading, fetchStats };
}
