import { useStats } from '../hooks/useStats';
import { BarChart3 } from 'lucide-react';
import { formatMinutes } from '../lib/utils';

export default function StatsView() {
  const { subjectTotals, dailyData, isLoading } = useStats();

  if (isLoading) {
    return <div className="h-full flex items-center justify-center text-white text-sm">Loading stats...</div>;
  }

  const totalMinutes = subjectTotals.reduce((sum, s) => sum + s.total_minutes, 0);
  const maxTotal = Math.max(1, ...subjectTotals.map(s => s.total_minutes));

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-6 overflow-auto">
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="w-6 h-6 text-white" />
        <h2 className="text-2xl font-bold text-white">Statistics</h2>
      </div>

      {/* Total */}
      <div className="glass-card bg-white/5 border border-gray-700/30 rounded-xl p-4 mb-6">
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Time Tracked</div>
        <div className="text-3xl font-bold text-white">{formatMinutes(totalMinutes)}</div>
      </div>

      {/* Subject Breakdown */}
      <div className="mb-6">
        <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-3">By Subject</h3>
        <div className="space-y-2">
          {subjectTotals.length === 0 ? (
            <p className="text-sm text-gray-500">No sessions recorded yet</p>
          ) : (
            subjectTotals.map(s => (
              <div key={s.subject} className="flex items-center gap-3">
                <span className="text-sm text-white w-32 truncate">{s.subject}</span>
                <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#2a1636] rounded-full transition-all"
                    style={{ width: `${(s.total_minutes / maxTotal) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-400 w-16 text-right">{formatMinutes(s.total_minutes)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Days */}
      <div>
        <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-3">Recent Activity</h3>
        <div className="space-y-1">
          {dailyData.slice(-14).reverse().map(d => (
            <div key={d.date} className="flex items-center justify-between py-1 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-24">{d.date}</span>
                <div className="flex gap-1">
                  {d.subjects.map(subj => (
                    <span key={subj} className="text-[10px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded">
                      {subj}
                    </span>
                  ))}
                </div>
              </div>
              <span className="text-xs text-gray-300">{formatMinutes(d.total_minutes)}</span>
            </div>
          ))}
          {dailyData.length === 0 && (
            <p className="text-sm text-gray-500">No activity recorded yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
