import { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import LoginView from '@/components/auth/LoginView';
import TimerScreen from '@/components/screens/TimerScreen';
import StatsScreen from '@/components/screens/StatsScreen';
import TasksScreen from '@/components/screens/TasksScreen';
import NotesScreen from '@/components/screens/NotesScreen';
import SettingsScreen from '@/components/screens/SettingsScreen';
import TabBar from '@/components/TabBar';

export default function AppIndex() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('timer');
  const insets = useSafeAreaInsets();

  if (isLoading) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator color="white" size="large" />
        <StatusBar style="light" />
      </View>
    );
  }

  if (!user) {
    return (
      <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
        <StatusBar style="light" />
        <LoginView />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      <StatusBar style="light" />

      <View className="flex-1 relative">
        {/* Timer always mounted — grid stacking pattern */}
        <View
          className="absolute inset-0"
          style={{
            zIndex: activeTab === 'timer' ? 1 : 0,
            opacity: activeTab === 'timer' ? 1 : 0,
          }}
          pointerEvents={activeTab === 'timer' ? 'auto' : 'none'}
        >
          <TimerScreen />
        </View>

        {/* Other views render on top when active */}
        {activeTab !== 'timer' && (
          <View className="absolute inset-0" style={{ zIndex: 2 }}>
            {activeTab === 'stats' && <StatsScreen />}
            {activeTab === 'tasks' && <TasksScreen />}
            {activeTab === 'notes' && <NotesScreen />}
            {activeTab === 'settings' && <SettingsScreen />}
          </View>
        )}
      </View>

      <TabBar activeTab={activeTab} onTabPress={setActiveTab} />
    </View>
  );
}
