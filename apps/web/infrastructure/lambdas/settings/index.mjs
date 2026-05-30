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

function getUserIdFromJwt(jwt) {
  try {
    const payload = jwt.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf-8')).sub || null;
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
    if (method === 'GET' && path === '/preferences') {
      let { data, error } = await supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle();
      if (error) {
        log('error', 'Failed to fetch user preferences', { error: error.message, userId });
        return response(500, { error: error.message });
      }
      if (!data) {
        // If not found, insert defaults
        const { data: newData, error: insertError } = await supabase
          .from('user_preferences')
          .insert({ user_id: userId })
          .select()
          .single();
        if (insertError) {
          log('error', 'Failed to insert default user preferences', { error: insertError.message, userId });
          return response(500, { error: insertError.message });
        }
        data = newData;
      }
      return response(200, data);
    }

    if (method === 'PUT' && path === '/preferences') {
      let updates;
      try {
        updates = JSON.parse(event.body || '{}');
      } catch {
        return response(400, { error: 'Invalid JSON body' });
      }

      const allowedKeys = ['focus_minutes', 'short_break_minutes', 'long_break_minutes', 'auto_start_breaks', 'allow_long_timers'];
      const payload = {};
      for (const key of allowedKeys) {
        if (key in updates) {
          payload[key] = updates[key];
        }
      }
      payload.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('user_preferences')
        .upsert({ user_id: userId, ...payload })
        .select()
        .single();

      if (error) {
        log('error', 'Failed to upsert user preferences', { error: error.message, userId });
        return response(500, { error: error.message });
      }

      return response(200, data);
    }

    return response(404, { error: 'Not found' });
  } catch (err) {
    log('error', 'Settings handler error', { error: err.message, path, method });
    return response(500, { error: 'Internal error' });
  }
};
