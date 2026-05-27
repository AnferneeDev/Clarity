import { useState, useEffect, useMemo, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BarChart3, RefreshCw } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useStats } from '@/hooks/useStats';
import { api } from '@/lib/api';
import { getLocalDateString, formatMinutes } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

function formatDate(d: string) {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length < 3) return '—';
  const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

type DateFilter = 'day' | 'week' | 'month' | 'year' | 'all';

function getDateRange(filter: DateFilter) {
  const now = new Date();
  const today = localDateString(now);
  switch (filter) {
    case 'day': return { start: today, end: today, label: today };
    case 'week': {
      const s = new Date(now); s.setDate(now.getDate() - now.getDay());
      const e = new Date(now); e.setDate(now.getDate() + (6 - now.getDay()));
      return { start: localDateString(s), end: localDateString(e), label: `${localDateString(s)} \u2013 ${localDateString(e)}` };
    }
    case 'month': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: localDateString(s), end: localDateString(e), label: `${localDateString(s)} \u2013 ${localDateString(e)}` };
    }
    case 'year': return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31`, label: String(now.getFullYear()) };
    default: return { start: '1970-01-01', end: '2100-12-31', label: 'All Time' };
  }
}

export default function StatsScreen() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const [dateFilter, setDateFilter] = useState<DateFilter>('day');
  const [viewMode, setViewMode] = useState<'table' | 'progress'>('table');
  const [refreshing, setRefreshing] = useState(false);
  const [dateData, setDateData] = useState<Array<{ subject: string; date: string; total_minutes: number }>>([]);
  const { subjectTotals, isLoading, fetchStats } = useStats();

  const range = useMemo(() => getDateRange(dateFilter), [dateFilter]);

  const loadAllData = async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      const [dd] = await Promise.all([
        api.timer.getSubjectDateAggregated(range.start, range.end),
        fetchStats(range.start, range.end),
      ]);
      setDateData(dd || []);
    } catch {} finally { setTimeout(() => setRefreshing(false), 300); }
  };

  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [dateFilter, userId, range])
  );

  const totalMinutes = subjectTotals.reduce((s, r) => s + r.total_minutes, 0);

  const fbtns: { key: DateFilter; label: string }[] = [
    { key: 'day', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'year', label: 'Year' },
    { key: 'all', label: 'All' },
  ];

  return (
    <View className="flex-1 p-3 bg-black">
      <View className="bg-white/5 border border-gray-700/30 rounded-2xl p-4 flex-1">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <View className="flex-row items-center gap-2 mb-1">
              <BarChart3 size={20} color="white" />
              <Text className="text-xl font-semibold text-white">Study Analytics</Text>
            </View>
            <Text className="text-xs text-white/60">
              {subjectTotals.length} subjects • {totalMinutes} total minutes
            </Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              className="p-2 bg-white/10 rounded-lg border border-gray-700/30"
              onPress={loadAllData}
              disabled={refreshing}
            >
              <RefreshCw size={16} color="white" style={refreshing ? undefined : undefined} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
          <View className="flex-row gap-2">
            {fbtns.map(f => (
              <TouchableOpacity
                key={f.key}
                className={`px-4 py-1.5 rounded-lg ${dateFilter === f.key ? '' : 'bg-white/10 border border-gray-700/30'}`}
                style={dateFilter === f.key ? { backgroundColor: '#2a1636' } : undefined}
                onPress={() => setDateFilter(f.key)}
              >
                <Text className="text-white text-sm">{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <Text className="text-white/80 text-sm mb-3">{range.label}</Text>

        {isLoading || refreshing ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#a78bfa" />
          </View>
        ) : viewMode === 'table' ? (
          <ScrollView className="flex-1">
            {subjectTotals.length > 0 ? subjectTotals.map((stat, i) => (
              <View key={`${stat.subject}-${i}`} className="flex-row justify-between py-2 border-b border-gray-800">
                <Text className="text-white">{stat.subject}</Text>
                <Text className="text-white/80">{formatMinutes(stat.total_minutes)}</Text>
              </View>
            )) : (
              <Text className="text-white/60 text-center py-6">No data recorded</Text>
            )}
          </ScrollView>
        ) : (
          <View className="flex-1">
            {subjectTotals.filter(s => s.total_minutes > 0).map(stat => {
              const pct = totalMinutes > 0 ? (stat.total_minutes / totalMinutes) * 100 : 0;
              return (
                <View key={stat.subject} className="mb-3">
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-white font-medium">{stat.subject}</Text>
                    <Text className="text-white/80 text-sm">{formatMinutes(stat.total_minutes)}</Text>
                  </View>
                  <View className="w-full h-2 bg-gray-700/50 rounded-full">
                    <View className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: '#2a1636' }} />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}
