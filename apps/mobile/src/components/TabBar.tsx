import { View, Text, TouchableOpacity } from 'react-native';
import { Clock, BarChart3, ListTodo, StickyNote, Settings } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TabBarProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
}

const TABS = [
  { key: 'timer', icon: Clock, label: 'Timer' },
  { key: 'stats', icon: BarChart3, label: 'Stats' },
  { key: 'tasks', icon: ListTodo, label: 'Tasks' },
  { key: 'notes', icon: StickyNote, label: 'Notes' },
  { key: 'settings', icon: Settings, label: 'Settings' },
];

export default function TabBar({ activeTab, onTabPress }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row bg-[#0a0810] border-t border-gray-800"
      style={{ paddingBottom: insets.bottom }}
    >
      {TABS.map(tab => {
        const isActive = activeTab === tab.key;
        const Icon = tab.icon;
        return (
          <TouchableOpacity
            key={tab.key}
            className="flex-1 items-center justify-center py-2"
            onPress={() => onTabPress(tab.key)}
          >
            <Icon
              size={22}
              color={isActive ? '#a78bfa' : '#6b7280'}
              strokeWidth={isActive ? 2.5 : 2}
            />
            <Text
              className={`text-xs mt-0.5 ${isActive ? 'text-purple-400 font-medium' : 'text-gray-500'}`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
