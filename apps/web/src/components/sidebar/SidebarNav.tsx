import { Clock, BarChart3, ListTodo, StickyNote, Settings } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
        className="flex items-center justify-center py-6 cursor-move w-full hover:bg-white/5 transition-colors duration-150"
        style={{ WebkitAppRegion: 'drag', appRegion: 'drag' } as React.CSSProperties}
      >
        <div className="w-6 h-6 rounded bg-purple-600 flex items-center justify-center text-white text-xs font-bold">C</div>
      </div>

      <nav className="flex-1 px-0.5 py-3 space-y-1 flex flex-col">
        {navItems.map(({ key, label, icon: Icon, bottom }) => {
          const active = activeTab === key;
          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveTab(key)}
                  className={`group relative flex items-center justify-center w-full px-3 py-2 rounded-lg text-sm text-white ${bottom ? 'mt-auto' : ''}`}
                  style={{
                    background: active ? 'rgba(147, 51, 234, 0.22)' : 'transparent',
                    boxShadow: active ? '0 0 0 1px rgba(147, 51, 234, 0.35) inset' : '0 0 0 1px transparent inset',
                    transition: 'background 180ms ease, box-shadow 180ms ease',
                  }}
                >
                  <Icon
                    className="w-5 h-5 relative z-10"
                    style={{
                      color: active ? 'rgb(216, 180, 254)' : 'rgba(255,255,255,0.45)',
                      transform: active ? 'scale(1.12)' : 'scale(1)',
                      filter: active ? 'drop-shadow(0 0 6px rgba(167,139,250,0.5))' : 'none',
                      transition: 'color 180ms ease, transform 180ms ease, filter 180ms ease',
                    }}
                  />
                  {/* hover glow */}
                  <span
                    className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      transition: 'opacity 150ms ease',
                    }}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </aside>
  );
}
