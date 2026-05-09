import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { restoreSession, signIn, signUp, signOut } from '@/lib/auth';

interface User {
  id: string;
  email: string;
  username?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    restoreSession().then(session => {
      if (session) setUser(session);
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await signIn(email, password);
    if (result.success && result.user) {
      setUser({ id: result.user.id, email: result.user.email });
      return { success: true };
    }
    return { success: false, error: result.error || 'Login failed' };
  }, []);

  const signUpFn = useCallback(async (email: string, password: string) => {
    const result = await signUp(email, password);
    return { success: result.success, error: result.error };
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signUp: signUpFn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
