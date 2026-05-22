import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { signIn, signUp, signOut, restoreSession } from '@/lib/auth';
import { fullSync, startBackgroundSync, stopBackgroundSync } from '@/lib/sync';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      try {
        const session = await restoreSession();
        if (session) {
          setUser(session);
          await fullSync(session.id);
          startBackgroundSync(session.id);
        }
      } catch {} finally {
        setIsLoading(false);
      }
    };
    restore();
    return () => { stopBackgroundSync(); };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await signIn(email, password);
    setUser(u.user);
    await fullSync(u.user.id);
    startBackgroundSync(u.user.id);
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
    stopBackgroundSync();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signUp: signUpHandler, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
