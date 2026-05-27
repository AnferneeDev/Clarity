import { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Plus, Trash2, Palette } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

const NOTE_COLORS = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316'];

export default function NotesScreen() {
  const { user } = useAuth();
  const { notes, isLoading, addNote, updateNote, deleteNote } = useNotes();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (notes.length > 0 && (!activeId || !notes.find(n => n.id === activeId))) {
      setActiveId(notes[0].id);
    }
  }, [notes]);

  const active = notes.find(n => n.id === activeId) || null;

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    addNote(title);
    setNewTitle('');
  };

  const handleUpdate = (field: string, value: string) => {
    if (!activeId) return;
    updateNote(activeId, { [field]: value });
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="white" />
      </View>
    );
  }

  return (
    <View className="flex-1 flex-row bg-black">
      <View className="w-1/3 border-r border-gray-800 p-3">
        <Text className="text-white text-lg font-semibold mb-3">Notes</Text>
        <FlatList
          data={notes}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              className={`rounded-lg px-3 py-2 mb-1 flex-row items-center justify-between ${item.id === activeId ? '' : ''}`}
              style={item.id === activeId ? { backgroundColor: `${item.color}30` } : undefined}
              onPress={() => setActiveId(item.id)}
            >
              <View className="flex-row items-center flex-1 gap-2">
                <View className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <Text className="text-white text-sm" numberOfLines={1}>
                  {item.title || 'Untitled'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { deleteNote(item.id); if (activeId === item.id) setActiveId(null); }}>
                <Trash2 size={14} color="#6b7280" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text className="text-white/40 text-sm text-center">No notes</Text>}
        />
        <View className="flex-row gap-2 mt-3">
          <Input
            className="flex-1 text-sm"
            placeholder="New note..."
            value={newTitle}
            onChangeText={setNewTitle}
            onSubmitEditing={handleAdd}
          />
          <TouchableOpacity className="bg-[#2a1636] rounded-xl px-3 items-center justify-center" onPress={handleAdd}>
            <Plus size={18} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-1 p-4">
        {active ? (
          <View className="flex-1 bg-white/5 border border-gray-700/30 rounded-2xl p-4">
            <TextInput
              className="text-2xl font-bold text-white mb-2"
              value={active.title}
              onChangeText={(v) => handleUpdate('title', v)}
              placeholder="Title"
              placeholderTextColor="#4b5563"
            />
            <View className="flex-row items-center gap-2 mb-3">
              <TouchableOpacity onPress={() => setColorPickerOpen(true)} className="flex-row items-center gap-1">
                <View className="w-5 h-5 rounded-full" style={{ backgroundColor: active.color }} />
                <Palette size={14} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <TextInput
              className="flex-1 text-white text-base"
              value={active.content}
              onChangeText={(v) => handleUpdate('content', v)}
              placeholder="Start writing..."
              placeholderTextColor="#4b5563"
              multiline
              textAlignVertical="top"
            />
          </View>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-white/40">Select a note or create one</Text>
          </View>
        )}
      </View>

      <Modal visible={colorPickerOpen} onClose={() => setColorPickerOpen(false)} title="Pick a color">
        <View className="flex-row flex-wrap gap-3 justify-center">
          {NOTE_COLORS.map(c => (
            <TouchableOpacity
              key={c}
              className="w-10 h-10 rounded-full border-2"
              style={{
                backgroundColor: c,
                borderColor: active?.color === c ? 'white' : 'transparent',
              }}
              onPress={() => {
                if (activeId) updateNote(activeId, { color: c });
                setColorPickerOpen(false);
              }}
            />
          ))}
        </View>
      </Modal>
    </View>
  );
}
