const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'migration_data.json');
const outputPath = path.join(__dirname, 'migration_script.sql');

if (!fs.existsSync(inputPath)) {
  console.error(`Error: Could not find ${inputPath}. Please save your query result to this file.`);
  process.exit(1);
}

try {
  const dataRaw = fs.readFileSync(inputPath, 'utf-8');
  let payload = JSON.parse(dataRaw);
  
  if (Array.isArray(payload)) {
    payload = payload[0];
  }
  
  const data = payload.json_build_object;
  const targetUid = 'b405465d-5de6-423b-8620-92194848e15c';

  const sqlLines = [
    '-- ===========================================================================',
    '-- Data Migration Script for Clarity',
    '-- Old User ID: 09486efd-7e63-47c3-9449-7adb6abdef8f',
    `-- New User ID: ${targetUid}`,
    "-- Execute this in your New Supabase project's SQL Editor",
    '-- ===========================================================================',
    ''
  ];

  function escapeSql(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'number') return val.toString();
    return "'" + String(val).replace(/'/g, "''") + "'";
  }

  // 1. Profiles
  if (data.profiles && data.profiles.length > 0) {
    const p = data.profiles[0];
    sqlLines.push('-- Update profile if it exists');
    sqlLines.push(`UPDATE app.profiles SET full_name = ${escapeSql(p.full_name)} WHERE id = '${targetUid}';\n`);
  }

  // 2. Subjects
  if (data.subjects && data.subjects.length > 0) {
    sqlLines.push('-- Insert Subjects');
    for (const s of data.subjects) {
      sqlLines.push(`INSERT INTO app.subjects (user_id, name, is_hidden, created_at) VALUES ('${targetUid}', ${escapeSql(s.name)}, ${escapeSql(s.is_hidden)}, ${escapeSql(s.created_at)}) ON CONFLICT (user_id, name) DO NOTHING;`);
    }
    sqlLines.push('');
  }

  // 3. Sessions
  if (data.sessions && data.sessions.length > 0) {
    sqlLines.push('-- Insert Sessions');
    for (const s of data.sessions) {
      // old database might not have minutes if it was different, handle accordingly
      sqlLines.push(`INSERT INTO app.sessions (user_id, subject_name, date, minutes, created_at) VALUES ('${targetUid}', ${escapeSql(s.subject_name)}, ${escapeSql(s.date)}, ${escapeSql(s.minutes || 0)}, ${escapeSql(s.created_at)}) ON CONFLICT ON CONSTRAINT sessions_user_subject_date_uniq DO UPDATE SET minutes = app.sessions.minutes + EXCLUDED.minutes;`);
    }
    sqlLines.push('');
  }

  // 4. Tasks (from old 'todos')
  if (data.todos && data.todos.length > 0) {
    sqlLines.push('-- Insert Tasks (mapped from old todos)');
    for (const t of data.todos) {
      const text = escapeSql(t.content || t.text || 'Imported Task');
      const done = escapeSql(t.is_completed || t.done || false);
      const createdAt = escapeSql(t.created_at);
      sqlLines.push(`INSERT INTO app.tasks (user_id, text, done, created_at, updated_at) VALUES ('${targetUid}', ${text}, ${done}, ${createdAt}, ${createdAt});`);
    }
    sqlLines.push('');
  }

  // 5. Notes
  if (data.notes && data.notes.length > 0) {
    sqlLines.push('-- Insert Notes');
    for (const n of data.notes) {
      sqlLines.push(`INSERT INTO app.notes (user_id, title, content, color, created_at, updated_at) VALUES ('${targetUid}', ${escapeSql(n.title)}, ${escapeSql(n.content)}, ${escapeSql(n.color || '#ffffff')}, ${escapeSql(n.created_at)}, ${escapeSql(n.created_at)});`);
    }
    sqlLines.push('');
  }

  fs.writeFileSync(outputPath, sqlLines.join('\n'));
  console.log(`Successfully generated migration script at: ${outputPath}`);

} catch (err) {
  console.error('Error generating migration script:', err.message);
}
