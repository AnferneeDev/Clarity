import { useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface SubjectTotal { subject: string; total_minutes: number; }

export function useStats() {
  const [subjectTotals, setSubjectTotals] = useState<SubjectTotal[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStats = useCallback(async (startDate?: string, endDate?: string) => {
    setIsLoading(true);
    try {
      const data = await api.timer.getSubjectTotals(startDate, endDate);
      setSubjectTotals(Array.isArray(data) ? data : []);
    } catch { } finally { setIsLoading(false); }
  }, []);

  return { subjectTotals, isLoading, fetchStats };
}
