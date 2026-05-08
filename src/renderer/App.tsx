import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import AppLayout from './layouts/AppLayout';
import LoginView from './components/auth/LoginView';
import TimerView from './views/TimerView';
import StatsView from './views/StatsView';
import TasksView from './views/TasksView';
import NotesView from './views/NotesView';
import SettingsView from './views/SettingsView';
import { useBackground } from './hooks/useBackground';

function AppContent() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('timer');
  const { background } = useBackground(activeTab);

  // Listen for alarm notifications from main process (alarm checker)
  useEffect(() => {
    if (!user) return;
    return window.electronAPI.app.onAlarm((data) => {
      try {
        new Notification(data.title, { body: data.body, silent: false });
        window.electronAPI.app.log(`[NOTIFY] HTML5 alert fired: "${data.title}"`);
      } catch (e) {
        window.electronAPI.app.log(`[NOTIFY] HTML5 failed: ${e}`);
      }
    });
  }, [user]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center text-white text-sm">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <AppLayout activeTab={activeTab} setActiveTab={setActiveTab} backgroundUrl={background}>
      <div
        className="h-full w-full"
        style={{ display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }}
      >
        {/* Timer — always mounted to preserve state */}
        <div
          style={{
            gridArea: '1/1',
            position: 'relative',
            zIndex: activeTab === 'timer' ? 1 : 0,
            pointerEvents: activeTab === 'timer' ? 'auto' : 'none',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            opacity: activeTab === 'timer' ? 1 : 0,
            visibility: activeTab === 'timer' ? 'visible' : 'hidden',
            transition: 'opacity 200ms ease, visibility 200ms',
          }}
          aria-hidden={activeTab !== 'timer'}
        >
          <TimerView />
        </div>

        {/* Other views */}
        <div
          style={{
            gridArea: '1/1',
            position: 'relative',
            zIndex: 2,
            pointerEvents: activeTab === 'timer' ? 'none' : 'auto',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'auto',
          }}
          aria-hidden={activeTab === 'timer'}
        >
          {activeTab === 'stats' && <StatsView />}
          {activeTab === 'tasks' && <TasksView />}
          {activeTab === 'notes' && <NotesView />}
          {activeTab === 'settings' && <SettingsView />}
        </div>
      </div>
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
