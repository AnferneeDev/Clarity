import { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Image as RNImage } from 'react-native';
import { Settings, User, Image, Trash2 } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useBackground } from '@/hooks/useBackground';
import { Button } from '@/components/ui/Button';
import * as ImagePicker from 'expo-image-picker';

const VIEWS = ['timer', 'stats', 'tasks', 'notes', 'settings'] as const;

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { allBackgrounds, setViewBackground, removeViewBackground, refresh } = useBackground('timer');

  useEffect(() => { refresh(); }, []);

  const handlePickImage = async (view: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to photos to set a background.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      const dataUri = `data:image/jpeg;base64,${result.assets[0].base64}`;
      await setViewBackground(view, dataUri);
    }
  };

  const handleRemove = async (view: string) => {
    await removeViewBackground(view);
  };

  return (
    <ScrollView className="flex-1 bg-black px-4 pt-4">
      <View className="flex-row items-center gap-3 mb-6">
        <Settings size={24} color="white" />
        <Text className="text-2xl font-bold text-white">Settings</Text>
      </View>

      <Text className="text-white text-lg font-semibold mb-3">Account</Text>
      <View className="bg-white/5 border border-gray-700/30 rounded-2xl p-4 mb-6">
        <View className="flex-row items-center gap-3 mb-3">
          <View className="w-12 h-12 rounded-full bg-purple-600 items-center justify-center">
            <User size={24} color="white" />
          </View>
          <View>
            <Text className="text-white text-lg font-medium">{user?.email || 'User'}</Text>
            <Text className="text-white/60 text-sm">Signed in</Text>
          </View>
        </View>
        <Button variant="destructive" onPress={logout}>
          Sign Out
        </Button>
      </View>

      <Text className="text-white text-lg font-semibold mb-3">Background Images</Text>
      <View className="bg-white/5 border border-gray-700/30 rounded-2xl p-4 mb-6">
        {VIEWS.map(view => (
          <View key={view} className="flex-row items-center justify-between py-2 border-b border-gray-800 last:border-b-0">
            <View className="flex-row items-center gap-3 flex-1">
              <View className="w-12 h-12 rounded-lg bg-white/10 overflow-hidden">
                {allBackgrounds[view] ? (
                  <RNImage source={{ uri: allBackgrounds[view] }} className="w-full h-full" style={{ resizeMode: 'cover' }} />
                ) : (
                  <Image size={24} color="#6b7280" />
                )}
              </View>
              <Text className="text-white capitalize">{view}</Text>
            </View>
            <View className="flex-row gap-2">
              <TouchableOpacity
                className="bg-white/10 px-3 py-1 rounded-lg"
                onPress={() => handlePickImage(view)}
              >
                <Text className="text-white text-sm">Change</Text>
              </TouchableOpacity>
              {allBackgrounds[view] && (
                <TouchableOpacity
                  className="bg-red-600/20 px-3 py-1 rounded-lg"
                  onPress={() => handleRemove(view)}
                >
                  <Trash2 size={16} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
