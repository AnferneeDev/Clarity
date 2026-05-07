import { useState, useEffect, createContext, useContext, useCallback } from 'react';

interface User {
  id: string;
  email: string;
  username: string;
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
    const restore = async () => {
      try {
        const session = await window.electronAPI.auth.getSession();
        if (session) {
          setUser({ id: session.id, email: session.email, username: session.username });
        }
      } catch (err) {
        console.error('[Auth] Session restore failed:', err);
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await window.electronAPI.auth.login(email, password);
    if (result.success && result.user) {
      setUser({ id: result.user.id, email: result.user.email, username: result.user.username });
      return { success: true };
    }
    return { success: false, error: result.error || 'Login failed' };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const result = await window.electronAPI.auth.signUp(email, password);
    if (result.success && result.user) {
      return { success: true };
    }
    return { success: false, error: result.error || 'Sign up failed' };
  }, []);

  const logout = useCallback(async () => {
    await window.electronAPI.auth.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signUp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
