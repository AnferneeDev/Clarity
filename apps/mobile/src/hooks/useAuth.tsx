import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { signIn, signUp, signOut, restoreSession } from '@/lib/auth';

interface User {
  id: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error: string | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  signUp: async () => ({ success: false, error: null }),
  logout: async () => {},
});

async function setupNotifications() {
  try {
    const Notifications = await import('expo-notifications');
    // Set handler so notifications display while the app is in the foreground
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Create Android notification channel (required for Android 8+)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('timer', {
        name: 'Timer Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#a78bfa',
      });
    }
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setupNotifications();
    const restore = async () => {
      try {
        const session = await restoreSession();
        if (session) {
          setUser(session);
        }
      } catch {} finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await signIn(email, password);
    setUser(u.user);
  }, []);

  const signUpHandler = useCallback(async (email: string, password: string) => {
    try {
      await signUp(email, password);
      return { success: true, error: null };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signUp: signUpHandler, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
