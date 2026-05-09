'use client';

import { useAuth } from '@/hooks/useAuth';
import { useBackground } from '@/hooks/useBackground';
import { Settings, User, LogOut, Clock, BarChart3, ListTodo, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ViewName = 'timer' | 'stats' | 'tasks' | 'notes' | 'settings';

const VIEW_SECTIONS: { key: ViewName; label: string; icon: React.ComponentType<any> }[] = [
  { key: 'timer', label: 'Timer', icon: Clock },
  { key: 'stats', label: 'Stats', icon: BarChart3 },
  { key: 'tasks', label: 'Tasks', icon: ListTodo },
  { key: 'notes', label: 'Notes', icon: StickyNote },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export default function SettingsPageContent() {
  const { user, logout } = useAuth();
  const { allBackgrounds, fetchAllBackgrounds } = useBackground('timer');

  const handleBgChange = async (view: ViewName, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      localStorage.setItem(`clarity_bg_${view}`, reader.result as string);
      fetchAllBackgrounds();
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBg = (view: ViewName) => {
    localStorage.removeItem(`clarity_bg_${view}`);
    fetchAllBackgrounds();
  };

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-6 overflow-auto">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-white" />
        <h2 className="text-2xl font-bold text-white">Settings</h2>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Account</h3>
        <div className="glass-card p-4 rounded-xl border border-gray-700/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
              <User className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-white text-sm font-medium">{user?.email || 'Unknown'}</p>
              <p className="text-gray-400 text-xs">{user?.email}</p>
            </div>
          </div>
          <Button onClick={logout} variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm">
            <LogOut className="w-4 h-4 mr-1" />Sign Out
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Background Images</h3>
        <div className="space-y-3">
          {VIEW_SECTIONS.map(({ key, label, icon: Icon }) => {
            const currentBg = allBackgrounds[key];
            return (
              <div key={key} className="glass-card p-3 rounded-xl border border-gray-700/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-8 rounded bg-cover bg-center border border-gray-700/50"
                    style={currentBg ? { backgroundImage: `url(${currentBg})` } : { backgroundColor: '#1a1a2e' }}
                  />
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-gray-400" />
                    <span className="text-white text-sm">{label}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer transition">
                    Change
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleBgChange(key, e)} />
                  </label>
                  {currentBg && (
                    <button onClick={() => handleRemoveBg(key)} className="text-xs text-red-400 hover:text-red-300 transition">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
