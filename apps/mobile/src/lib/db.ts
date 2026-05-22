import { getLocalDateString } from './utils';

let dbInstance: any = null;

async function getDb() {
  if (dbInstance) return dbInstance;
  const { openDatabaseAsync } = await import('expo-sqlite');
  dbInstance = await openDatabaseAsync('clarity.db');
  await migrate(dbInstance);
  return dbInstance;
}

async function migrate(db: any) {
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subject_name TEXT NOT NULL,
      date TEXT NOT NULL,
      minutes REAL NOT NULL DEFAULT 0,
      synced INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, subject_name, date)
    )
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, name)
    )
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      starred INTEGER NOT NULL DEFAULT 0,
      due_date TEXT,
      synced INTEGER NOT NULL DEFAULT 0,
      pending_action TEXT
    )
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#6366f1',
      synced INTEGER NOT NULL DEFAULT 0,
      pending_action TEXT
    )
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS backgrounds (
      view_name TEXT PRIMARY KEY,
      data TEXT NOT NULL
    )
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_metadata (
      table_name TEXT PRIMARY KEY,
      last_synced_at INTEGER NOT NULL DEFAULT 0
    )
  `);
}

export async function getLastSync(table: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ last_synced_at: number }>(
    'SELECT last_synced_at FROM sync_metadata WHERE table_name = ?',
    [table]
  );
  return row?.last_synced_at || 0;
}

export async function setLastSync(table: string, timestamp: number) {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO sync_metadata (table_name, last_synced_at) VALUES (?, ?)',
    [table, timestamp]
  );
}

// ---- Sessions ----

export async function upsertSession(userId: string, subjectName: string, date: string, minutes: number) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO sessions (id, user_id, subject_name, date, minutes, synced)
     VALUES (?, ?, ?, ?, ?, 0)
     ON CONFLICT(user_id, subject_name, date)
     DO UPDATE SET minutes = sessions.minutes + excluded.minutes, synced = 0`,
    [`${userId}_${subjectName}_${date}`, userId, subjectName.toLowerCase().trim(), date, minutes]
  );
}

export async function getSessionTotals(userId: string, start?: string, end?: string) {
  const db = await getDb();
  const rows = await db.getAllAsync<{ subject_name: string; total: number }>(
    `SELECT subject_name, SUM(minutes) as total
     FROM sessions WHERE user_id = ? ${start ? 'AND date >= ?' : ''} ${end ? 'AND date <= ?' : ''}
     GROUP BY subject_name ORDER BY total DESC`,
    [userId, ...(start ? [start] : []), ...(end ? [end] : [])]
  );
  return rows.map(r => ({ subject: r.subject_name, total_minutes: r.total }));
}

export async function getSessionDateAggregated(userId: string, start?: string, end?: string) {
  const db = await getDb();
  const rows = await db.getAllAsync<{ subject_name: string; date: string; minutes: number }>(
    `SELECT subject_name, date, MIN(minutes) as minutes
     FROM sessions WHERE user_id = ? ${start ? 'AND date >= ?' : ''} ${end ? 'AND date <= ?' : ''}
     ORDER BY date DESC`,
    [userId, ...(start ? [start] : []), ...(end ? [end] : [])]
  );
  return rows.map(r => ({ subject: r.subject_name, date: r.date, total_minutes: r.minutes }));
}

export async function getUnsyncedSessions(userId: string) {
  const db = await getDb();
  return db.getAllAsync<{ subject_name: string; date: string; minutes: number }>(
    'SELECT subject_name, date, minutes FROM sessions WHERE user_id = ? AND synced = 0',
    [userId]
  );
}

export async function markSessionsSynced(userId: string, subjectName: string, date: string) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE sessions SET synced = 1 WHERE user_id = ? AND subject_name = ? AND date = ?',
    [userId, subjectName, date]
  );
}

// ---- Subjects ----

export async function getSubjects(userId: string) {
  const db = await getDb();
  return db.getAllAsync<{ id: string; name: string; is_hidden: number }>(
    'SELECT id, name, is_hidden FROM subjects WHERE user_id = ? ORDER BY name',
    [userId]
  );
}

export async function upsertSubject(userId: string, id: string, name: string, isHidden: boolean) {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO subjects (id, user_id, name, is_hidden) VALUES (?, ?, ?, ?)',
    [id, userId, name.toLowerCase().trim(), isHidden ? 1 : 0]
  );
}

export async function replaceSubjects(userId: string, subjects: Array<{ id: string; name: string; is_hidden: boolean }>) {
  const db = await getDb();
  await db.runAsync('DELETE FROM subjects WHERE user_id = ?', [userId]);
  for (const s of subjects) {
    await upsertSubject(userId, s.id, s.name, s.is_hidden);
  }
}

// ---- Tasks ----

export async function getTasks(userId: string) {
  const db = await getDb();
  return db.getAllAsync<{ id: number; text: string; done: number; starred: number; due_date: string | null; synced: number; pending_action: string | null }>(
    'SELECT * FROM tasks WHERE user_id = ? ORDER BY starred DESC, done ASC, id DESC',
    [userId]
  );
}

