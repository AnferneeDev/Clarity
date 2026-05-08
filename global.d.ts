export {};

declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      auth: {
        login: (email: string, password: string) => Promise<{
          success: boolean;
          error?: string;
          user?: { id: string; email: string; username: string };
        }>;
        signUp: (email: string, password: string) => Promise<{
          success: boolean;
          error?: string;
          user?: { id: string; email: string };
        }>;
        logout: () => Promise<{ success: boolean }>;
        getSession: () => Promise<{
          id: string;
          email: string;
          username: string;
          avatar_url: string | null;
        } | null>;
        oauth: (provider: string) => Promise<{ success: boolean; error?: string; message?: string }>;
        onOAuthComplete: (callback: (result: { success: boolean; error?: string }) => void) => () => void;
      };
      timer: {
        getSubjects: () => Promise<Array<{
          id: string;
          name: string;
          is_hidden: boolean;
          created_at: string;
        }>>;
        addSubject: (name: string) => Promise<unknown>;
        hideSubject: (name: string) => Promise<void>;
        deleteSubject: (name: string) => Promise<void>;
        deleteSubjectCompletely: (name: string) => Promise<void>;
        saveSession: (subjectName: string, date: string, minutes: number) => Promise<{ success: boolean }>;
        getSubjectTotals: (startDate?: string, endDate?: string) => Promise<Array<{
          subject: string;
          total_minutes: number;
        }>>;
        getDailyAggregate: (startDate?: string, endDate?: string) => Promise<Array<{
          date: string;
          total_minutes: number;
          subjects: string[];
        }>>;
        getSubjectDateAggregated: (startDate?: string, endDate?: string) => Promise<Array<{
          subject: string;
          date: string;
          total_minutes: number;
        }>>;
      };
      tasks: {
        getAll: () => Promise<Array<{ id: number; user_id: string; text: string; done: boolean; starred: boolean; due_date: string | null; created_at: string; updated_at: string }>>;
        add: (task: { text: string; starred?: boolean; due_date?: string }) => Promise<unknown>;
        update: (id: number, updates: Record<string, unknown>) => Promise<{ success: boolean }>;
        delete: (id: number) => Promise<{ success: boolean }>;
      };
      notes: {
        getAll: () => Promise<Array<{ id: number; user_id: string; title: string; content: string; color: string; created_at: string; updated_at: string }>>;
        add: (note: { title: string; content?: string; color?: string }) => Promise<unknown>;
        update: (id: number, updates: Record<string, unknown>) => Promise<{ success: boolean }>;
        delete: (id: number) => Promise<{ success: boolean }>;
      };
      settings: {
        getBackground: (viewName: string) => Promise<string | null>;
        getAllBackgrounds: () => Promise<Record<string, string>>;
        setBackground: (viewName: string, file: { name: string; data: Uint8Array }) => Promise<string | null>;
        removeBackground: (viewName: string) => Promise<void>;
        getPreferences: () => Promise<unknown>;
        updatePreferences: (updates: Record<string, unknown>) => Promise<void>;
      };
      app: {
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        close: () => Promise<void>;
        setTrayState: (state: 'active' | 'idle') => Promise<void>;
      };
    };
  }

  declare module '*.ico';
  declare module '*.jpg';
  declare module '*.jpeg';
  declare module '*.png';
  declare module '*.svg';
  declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
  declare const MAIN_WINDOW_VITE_NAME: string | undefined;
}
