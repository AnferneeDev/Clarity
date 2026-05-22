import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Plus, Calendar, Star, Trash2, Check } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useTasks } from '@/hooks/useTasks';
import { Input } from '@/components/ui/Input';
import { format } from 'date-fns';

export default function TasksScreen() {
  const { user } = useAuth();
  const { tasks, isLoading, addTask, updateTask, deleteTask } = useTasks(user?.id || null);
  const [newText, setNewText] = useState('');

  const sorted = [...tasks].sort((a, b) => {
    if (a.starred !== b.starred) return a.starred ? -1 : 1;
    if (a.done !== b.done) return a.done ? 1 : -1;
    return b.id - a.id;
  });

  const handleAdd = () => {
    const text = newText.trim();
    if (!text) return;
    addTask(text);
    setNewText('');
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="white" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <View className="px-4 pt-4 pb-2">
        <Text className="text-3xl font-bold text-white mb-1">My Day</Text>
        <Text className="text-white/60 text-sm">{format(new Date(), 'EEEE, MMMM d')}</Text>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListEmptyComponent={
          <Text className="text-white/40 text-center py-10">No tasks yet</Text>
        }
        renderItem={({ item }) => (
          <View className="bg-white/5 border border-gray-700/30 rounded-xl p-4 flex-row items-center gap-3">
            <TouchableOpacity
              className={`w-6 h-6 rounded-full border-2 items-center justify-center ${item.done ? 'border-purple-400 bg-purple-400' : 'border-gray-500'}`}
              onPress={() => updateTask(item.id, { done: !item.done })}
            >
              {item.done && <Check size={14} color="white" />}
            </TouchableOpacity>
            <View className="flex-1">
              <Text className={`text-white text-base ${item.done ? 'line-through text-white/40' : ''}`}>
                {item.text}
              </Text>
              {item.due_date && (
                <View className="flex-row items-center gap-1 mt-1">
                  <Calendar size={12} color="#a78bfa" />
                  <Text className="text-xs text-purple-400">
                    {format(new Date(item.due_date), 'MMM d, h:mm a')}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={() => updateTask(item.id, { starred: !item.starred })}>
              <Star size={18} color={item.starred ? '#fbbf24' : '#6b7280'} fill={item.starred ? '#fbbf24' : 'none'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteTask(item.id)}>
              <Trash2 size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
      />

      <View className="p-4 flex-row gap-3 bg-black border-t border-gray-800">
        <Input
          className="flex-1"
          placeholder="Add a task..."
          value={newText}
          onChangeText={setNewText}
          onSubmitEditing={handleAdd}
        />
        <TouchableOpacity
          className="bg-[#2a1636] rounded-xl px-4 items-center justify-center"
          onPress={handleAdd}
        >
          <Plus size={20} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
