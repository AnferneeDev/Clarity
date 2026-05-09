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
  const path = event.requestContext?.http?.path || '';
  const method = event.requestContext?.http?.method || 'GET';
  const taskId = event.pathParameters?.id;

  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  const jwt = auth.replace('Bearer ', '');
  if (!jwt) return response(401, { error: 'Unauthorized' });

  const userId = getUserIdFromJwt(jwt);
  if (!userId) return response(401, { error: 'Invalid token' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    }
  );

  try {
    if (method === 'GET' && path === '/tasks') {
      const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
      return response(200, data || []);
    }

    if (method === 'POST' && path === '/tasks') {
      let text, starred, due_date;
      try {
        ({ text, starred, due_date } = JSON.parse(event.body || '{}'));
      } catch {
        return response(400, { error: 'Invalid JSON body' });
      }
      if (!text) return response(400, { error: 'Text required' });
      const { data, error } = await supabase.from('tasks').insert({
        user_id: userId, text, starred: starred || false, due_date: due_date || null,
      }).select().single();
      if (error) return response(500, { error: error.message });
      return response(201, data);
    }

    if (method === 'PUT' && taskId) {
      let updates;
      try { updates = JSON.parse(event.body || '{}'); } catch { return response(400, { error: 'Invalid JSON body' }); }
      updates.updated_at = new Date().toISOString();
      const { data, error } = await supabase.from('tasks').update(updates).eq('id', taskId).select().maybeSingle();
      if (error) return response(500, { error: error.message });
      return response(data ? 200 : 404, { success: !!data });
    }

    if (method === 'DELETE' && taskId) {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      return response(200, { success: !error });
    }

    return response(404, { error: 'Not found' });
  } catch (err) {
    log('error', 'Tasks handler error', { error: err.message, path, method });
    return response(500, { error: 'Internal error' });
  }
};
