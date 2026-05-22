import '../global.css';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/hooks/useAuth';
import { AccentColorProvider } from '@/context/AccentColor';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AccentColorProvider>
          <Slot />
        </AccentColorProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
