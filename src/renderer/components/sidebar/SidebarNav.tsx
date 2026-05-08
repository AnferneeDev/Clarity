import { Clock, BarChart3, ListTodo, StickyNote, Settings, Bell } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
// eslint-disable-next-line import/no-unresolved
import logo from '@/assets/icon.ico';

interface SidebarNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function SidebarNav({ activeTab, setActiveTab }: SidebarNavProps) {
  const navItems = [
    { key: 'timer', label: 'Timer', icon: Clock },
    { key: 'stats', label: 'Stats', icon: BarChart3 },
    { key: 'tasks', label: 'Tasks', icon: ListTodo },
    { key: 'notes', label: 'Notes', icon: StickyNote },
    { key: 'settings', label: 'Settings', icon: Settings, bottom: true },
  ];

  return (
    <aside className="flex flex-col h-screen w-12 bg-[#0a0810]">
      <div
        className="flex items-center justify-center py-6 cursor-move w-full hover:bg-white/5 transition-colors"
        style={{ WebkitAppRegion: 'drag', appRegion: 'drag' } as React.CSSProperties}
      >
        <img src={logo} alt="Clarity" className="w-6 h-6 rounded" style={{ pointerEvents: 'none' }} />
      </div>

      <nav className="flex-1 px-0.5 py-3 space-y-1 flex flex-col">
        {navItems.map(({ key, label, icon: Icon, bottom }) => {
          const active = activeTab === key;
          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center justify-center w-full px-3 py-2 rounded-lg text-sm transition text-white ${
                    active ? 'bg-[#2a1636]' : 'hover:bg-[#2a1636]/50'
                  } ${bottom ? 'mt-auto' : ''}`}
                >
                  <Icon className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          );
        })}

        {/* Test notification button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={async () => {
                await window.electronAPI.app.notify('Test Notification', 'This is a test from Clarity!');
                window.electronAPI.app.log('[TEST] Notification fired');
              }}
              className="flex items-center justify-center w-full px-3 py-2 rounded-lg text-sm transition text-white hover:bg-[#2a1636]/50 mt-auto"
            >
              <Bell className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Test Notification</TooltipContent>
        </Tooltip>
      </nav>
    </aside>
  );
}
