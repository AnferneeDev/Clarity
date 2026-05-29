let dbInstance: any = null;
let dbInitPromise: Promise<any> | null = null;

export async function getDb() {
  if (dbInstance) return dbInstance;
  if (dbInitPromise) return dbInitPromise;
  dbInitPromise = (async () => {
    const { openDatabaseAsync } = await import('expo-sqlite');
    const db = await openDatabaseAsync('clarity.db');
    await db.execAsync('PRAGMA journal_mode = WAL');
    await db.execAsync('CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    await db.execAsync('CREATE TABLE IF NOT EXISTS backgrounds (view_name TEXT PRIMARY KEY, data TEXT NOT NULL)');
    dbInstance = db;
    dbInitPromise = null;
    return db;
  })();
  return dbInitPromise;
}

export async function getPreference(key: string, fallback: string = ''): Promise<string> {
  const db = await getDb();
  const row = (await db.getFirstAsync('SELECT value FROM preferences WHERE key = ?', [key])) as { value: string } | null;
  return row?.value || fallback;
}

export async function setPreference(key: string, value: string) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)', [key, value]);
}

export async function getAllPreferences(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = (await db.getAllAsync('SELECT key, value FROM preferences')) as Array<{ key: string; value: string }>;
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export async function getBackground(viewName: string): Promise<string | null> {
  const db = await getDb();
  const row = (await db.getFirstAsync('SELECT data FROM backgrounds WHERE view_name = ?', [viewName])) as { data: string } | null;
  return row?.data || null;
}

export async function setBackground(viewName: string, data: string) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO backgrounds (view_name, data) VALUES (?, ?)', [viewName, data]);
}

export async function removeBackground(viewName: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM backgrounds WHERE view_name = ?', [viewName]);
}

export async function getAllBackgrounds(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = (await db.getAllAsync('SELECT view_name, data FROM backgrounds')) as Array<{ view_name: string; data: string }>;
  const map: Record<string, string> = {};
  for (const r of rows) map[r.view_name] = r.data;
  return map;
}
