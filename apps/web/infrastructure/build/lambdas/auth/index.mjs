import { createClient } from '@supabase/supabase-js';

function response(code, body) {
  return {
    statusCode: code,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function log(level, msg, data) {
  console[level](JSON.stringify({ level, timestamp: new Date().toISOString(), message: msg, ...data }));
}

export const handler = async (event) => {
  const rawPath = event.requestContext?.http?.path || '';
  const path = rawPath.startsWith('/api') ? rawPath.slice(4) : rawPath;
  const method = event.requestContext?.http?.method || 'GET';

  // Auth Lambdas use the anon key directly (no user JWT needed for login/logout)
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  try {
    // POST /auth/login
    if (method === 'POST' && path === '/auth/login') {
      let email, password;
      try {
        ({ email, password } = JSON.parse(event.body || '{}'));
      } catch {
        return response(400, { error: 'Invalid JSON body' });
      }
      if (!email || !password) return response(400, { error: 'Email and password required' });

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        log('warn', 'Login failed', { email, error: error.message });
        return response(401, { error: error.message });
      }

      log('info', 'Login success', { userId: data.user.id });
      return response(200, {
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
        user: { id: data.user.id, email: data.user.email },
      });
    }

    // POST /auth/logout — stateless (frontend clears JWT locally)
    if (method === 'POST' && path === '/auth/logout') {
      return response(200, { success: true });
    }

    // GET /auth/session — validate JWT and return user
    if (method === 'GET' && path === '/auth/session') {
      const auth = event.headers?.authorization || event.headers?.Authorization || '';
      const jwt = auth.replace('Bearer ', '');
      if (!jwt) return response(401, { error: 'No token' });

      const { data, error } = await supabase.auth.getUser(jwt);
      if (error || !data.user) return response(401, { error: 'Invalid token' });

      return response(200, { user: { id: data.user.id, email: data.user.email } });
    }

    return response(404, { error: 'Not found' });
  } catch (err) {
    log('error', 'Auth handler error', { error: err.message, path, method });
    return response(500, { error: 'Internal error' });
  }
};
