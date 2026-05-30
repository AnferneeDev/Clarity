const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

async function getToken(): Promise<string | null> {
  try {
    const { getItemAsync } = await import('expo-secure-store');
    return await getItemAsync('clarity_token');
  } catch { return null; }
}

async function request(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const url = `${API_BASE}${path}`;

  if (__DEV__) {
    console.log(`[API] → ${options.method || 'GET'} ${url}`, {
      hasToken: !!token,
      body: options.body ? JSON.parse(options.body as string) : undefined,
    });
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    },
  });

  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    if (__DEV__) console.error(`[API] ← ${res.status} ${path}`, data);
    throw new Error(data.error || data.raw || res.statusText);
  }

  if (__DEV__) {
    console.log(`[API] ← ${res.status} ${path}`, Array.isArray(data) ? `${data.length} items` : typeof data === 'object' ? Object.keys(data).join(', ') : data);
  }
  return data;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    getSession: () =>
      request('/auth/session'),
  },
  timer: {
    saveSession: (subjectName: string, date: string, minutes: number) =>
      request('/timer/sessions', { method: 'POST', body: JSON.stringify({ subjectName, date, minutes }) }),
    startTimer: (subjectName: string, expectedDuration: number, phase: string) =>
      request('/timer/start', { method: 'POST', body: JSON.stringify({ subjectName, expectedDuration, phase }) }),
    stopTimer: () =>
      request('/timer/stop', { method: 'POST' }),
    getActiveTimer: () =>
      request('/timer/active'),
    getSubjectTotals: (start?: string, end?: string) => {
      const params = new URLSearchParams();
      if (start) params.set('start', start);
      if (end) params.set('end', end);
      return request(`/timer/stats?${params}`);
    },
    getSubjects: () =>
      request('/timer/subjects'),
    getSubjectDateAggregated: (start?: string, end?: string) => {
      const params = new URLSearchParams();
      if (start) params.set('start', start);
      if (end) params.set('end', end);
      params.set('group', 'date');
      return request(`/timer/stats?${params}`);
    },
    addSubject: (name: string) =>
      request('/timer/subjects', { method: 'POST', body: JSON.stringify({ name }) }),
    hideSubject: (name: string) =>
      request('/timer/subjects', { method: 'POST', body: JSON.stringify({ name, hidden: true }) }),
    deleteSubject: (name: string) =>
      request('/timer/subjects', { method: 'DELETE', body: JSON.stringify({ name }) }),
    deleteSubjectCompletely: (name: string) =>
      request('/timer/subjects/completely', { method: 'DELETE', body: JSON.stringify({ name }) }),
  },
  tasks: {
    getAll: () => request('/tasks'),
    add: (task: { text: string; starred?: boolean; due_date?: string }) =>
      request('/tasks', { method: 'POST', body: JSON.stringify(task) }),
    update: (id: number, updates: Record<string, unknown>) =>
      request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
    delete: (id: number) =>
      request(`/tasks/${id}`, { method: 'DELETE' }),
  },
  notes: {
    getAll: () => request('/notes'),
    add: (note: { title: string; content?: string; color?: string }) =>
      request('/notes', { method: 'POST', body: JSON.stringify(note) }),
    update: (id: number, updates: Record<string, unknown>) =>
      request(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
    delete: (id: number) =>
      request(`/notes/${id}`, { method: 'DELETE' }),
  },
  settings: {
    getPreferences: () => request('/preferences'),
    updatePreferences: (updates: Record<string, unknown>) =>
      request('/preferences', { method: 'PUT', body: JSON.stringify(updates) }),
  },
};
