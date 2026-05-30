import { createClient } from '@supabase/supabase-js';

function response(code, body) {
  return {
    statusCode: code,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function log(level, msg, data) {
  console[level](JSON.stringify({ level, timestamp: new Date().toISOString(), message: msg, ...(data || {}) }));
}

/** Decode user UUID from Supabase JWT (zero cost, no API call) */
function getUserIdFromJwt(jwt) {
  try {
    const payload = jwt.split('.')[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
    return decoded.sub || null;
  } catch { return null; }
}

export const handler = async (event) => {
  const rawPath = event.requestContext?.http?.path || '';
  const path = rawPath.startsWith('/api') ? rawPath.slice(4) : rawPath;
  const method = event.requestContext?.http?.method || 'GET';

  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  const jwt = auth.replace('Bearer ', '');
  if (!jwt) return response(401, { error: 'Unauthorized' });

  const userId = getUserIdFromJwt(jwt);
  if (!userId) return response(401, { error: 'Invalid token' });

  // Per-request Supabase client with user JWT — RLS enforced automatically
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      db: { schema: "app" },
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    }
  );

  try {
    if (method === 'POST' && path === '/timer/sessions') {
      let subjectName, date, minutes;
      try {
        ({ subjectName, date, minutes } = JSON.parse(event.body || '{}'));
      } catch {
        return response(400, { error: 'Invalid JSON body' });
      }

      if (!subjectName || typeof subjectName !== 'string') return response(400, { error: 'subjectName required' });
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return response(400, { error: 'date must be YYYY-MM-DD' });
      if (typeof minutes !== 'number' || minutes <= 0 || minutes > 600) return response(400, { error: 'minutes must be 0-600' });

      // Ensure subject exists
      log('info', `Received saveSession request`, { userId, subjectName, date, minutes });
      await supabase.from('subjects').upsert({
        user_id: userId, name: subjectName.toLowerCase().trim(), is_hidden: false,
      }, { onConflict: 'user_id,name' });

      // Atomic upsert via RPC
      const { error } = await supabase.rpc('upsert_session', {
        p_subject_name: subjectName.toLowerCase().trim(),
        p_date: date,
        p_minutes: minutes,
      });
      if (error) {
        log('error', 'Session save failed', { error: error.message });
        return response(500, { error: error.message });
      }

      log('info', `Session save succeeded`, { subjectName, minutes });
      return response(200, { success: true });
    }

    if (method === 'GET' && path === '/timer/stats') {
      const start = event.queryStringParameters?.start;
      const end = event.queryStringParameters?.end;
      const group = event.queryStringParameters?.group;

      let q = supabase.from('sessions').select('subject_name,date,minutes').limit(10000);
      if (start) q = q.gte('date', start);
      if (end) q = q.lte('date', end);

      const { data } = await q;
      const rows = data || [];

      if (group === 'date') {
        // Group by subject AND date
        const dateTotals = {};
        for (const row of rows) {
          const key = `${row.date}_${row.subject_name}`;
          if (!dateTotals[key]) {
            dateTotals[key] = { subject: row.subject_name, date: row.date, total_minutes: 0 };
          }
          dateTotals[key].total_minutes += row.minutes;
        }
        return response(200, Object.values(dateTotals));
      }

      // Default: Group by subject only
      const totals = {};
      for (const row of rows) {
        totals[row.subject_name] = (totals[row.subject_name] || 0) + row.minutes;
      }
      return response(200, Object.entries(totals).map(([subject, total_minutes]) => ({ subject, total_minutes })));
    }

    if (method === 'GET' && path === '/timer/subjects') {
      const { data } = await supabase.from('subjects').select('id,name,is_hidden').order('name');
      return response(200, data || []);
    }

    if (method === 'POST' && path === '/timer/subjects') {
      let name, hidden;
      try {
        ({ name, hidden } = JSON.parse(event.body || '{}'));
      } catch {
        return response(400, { error: 'Invalid JSON body' });
      }
      if (!name || typeof name !== 'string') return response(400, { error: 'name required' });

      const normalized = name.toLowerCase().trim();
      const { error } = await supabase.from('subjects').upsert(
        { user_id: userId, name: normalized, is_hidden: hidden === true },
        { onConflict: 'user_id,name' }
      );
      if (error) {
        log('error', 'Subject upsert failed', { error: error.message });
        return response(500, { error: error.message });
      }
      return response(200, { success: true });
    }

    if (method === 'DELETE' && path === '/timer/subjects') {
      let name;
      try {
        ({ name } = JSON.parse(event.body || '{}'));
      } catch {
        return response(400, { error: 'Invalid JSON body' });
      }
      if (!name || typeof name !== 'string') return response(400, { error: 'name required' });

      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('user_id', userId)
        .eq('name', name.toLowerCase().trim());
      if (error) {
        log('error', 'Subject delete failed', { error: error.message });
        return response(500, { error: error.message });
      }
      return response(200, { success: true });
    }

    if (method === 'DELETE' && path === '/timer/subjects/completely') {
      let name;
      try {
        ({ name } = JSON.parse(event.body || '{}'));
      } catch {
        return response(400, { error: 'Invalid JSON body' });
      }
      if (!name || typeof name !== 'string') return response(400, { error: 'name required' });

      const normalized = name.toLowerCase().trim();
      
      const { error: sessionError } = await supabase
        .from('sessions')
        .delete()
        .eq('user_id', userId)
        .eq('subject_name', normalized);
        
      if (sessionError) {
        log('error', 'Session cascade delete failed', { error: sessionError.message });
      }

      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('user_id', userId)
        .eq('name', normalized);
        
      if (error) {
        log('error', 'Subject delete completely failed', { error: error.message });
        return response(500, { error: error.message });
      }
      return response(200, { success: true });
    }

    if (method === 'POST' && path === '/timer/start') {
      let subjectName, expectedDuration, phase;
      try {
        ({ subjectName, expectedDuration, phase } = JSON.parse(event.body || '{}'));
      } catch {
        return response(400, { error: 'Invalid JSON body' });
      }
      if (!subjectName || typeof subjectName !== 'string') return response(400, { error: 'subjectName required' });
      
      const expDur = expectedDuration || 25;
      const phs = phase || 'focus';

      // Ensure subject exists
      await supabase.from('subjects').upsert({
        user_id: userId, name: subjectName.toLowerCase().trim(), is_hidden: false,
      }, { onConflict: 'user_id,name' });

      const { error } = await supabase.from('active_timers').upsert({
        user_id: userId,
        subject_name: subjectName.toLowerCase().trim(),
        started_at: new Date().toISOString(),
        expected_duration_minutes: expDur,
        phase: phs
      }, { onConflict: 'user_id' });

      if (error) {
        log('error', 'Failed to start active timer', { error: error.message });
        return response(500, { error: error.message });
      }
      return response(200, { success: true });
    }

    if (method === 'POST' && path === '/timer/stop') {
      const { data: activeTimers, error: fetchError } = await supabase
        .from('active_timers')
        .select('*')
        .eq('user_id', userId);

      if (fetchError || !activeTimers || activeTimers.length === 0) {
        return response(200, { success: true, message: 'No active timer found' });
      }
      const timer = activeTimers[0];

      const startedAt = new Date(timer.started_at);
      const now = new Date();
      let diffMinutes = (now - startedAt) / (1000 * 60);

      // Cap at expected duration + 5 mins grace
      const maxMinutes = timer.expected_duration_minutes + 5;
      if (diffMinutes > maxMinutes) diffMinutes = maxMinutes;
      if (diffMinutes < 0.1) diffMinutes = 0;

      await supabase.from('active_timers').delete().eq('user_id', userId);

      if (timer.phase === 'focus' && diffMinutes >= 0.1) {
        const dateStr = startedAt.toISOString().split('T')[0];
        const { error: upsertError } = await supabase.rpc('upsert_session', {
          p_subject_name: timer.subject_name,
          p_date: dateStr,
          p_minutes: diffMinutes,
        });
        if (upsertError) {
          log('error', 'Session save failed on stop', { error: upsertError.message });
          return response(500, { error: upsertError.message });
        }
        log('info', 'Session saved on stop', { subject_name: timer.subject_name, minutes: diffMinutes, started_at: timer.started_at, now: now.toISOString() });
      }
      return response(200, { success: true, savedMinutes: diffMinutes });
    }

    if (method === 'GET' && path === '/timer/active') {
      const { data: activeTimers, error } = await supabase
        .from('active_timers')
        .select('*')
        .eq('user_id', userId);
        
      if (error) return response(500, { error: error.message });
      if (!activeTimers || activeTimers.length === 0) return response(200, { active: false });
      
      return response(200, { active: true, timer: activeTimers[0] });
    }

    return response(404, { error: 'Not found' });
  } catch (err) {
    log('error', 'Timer handler error', { error: err.message, path, method });
    return response(500, { error: 'Internal error' });
  }
};