export async function upsertTask(userId: string, task: { id?: number; text: string; done?: boolean; starred?: boolean; due_date?: string | null }) {
  const db = await getDb();
  if (task.id) {
    const fields: string[] = [];
    const values: any[] = [];
    if (task.text !== undefined) { fields.push('text = ?'); values.push(task.text); }
    if (task.done !== undefined) { fields.push('done = ?'); values.push(task.done ? 1 : 0); }
    if (task.starred !== undefined) { fields.push('starred = ?'); values.push(task.starred ? 1 : 0); }
    if (task.due_date !== undefined) { fields.push('due_date = ?'); values.push(task.due_date); }
    fields.push('synced = 0');
    fields.push("pending_action = 'update'");
    values.push(task.id);
    await db.runAsync(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, values);
  } else {
    await db.runAsync(
      `INSERT INTO tasks (user_id, text, done, starred, due_date, synced, pending_action)
       VALUES (?, ?, ?, ?, ?, 0, 'create')`,
      [userId, task.text, task.done ? 1 : 0, task.starred ? 1 : 0, task.due_date || null]
    );
  }
}

export async function deleteTaskLocally(taskId: number) {
  const db = await getDb();
  await db.runAsync("UPDATE tasks SET synced = 0, pending_action = 'delete' WHERE id = ?", [taskId]);
}

export async function removeSyncedTask(taskId: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM tasks WHERE id = ?', [taskId]);
}

export async function replaceTasks(userId: string, tasks: Array<{ id: number; text: string; done: boolean; starred: boolean; due_date: string | null }>) {
  const db = await getDb();
  const existing = await getUnsyncedTasks(userId);
  const existingIds = new Set(existing.map(t => t.id));
  await db.runAsync('DELETE FROM tasks WHERE user_id = ?', [userId]);
  for (const t of tasks) {
    if (existingIds.has(t.id)) continue;
    await db.runAsync(
      'INSERT INTO tasks (id, user_id, text, done, starred, due_date, synced, pending_action) VALUES (?, ?, ?, ?, ?, ?, 1, NULL)',
      [t.id, userId, t.text, t.done ? 1 : 0, t.starred ? 1 : 0, t.due_date || null]
    );
  }
}

async function getUnsyncedTasks(userId: string) {
  const db = await getDb();
  return db.getAllAsync<{ id: number }>(
    'SELECT id FROM tasks WHERE user_id = ? AND synced = 0',
    [userId]
  );
}

// ---- Notes ----

export async function getNotes(userId: string) {
  const db = await getDb();
  return db.getAllAsync<{ id: number; title: string; content: string; color: string; synced: number; pending_action: string | null }>(
    'SELECT * FROM notes WHERE user_id = ? ORDER BY id DESC',
    [userId]
  );
}

export async function upsertNote(userId: string, note: { id?: number; title?: string; content?: string; color?: string }) {
  const db = await getDb();
  if (note.id) {
    const fields: string[] = [];
    const values: any[] = [];
    if (note.title !== undefined) { fields.push('title = ?'); values.push(note.title); }
    if (note.content !== undefined) { fields.push('content = ?'); values.push(note.content); }
    if (note.color !== undefined) { fields.push('color = ?'); values.push(note.color); }
    fields.push('synced = 0');
    fields.push("pending_action = 'update'");
    values.push(note.id);
    await db.runAsync(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`, values);
  } else {
    await db.runAsync(
      `INSERT INTO notes (user_id, title, content, color, synced, pending_action)
       VALUES (?, ?, ?, ?, 0, 'create')`,
      [userId, note.title || '', note.content || '', note.color || '#6366f1']
    );
  }
}

export async function deleteNoteLocally(noteId: number) {
  const db = await getDb();
  await db.runAsync("UPDATE notes SET synced = 0, pending_action = 'delete' WHERE id = ?", [noteId]);
}

export async function removeSyncedNote(noteId: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM notes WHERE id = ?', [noteId]);
}

export async function replaceNotes(userId: string, notes: Array<{ id: number; title: string; content: string; color: string }>) {
  const db = await getDb();
  const existing = await getUnsyncedNotes(userId);
  const existingIds = new Set(existing.map(n => n.id));
  await db.runAsync('DELETE FROM notes WHERE user_id = ?', [userId]);
  for (const n of notes) {
    if (existingIds.has(n.id)) continue;
    await db.runAsync(
      'INSERT INTO notes (id, user_id, title, content, color, synced, pending_action) VALUES (?, ?, ?, ?, ?, 1, NULL)',
      [n.id, userId, n.title, n.content, n.color]
    );
  }
}

async function getUnsyncedNotes(userId: string) {
  const db = await getDb();
  return db.getAllAsync<{ id: number }>(
    'SELECT id FROM notes WHERE user_id = ? AND synced = 0',
    [userId]
  );
}

// ---- Preferences ----

export async function getPreference(key: string, fallback: string = ''): Promise<string> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM preferences WHERE key = ?',
    [key]
  );
  return row?.value || fallback;
}

export async function setPreference(key: string, value: string) {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)',
    [key, value]
  );
}

export async function getAllPreferences(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM preferences'
  );
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

// ---- Backgrounds ----

export async function getBackground(viewName: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>(
    'SELECT data FROM backgrounds WHERE view_name = ?',
    [viewName]
  );
  return row?.data || null;
}

export async function setBackground(viewName: string, data: string) {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO backgrounds (view_name, data) VALUES (?, ?)',
    [viewName, data]
  );
}

export async function removeBackground(viewName: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM backgrounds WHERE view_name = ?', [viewName]);
}

export async function getAllBackgrounds(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ view_name: string; data: string }>(
    'SELECT view_name, data FROM backgrounds'
  );
  const map: Record<string, string> = {};
  for (const r of rows) map[r.view_name] = r.data;
  return map;
}
