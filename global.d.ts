// src/global.d.ts
export {};

declare global {
  interface Window {
    electronAPI: {
      notify: (title: string, body: string) => Promise<any>;
      getDashboardData: (date?: string) => Promise<any>;

      startSession: (subjectId: number | string) => Promise<any>;
      completeSession: (sessionId: number | string, durationMinutes: number, pausedSeconds: number) => Promise<any>;
      getAllSessions: () => Promise<any[]>;
      removeSubjectTotal: (subjectName: string) => Promise<boolean>;
      query: (table: string, where?: any, options?: any) => Promise<any[]>;
      insert: (table: string, data: any) => Promise<any>;
      update: (table: string, id: number | string, data: any) => Promise<any>;
      remove: (table: string, id: number | string) => Promise<any>;

      getTodosByDate: (date: string) => Promise<any[]>;
      addTodo: (todo: { date: string; text: string; subjectId?: number; starred?: boolean; dueDate?: string }) => Promise<any>;
      updateTodo: (id: number | string, updates: { done?: boolean; starred?: boolean; text?: string; dueDate?: string }) => Promise<any>;
      deleteTodo: (id: number | string) => Promise<any>;
      getStarredTodos: () => Promise<any[]>;

      getSubjectTimeStats: (startDate?: string, endDate?: string) => Promise<any[]>;
      getSessionsForMonth: (year: number, month: number) => Promise<any[]>;

      setViewBackground: (view: string, file: { name: string; data: Uint8Array }) => Promise<any>;
      getViewBackground: (view: string) => Promise<string | null>;
      getViewBackgroundData: (view: string) => Promise<string | null>;
      getAllBackgrounds: () => Promise<Record<string, string>>;
      removeViewBackground: (view: string) => Promise<boolean>;
    };
  }

  // asset modules + Vite constants you used earlier
  declare module "*.ico";
  declare module "*.jpg";
  declare module "*.jpeg";
  declare module "*.png";
  declare module "*.svg";
  declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
  declare const MAIN_WINDOW_VITE_NAME: string | undefined;
}
