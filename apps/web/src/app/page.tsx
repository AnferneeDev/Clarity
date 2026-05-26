'use client';

import { useState } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { useBackground } from '@/hooks/useBackground';
import { TooltipProvider } from '@/components/ui/tooltip';
import SidebarNav from '@/components/sidebar/SidebarNav';
import LoginView from '@/components/auth/LoginView';
import dynamic from 'next/dynamic';

const TimerView = dynamic(() => import('@/app/timer/page-content'), { ssr: false });
const StatsView = dynamic(() => import('@/app/stats/page-content'), { ssr: false });
const TasksView = dynamic(() => import('@/app/tasks/page-content'), { ssr: false });
const NotesView = dynamic(() => import('@/app/notes/page-content'), { ssr: false });
const SettingsView = dynamic(() => import('@/app/settings/page-content'), { ssr: false });

function AppContent() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('timer');
  const { background } = useBackground(activeTab);

  if (isLoading) {
    return <div className="h-screen w-screen bg-black flex items-center justify-center text-white text-sm">Loading...</div>;
  }

  if (!user) {
    return <LoginView />;
  }

  const allViews = [
    { key: 'timer', Component: TimerView },
    { key: 'stats', Component: StatsView },
    { key: 'tasks', Component: TasksView },
    { key: 'notes', Component: NotesView },
    { key: 'settings', Component: SettingsView },
  ];

  return (
    <TooltipProvider>
      <div className="h-screen w-screen flex bg-black">
        <SidebarNav activeTab={activeTab} setActiveTab={setActiveTab} />
        <main
          className="flex-1 flex flex-col min-h-0"
          style={background ? { backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        >
          <section className="flex-1 p-4 min-h-0 overflow-hidden">
            {/* All views stay mounted — switching is pure CSS to preserve state & enable smooth transitions */}
            <div className="h-full w-full" style={{ display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }}>
              {allViews.map(({ key, Component }) => {
                const isActive = activeTab === key;
                return (
                  <div
                    key={key}
                    style={{
                      gridArea: '1/1',
                      position: 'relative',
                      overflow: key === 'timer' ? 'visible' : 'auto',
                      pointerEvents: isActive ? 'auto' : 'none',
                      opacity: isActive ? 1 : 0,
                      transform: isActive ? 'translateY(0px)' : 'translateY(6px)',
                      transition: 'opacity 220ms ease, transform 220ms ease',
                      zIndex: isActive ? 1 : 0,
                      visibility: isActive ? 'visible' : 'hidden',
                    }}
                    aria-hidden={!isActive}
                  >
                    <Component />
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      </div>
    </TooltipProvider>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
