'use client';

import { useState } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { useBackground } from '@/hooks/useBackground';
import { TooltipProvider } from '@/components/ui/tooltip';
import SidebarNav from '@/components/sidebar/SidebarNav';
import LoginView from '@/components/auth/LoginView';
import TimerView from '@/app/timer/page-content';
import StatsView from '@/app/stats/page-content';
import TasksView from '@/app/tasks/page-content';
import NotesView from '@/app/notes/page-content';
import SettingsView from '@/app/settings/page-content';

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

  const viewMap: Record<string, React.ReactNode> = {
    timer: <TimerView />,
    stats: <StatsView />,
    tasks: <TasksView />,
    notes: <NotesView />,
    settings: <SettingsView />,
  };

  return (
    <TooltipProvider>
      <div className="h-screen w-screen flex bg-black">
        <SidebarNav activeTab={activeTab} setActiveTab={setActiveTab} />
        <main
          className="flex-1 flex flex-col min-h-0"
          style={background ? { backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        >
          <section className="flex-1 p-4 min-h-0 overflow-hidden">
            {/* Timer always mounted to preserve state */}
            <div
              className="h-full w-full"
              style={{ display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }}
            >
              <div
                style={{
                  gridArea: '1/1', position: 'relative',
                  zIndex: activeTab === 'timer' ? 1 : 0,
                  pointerEvents: activeTab === 'timer' ? 'auto' : 'none',
                  opacity: activeTab === 'timer' ? 1 : 0,
                  visibility: activeTab === 'timer' ? 'visible' : 'hidden',
                  transition: 'opacity 200ms ease, visibility 200ms',
                }}
                aria-hidden={activeTab !== 'timer'}
              >
                <TimerView />
              </div>
              <div
                style={{
                  gridArea: '1/1', position: 'relative', zIndex: 2,
                  pointerEvents: activeTab === 'timer' ? 'none' : 'auto',
                  overflow: 'auto',
                }}
                aria-hidden={activeTab === 'timer'}
              >
                {!['timer'].includes(activeTab) && viewMap[activeTab]}
              </div>
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
