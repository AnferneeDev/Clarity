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
  const path = event.requestContext?.http?.path || '';
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
      await supabase.from('subjects').upsert({
        user_id: userId, name: subjectName.toLowerCase().trim(), is_hidden: false,
      }, { onConflict: 'user_id,name' });

      // Atomic upsert via RPC
      const { error } = await supabase.rpc('upsert_session', {
        p_user_id: userId,
        p_subject_name: subjectName.toLowerCase().trim(),
        p_date: date,
        p_minutes: minutes,
      });
      if (error) {
        log('error', 'Session save failed', { error: error.message });
        return response(500, { error: error.message });
      }

      return response(200, { success: true });
    }

    if (method === 'GET' && path === '/timer/stats') {
      const start = event.queryStringParameters?.start;
      const end = event.queryStringParameters?.end;

      let q = supabase.from('sessions').select('subject_name,minutes').limit(10000);
      if (start) q = q.gte('date', start);
      if (end) q = q.lte('date', end);

      const { data } = await q;
      const totals = {};
      for (const row of (data || [])) {
        totals[row.subject_name] = (totals[row.subject_name] || 0) + row.minutes;
      }
      return response(200, Object.entries(totals).map(([subject, total_minutes]) => ({ subject, total_minutes })));
    }

    if (method === 'GET' && path === '/timer/subjects') {
      const { data } = await supabase.from('subjects').select('id,name,is_hidden').order('name');
      return response(200, data || []);
    }

    return response(404, { error: 'Not found' });
  } catch (err) {
    log('error', 'Timer handler error', { error: err.message, path, method });
    return response(500, { error: 'Internal error' });
  }
};
