export {};

declare global {
  interface Window {
    electronAPI: {
      // Core Notification
      notify: (title: string, body: string) => Promise<any>;
      playSound: (sound: string) => Promise<any>;
      setTrayState: (state: "active" | "idle") => Promise<any>;

      // Auth
      auth: {
        login: (u: string, p: string) => Promise<{ id: string; username: string } | null>;
        register: (u: string, p: string) => Promise<{ id: string; username: string } | { error: string }>;
        verify: (id: string) => Promise<any>;
        logout: () => Promise<boolean>;
      };

      // Timer & Subjects
      timerDb: {
        getAllSubjects: () => Promise<string[]>;
        checkIfSubjectExists: (name: string) => Promise<boolean>;
        addOrUpdateTimerData: (subject: string, date: string, minutes: number) => Promise<any>;
        addSubject: (name: string) => Promise<any>;
        hideSubject: (name: string) => Promise<any>;
        unhideSubject: (name: string) => Promise<any>;
        deleteSubjectCompletely: (name: string) => Promise<any>;
        getSubjectTotalsByDateRange: (start?: string, end?: string) => Promise<any[]>;
        getDailyAggregatedData: (start?: string, end?: string) => Promise<any[]>;
        getSubjectDateAggregatedData: (start?: string, end?: string) => Promise<any[]>;
      };

      // Todos
      getAllTodos: () => Promise<any[]>;
      addTodo: (todo: { text: string; done?: boolean; starred?: boolean; dueDate?: string }) => Promise<any>;
      updateTodo: (id: number, updates: any) => Promise<any>;
      deleteTodo: (id: number) => Promise<any>;

      // Generic DB (Notes)
      query: (table: string) => Promise<any[]>;
      insert: (table: string, data: any) => Promise<any>;
      update: (table: string, id: number, data: any) => Promise<any>;
      remove: (table: string, id: number) => Promise<any>;

      // Backgrounds
      setViewBackground: (view: string, file: { name: string; data: Uint8Array }) => Promise<any>;
      getViewBackground: (view: string) => Promise<string | null>;
      getViewBackgroundData: (view: string) => Promise<string | null>;
      getAllBackgrounds: () => Promise<Record<string, string>>;
      removeViewBackground: (view: string) => Promise<boolean>;

      // Chapters
      chapters: {
        getAll: () => Promise<any[]>;
        add: (chapter: { title: string; coverImage?: string; icon?: string; clear: boolean }) => Promise<any>;
        update: (id: string, updates: any) => Promise<boolean>;
        delete: (id: string) => Promise<boolean>;
        uploadImage: (file: { name: string; data: Uint8Array }) => Promise<string | null>;
        getImage: (path: string) => Promise<string | null>;
      };
    };
  }

  // Assets
  declare module "*.ico";
  declare module "*.jpg";
  declare module "*.jpeg";
  declare module "*.png";
  declare module "*.svg";
  declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
  declare const MAIN_WINDOW_VITE_NAME: string | undefined;
}
