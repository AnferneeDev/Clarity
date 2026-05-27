import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { SubjectTotal } from '@/lib/types';

export function useStats() {
  const [subjectTotals, setSubjectTotals] = useState<SubjectTotal[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStats = useCallback(async (startDate?: string, endDate?: string) => {
    setIsLoading(true);
    try {
      const data = await api.timer.getSubjectTotals(startDate, endDate) as SubjectTotal[];
      setSubjectTotals(Array.isArray(data) ? data : []);
    } catch { } finally { setIsLoading(false); }
  }, []);

  return { subjectTotals, isLoading, fetchStats };
}
