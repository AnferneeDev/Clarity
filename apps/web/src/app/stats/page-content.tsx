'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { BarChart3, Calendar, Check, RefreshCw, Funnel, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useStats } from '@/hooks/useStats';
import { api } from '@/lib/api';

function formatMinutes(t: number) { const h = Math.floor(t / 60); const m = Math.round(t % 60); return h > 0 ? `${h}h ${m}m` : `${m}m`; }
function formatSubject(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function formatDate(d: string) { if (!d) return '—'; const parts = d.split('-'); if (parts.length < 3) return '—'; const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])); return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function localDateString(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

type DateFilter = 'all' | 'year' | 'month' | 'week' | 'day' | 'custom';

function getDateRange(filter: DateFilter, cs?: string, ce?: string) {
  const now = new Date(); const today = localDateString(now);
  switch (filter) {
    case 'day': return { start: today, end: today, label: today };
    case 'week': { const s = new Date(now); s.setDate(now.getDate() - now.getDay()); const e = new Date(now); e.setDate(now.getDate() + (6 - now.getDay())); return { start: localDateString(s), end: localDateString(e), label: `${localDateString(s)} – ${localDateString(e)}` }; }
    case 'month': { const s = new Date(now.getFullYear(), now.getMonth(), 1); const e = new Date(now.getFullYear(), now.getMonth() + 1, 0); return { start: localDateString(s), end: localDateString(e), label: `${localDateString(s)} – ${localDateString(e)}` }; }
    case 'year': return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31`, label: `${now.getFullYear()}` };
    case 'custom': if (cs && ce) return { start: cs, end: ce, label: `${cs} – ${ce}` };
    default: return { start: '1970-01-01', end: '2100-12-31', label: 'All Time' };
  }
}

const LS_HIDDEN = 'stats-hidden-subjects';

export default function StatsPageContent() {
  const [dateFilter, setDateFilter] = useState<DateFilter>('day');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'progress'>('table');
  const [refreshing, setRefreshing] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [combinePerDay] = useState(false);
  const [hiddenSubjects, setHiddenSubjects] = useState<Set<string>>(() => { try { const s = typeof window !== 'undefined' ? localStorage.getItem(LS_HIDDEN) : null; return s ? new Set(JSON.parse(s)) : new Set(); } catch { return new Set(); } });
  const [subjectDateData, setSubjectDateData] = useState<Array<{ subject: string; date: string; total_minutes: number }>>([]);
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const { subjectTotals, isLoading, fetchStats } = useStats();

  const range = useMemo(() => getDateRange(dateFilter, customStart, customEnd), [dateFilter, customStart, customEnd]);

  const loadAllData = useCallback(async () => {
    try {
      const [dateData, allTimeTotals] = await Promise.all([
        api.timer.getSubjectDateAggregated(range.start, range.end),
        api.timer.getSubjectTotals('1970-01-01', '2100-12-31'),
      ]);
      setSubjectDateData(Array.isArray(dateData) ? dateData : []);
      setAllSubjects(Array.isArray(allTimeTotals) ? allTimeTotals.map((s: any) => s.subject) : []);
      await fetchStats(range.start, range.end);
    } catch { }
  }, [range.start, range.end, fetchStats]);

  useEffect(() => { loadAllData(); }, [loadAllData]);
  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem(LS_HIDDEN, JSON.stringify([...hiddenSubjects])); }, [hiddenSubjects]);

  const visibleSubjectTotals = subjectTotals.filter(s => !hiddenSubjects.has(s.subject));
  const totalMinutes = visibleSubjectTotals.reduce((s, r) => s + r.total_minutes, 0);

  const pivotData = useMemo(() => {
    if (dateFilter === 'day') return null;
    const subs = visibleSubjectTotals.map(s => s.subject).sort();
    const dates = [...new Set(subjectDateData.map(s => s.date))].sort().reverse();
    return { subjects: subs, rows: dates.map(date => { const cells: Record<string, number> = {}; let total = 0; for (const subj of subs) { const m = subjectDateData.find(r => r.date === date && r.subject === subj)?.total_minutes || 0; cells[subj] = m; total += m; } return { date, cells, total }; }) };
  }, [dateFilter, subjectDateData, visibleSubjectTotals]);

  const deleteSubj = async (s: string) => { if (!confirm(`Permanently delete "${s}"?`)) return; try { await api.timer.deleteSubjectCompletely(s); await loadAllData(); } catch { } };
  const toggleHidden = (s: string) => setHiddenSubjects(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });

  const fbtns: { key: DateFilter; label: string }[] = [{ key: 'day', label: 'Today' }, { key: 'week', label: 'Week' }, { key: 'month', label: 'Month' }, { key: 'year', label: 'Year' }, { key: 'custom', label: 'Custom' }, { key: 'all', label: 'All Time' }];

  return (
    <div className="w-full h-full flex flex-col p-2 overflow-hidden">
      <div className="glass-card border border-glass-border rounded-2xl flex flex-col max-h-full p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div><div className="flex items-center gap-2 mb-1"><BarChart3 className="h-5 w-5 text-white" /><h2 className="text-xl font-semibold text-white">Study Analytics</h2></div><div className="text-xs text-white/60">Showing {visibleSubjectTotals.length} subjects • {totalMinutes} total minutes</div></div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" className={`text-white bg-gray-200/50 border border-gray-700/50 hover:bg-white/20 ${refreshing ? 'opacity-50' : ''}`} onClick={async () => { setRefreshing(true); await loadAllData(); setTimeout(() => setRefreshing(false), 300); }} disabled={refreshing}><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /></Button>
            <Popover open={isConfigOpen} onOpenChange={setIsConfigOpen}><PopoverTrigger asChild><Button variant="secondary" size="sm" className="text-white bg-gray-200/50 border border-gray-700/50 hover:bg-white/20"><Funnel className="h-4 w-4" /> Filters</Button></PopoverTrigger><PopoverContent className="w-80 bg-gray-800 border border-gray-700 text-white max-h-96 overflow-y-auto"><div className="space-y-4"><h4 className="font-medium">Table filters</h4><div className="border-t border-gray-700 pt-2"><h5 className="text-sm font-medium mb-2">Show/Hide Subjects</h5><div className="space-y-2 max-h-32 overflow-y-auto">{allSubjects.map(s => (<div key={s} className="flex items-center justify-between"><Label className="text-sm text-white/80 flex-1 truncate">{formatSubject(s)}</Label><Switch checked={!hiddenSubjects.has(s)} onCheckedChange={() => toggleHidden(s)} /></div>))}</div></div><div className="border-t border-gray-700 pt-2"><h5 className="text-sm font-medium mb-2 text-red-400">Eliminate Subjects</h5><div className="space-y-2 max-h-32 overflow-y-auto">{allSubjects.map(s => (<div key={`del-${s}`} className="flex items-center justify-between"><span className="text-sm text-white/80 flex-1 truncate">{formatSubject(s)}</span><Button variant="destructive" size="sm" className="h-6 px-2 bg-red-600 hover:bg-red-700" onClick={() => deleteSubj(s)}><Trash2 className="h-3 w-3 mr-1" />Delete</Button></div>))}</div><div className="text-xs text-red-400/60 mt-1">⚠ Deleting is permanent!</div></div><div className="flex justify-end pt-2"><Button size="sm" onClick={() => setIsConfigOpen(false)} className="bg-[rgb(var(--accent-primary-rgb))] hover:bg-[rgb(var(--accent-primary-rgb))]/80"><Check className="h-4 w-4 mr-1" />Apply</Button></div></div></PopoverContent></Popover>
            <Tabs value={viewMode} onValueChange={v => setViewMode(v as 'table' | 'progress')}><TabsList className="bg-gray-200/50 border border-gray-700/50"><TabsTrigger value="table" className="text-white data-[state=active]:bg-[rgb(var(--accent-primary-rgb))] data-[state=active]:text-white">Table</TabsTrigger><TabsTrigger value="progress" className="text-white data-[state=active]:bg-[rgb(var(--accent-primary-rgb))] data-[state=active]:text-white">Progress</TabsTrigger></TabsList></Tabs>
          </div>
        </div>
        <div className="flex items-center justify-between mb-0 p-2 bg-gray-100/40 rounded-lg border border-gray-700/50 rounded-b-none">
          <div className="flex gap-2 items-center">{fbtns.map(f => (<Button key={f.key} variant="secondary" size="sm" className={`text-white border transition-all duration-200 ${dateFilter === f.key ? 'bg-[rgb(var(--accent-primary-rgb))] text-white border-[rgb(var(--accent-primary-rgb))]' : 'bg-gray-400/25 text-white/90 border-gray-700/50 hover:bg-white/20'}`} onClick={() => setDateFilter(f.key)}>{f.label}</Button>))}{dateFilter === 'custom' && (<div className="ml-2 flex gap-2 items-center"><input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-gray-700 text-white text-sm px-2 py-1 rounded border border-gray-600" /><span className="text-white/60">to</span><input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-gray-700 text-white text-sm px-2 py-1 rounded border border-gray-600" /></div>)}</div>
          <div className="flex items-center gap-4"><div className="flex items-center gap-2 text-sm text-white/80"><Calendar className="h-4 w-4" />{range.label}</div></div>
        </div>
        <div className="min-h-0 max-h-full overflow-auto rounded-xl border rounded-t-none border-gray-700/50 bg-gray-400/30 p-0">
          {refreshing ? (<div className="flex items-center justify-center gap-2 py-10"><RefreshCw className="h-5 w-5 animate-spin text-white/60" /><span className="text-white/60 text-sm">Loading data...</span></div>) : viewMode === 'table' ? (
            <Table><TableHeader><TableRow className="bg-gray-100/30 border-gray-700/50 sticky top-0">{dateFilter === 'day' ? (<><TableHead className="text-white font-medium">Subject</TableHead><TableHead className="text-white font-medium">Focus Time</TableHead></>) : (<><TableHead className="text-white font-medium sticky left-0 bg-gray-800/90 z-10">Date</TableHead>{pivotData?.subjects.map(s => (<TableHead key={s} className="text-white font-medium text-center min-w-[80px]">{formatSubject(s)}</TableHead>))}<TableHead className="text-white font-medium text-center bg-gray-700/50">Total</TableHead></>)}</TableRow></TableHeader><TableBody>{dateFilter === 'day' ? (visibleSubjectTotals.length > 0 ? visibleSubjectTotals.map((stat, i) => (<TableRow key={`${stat.subject}-${i}`} className="border-gray-700/50 hover:bg-white/10"><TableCell className="text-white">{formatSubject(stat.subject)}</TableCell><TableCell className="text-white">{formatMinutes(stat.total_minutes)}</TableCell></TableRow>)) : (<TableRow><TableCell colSpan={2} className="text-center py-6 text-white/60">No data recorded today</TableCell></TableRow>)) : pivotData && pivotData.rows.length > 0 ? pivotData.rows.map((row, i) => (<TableRow key={`${row.date}-${i}`} className="border-gray-700/50 hover:bg-white/10"><TableCell className="text-white sticky left-0 bg-gray-800/80 z-10">{formatDate(row.date)}</TableCell>{pivotData.subjects.map(s => (<TableCell key={s} className="text-white text-center">{row.cells[s] > 0 ? formatMinutes(row.cells[s]) : '—'}</TableCell>))}<TableCell className="text-white text-center font-medium bg-gray-700/30">{formatMinutes(row.total)}</TableCell></TableRow>)) : (<TableRow><TableCell colSpan={(pivotData?.subjects.length || 0) + 2} className="text-center py-6 text-white/60">{dateFilter === 'custom' && (!customStart || !customEnd) ? 'Please select a date range' : 'No data found'}</TableCell></TableRow>)}</TableBody></Table>
          ) : (<div className="space-y-3 p-4">{visibleSubjectTotals.filter(s => s.total_minutes > 0).map(stat => { const pct = totalMinutes > 0 ? (stat.total_minutes / totalMinutes) * 100 : 0; return (<div key={stat.subject} className="flex items-center justify-between"><div className="flex-1"><div className="flex justify-between items-center mb-1"><span className="font-medium text-white">{formatSubject(stat.subject)}</span><span className="text-sm text-white/80">{formatMinutes(stat.total_minutes)}</span></div><div className="w-full bg-gray-700/50 rounded-full h-2"><div className="bg-[rgb(var(--accent-primary-rgb))] h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} /></div></div></div>); })}</div>)}
        </div>
        <div className="flex-shrink-0 mt-2 rounded-xl border border-gray-700/50 bg-gray-300/20 overflow-hidden"><Table><TableBody><TableRow className="hover:bg-transparent"><TableCell className="text-white font-medium text-sm py-3">{range.label} Total</TableCell><TableCell className="text-white font-medium text-sm py-3 text-right">{formatMinutes(totalMinutes)}</TableCell></TableRow></TableBody></Table></div>
      </div>
    </div>
  );
}
