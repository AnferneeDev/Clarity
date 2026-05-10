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
  const noteId = event.pathParameters?.id;

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
    if (method === 'GET' && path === '/notes') {
      const { data } = await supabase.from('notes').select('*').order('created_at', { ascending: false }).limit(10000);
      return response(200, data || []);
    }

    if (method === 'POST' && path === '/notes') {
      let title, content, color;
      try {
        ({ title, content, color } = JSON.parse(event.body || '{}'));
      } catch {
        return response(400, { error: 'Invalid JSON body' });
      }
      if (!title) return response(400, { error: 'Title required' });
      const { data, error } = await supabase.from('notes').insert({
        user_id: userId, title, content: content || '', color: color || '#ffffff',
      }).select().single();
      if (error) return response(500, { error: error.message });
      return response(201, data);
    }

    if (method === 'PUT' && noteId) {
      let updates;
      try { updates = JSON.parse(event.body || '{}'); } catch { return response(400, { error: 'Invalid JSON body' }); }
      updates.updated_at = new Date().toISOString();
      const { data, error } = await supabase.from('notes').update(updates).eq('id', noteId).select().maybeSingle();
      if (error) return response(500, { error: error.message });
      return response(data ? 200 : 404, { success: !!data });
    }

    if (method === 'DELETE' && noteId) {
      const { error } = await supabase.from('notes').delete().eq('id', noteId);
      return response(200, { success: !error });
    }

    return response(404, { error: 'Not found' });
  } catch (err) {
    log('error', 'Notes handler error', { error: err.message, path, method });
    return response(500, { error: 'Internal error' });
  }
};
