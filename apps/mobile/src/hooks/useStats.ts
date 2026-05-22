import { useState, useCallback } from 'react';
import { getSessionTotals } from '@/lib/db';

interface SubjectTotal { subject: string; total_minutes: number; }

export function useStats(userId: string | null) {
  const [subjectTotals, setSubjectTotals] = useState<SubjectTotal[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStats = useCallback(async (startDate?: string, endDate?: string) => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const data = await getSessionTotals(userId, startDate, endDate);
      setSubjectTotals(data);
    } catch {} finally { setIsLoading(false); }
  }, [userId]);

  return { subjectTotals, isLoading, fetchStats };
}

export async function getStats(userId: string, startDate?: string, endDate?: string) {
  return getSessionTotals(userId, startDate, endDate);
}

export async function getDateAggregatedStats(userId: string, startDate?: string, endDate?: string) {
  const { getSessionDateAggregated } = await import('@/lib/db');
  return getSessionDateAggregated(userId, startDate, endDate);
}
