import { useState, useEffect, useCallback } from 'react';

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
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async (startDate?: string, endDate?: string) => {
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

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { subjectTotals, dailyData, isLoading, fetchStats };
}
