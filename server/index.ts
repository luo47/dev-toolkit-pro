import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  FRONTEND_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// 全局日志中间件
app.use('*', async (c, next) => {
  console.log(`[${new Date().toISOString()}] Request: ${c.req.method} ${c.req.url}`);
  await next();
});

// 全局机制：所有 API 请求都不应该被缓存
app.use('/api/*', async (c, next) => {
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  c.header('Pragma', 'no-cache');
  c.header('Expires', '0');

  const origin = c.env.FRONTEND_URL || '*';
  return cors({
    origin: [origin, 'http://localhost:3000', 'https://www.928496.xyz'],
    credentials: true,
  })(c, next);
});

// --- Auth Routes ---

// 获取 GitHub 登录跳转 URL
app.get('/api/auth/github/login', (c) => {
  const clientId = c.env.GITHUB_CLIENT_ID;
  const frontendUrl = c.env.FRONTEND_URL || 'https://www.928496.xyz';
  const redirectUri = `${frontendUrl}/api/auth/github/callback`;

  console.log('Login URL requested:', { clientId: !!clientId, redirectUri });

  if (!clientId) {
    return c.json({ error: 'GITHUB_CLIENT_ID not configured' }, 500);
  }

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user`;

  console.log('Returning auth url:', githubAuthUrl);
  return c.json({ url: githubAuthUrl });
});

// GitHub 登录回调处理
app.get('/api/auth/github/callback', async (c) => {
  console.log('Callback reached');
  const code = c.req.query('code');
  if (!code) return c.json({ error: 'No code provided' }, 400);

  try {
    const frontendUrl = c.env.FRONTEND_URL || 'https://www.928496.xyz';
    const redirectUri = `${frontendUrl}/api/auth/github/callback`;

    // 用 Authorization Code 交换 Access Token
    const params = new URLSearchParams();
    params.append('client_id', c.env.GITHUB_CLIENT_ID);
    params.append('client_secret', c.env.GITHUB_CLIENT_SECRET);
    params.append('code', code);
    params.append('redirect_uri', redirectUri);

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const tokenData = await tokenRes.json() as { access_token?: string; error?: string; error_description?: string };
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      console.error('Failed to get access token:', tokenData);
      return c.json({ error: 'Failed to get access token', details: tokenData }, 400);
    }

    // 获取 GitHub 用户信息
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'dev-toolkit-pro',
      },
    });

    if (!userRes.ok) {
      const errorText = await userRes.text();
      console.error('Failed to get user info:', errorText);
      return c.json({ error: 'Failed to get user info' }, 400);
    }
    const githubUser = await userRes.json() as any;

    const userId = `github_${githubUser.id}`;

    // 在 D1 中插入或更新用户记录
    await c.env.DB.prepare(
      `INSERT INTO users (id, github_id, username, name, avatar_url)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(github_id) DO UPDATE SET
         username = excluded.username,
         name = excluded.name,
         avatar_url = excluded.avatar_url`
    )
      .bind(userId, githubUser.id, githubUser.login, githubUser.name || '', githubUser.avatar_url || '')
      .run();

    // 创建新 Session
    const sessionId = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // 30天后过期

    await c.env.DB.prepare(
      `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`
    ).bind(sessionId, userId, expiresAt).run();

    // 设置会话 Cookie
    setCookie(c, 'auth_session', sessionId, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24 * 30,
    });

    console.log('Login success, redirecting home');
    return c.redirect('/', 302);
  } catch (e) {
    console.error('Auth error:', e);
    return c.text('Authentication failed', 500);
  }
});

// 获取当前会话状态
app.get('/api/auth/me', async (c) => {
  const sessionId = getCookie(c, 'auth_session');
  if (!sessionId) return c.json({ user: null });

  try {
    const result = await c.env.DB.prepare(
      `SELECT users.id, users.github_id, users.username, users.name, users.avatar_url 
       FROM users
       JOIN sessions ON users.id = sessions.user_id
       WHERE sessions.id = ? AND sessions.expires_at > ?`
    ).bind(sessionId, Math.floor(Date.now() / 1000)).first();

    return c.json({ user: result || null });
  } catch (e) {
    return c.json({ user: null });
  }
});

// 登出处理
app.post('/api/auth/logout', async (c) => {
  const sessionId = getCookie(c, 'auth_session');
  if (sessionId) {
    await c.env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
  }
  deleteCookie(c, 'auth_session', { path: '/' });
  return c.json({ success: true });
});

// --- End Auth Routes ---

// --- Chain Routes ---
const getUserFromSession = async (c: any) => {
  const sessionId = getCookie(c, 'auth_session');
  if (!sessionId) return null;
  const result = await c.env.DB.prepare(
    `SELECT users.id 
     FROM users
     JOIN sessions ON users.id = sessions.user_id
     WHERE sessions.id = ? AND sessions.expires_at > ?`
  ).bind(sessionId, Math.floor(Date.now() / 1000)).first();
  return result ? (result.id as string) : null;
};

// 获取用户的处理链（包括系统级和用户级）
app.get('/api/chains', async (c) => {
  const userId = await getUserFromSession(c);

  try {
    let query = `
      SELECT sc.id, sc.name, sc.is_favorite as isFavorite, sc.created_at as createdAt, cc.steps_json as steps
      FROM saved_chains sc
      JOIN chain_contents cc ON sc.content_md5 = cc.md5
      WHERE sc.user_id = 'system'
    `;
    let params: any[] = [];

    if (userId) {
      query = `
        SELECT sc.id, sc.name, sc.is_favorite as isFavorite, sc.created_at as createdAt, cc.steps_json as steps
        FROM saved_chains sc
        JOIN chain_contents cc ON sc.content_md5 = cc.md5
        WHERE sc.user_id = 'system' OR sc.user_id = ?
      `;
      params.push(userId);
    }

    const result = await c.env.DB.prepare(query).bind(...params).all();

    const chains = result.results.map((row: any) => ({
      ...row,
      isFavorite: !!row.isFavorite,
      steps: JSON.parse(row.steps)
    }));

    // Sort logic to mirror frontend behavior if needed, but we can do it on frontend
    return c.json({ success: true, data: chains });
  } catch (e: any) {
    console.error('Fetch chains err:', e);
    return c.json({ success: false, error: 'Database error' }, 500);
  }
});

// 保存处理链
app.post('/api/chains', async (c) => {
  const userId = await getUserFromSession(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const body = await c.req.json();
    const { name, steps } = body;
    if (!name || !steps) return c.json({ error: 'Missing name or steps' }, 400);

    const stepsJson = JSON.stringify(steps);

    // Use SHA-256 for consistent representation as MD5 isn't fully supported in WebCrypto
    const msgUint8 = new TextEncoder().encode(stepsJson);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const contentMd5 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Upsert chain_contents
    await c.env.DB.prepare(
      `INSERT INTO chain_contents (md5, steps_json, created_at) VALUES (?, ?, ?) ON CONFLICT(md5) DO NOTHING`
    ).bind(contentMd5, stepsJson, Date.now()).run();

    let dbId: string = crypto.randomUUID();

    const existResult = await c.env.DB.prepare(
      `SELECT id FROM saved_chains WHERE user_id = ? AND content_md5 = ?`
    ).bind(userId, contentMd5).first();

    if (existResult) {
      dbId = existResult.id as string;
      await c.env.DB.prepare(
        `UPDATE saved_chains SET name = ?, created_at = ? WHERE id = ?`
      ).bind(name, Date.now(), dbId).run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO saved_chains (id, user_id, name, content_md5, is_favorite, created_at) VALUES (?, ?, ?, ?, 0, ?)`
      ).bind(dbId, userId, name, contentMd5, Date.now()).run();
    }

    return c.json({ success: true, id: dbId });
  } catch (e: any) {
    console.error('Save chain err:', e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 删除处理链
app.delete('/api/chains/:id', async (c) => {
  const userId = await getUserFromSession(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  try {
    // Only delete their own chains
    await c.env.DB.prepare(`DELETE FROM saved_chains WHERE id = ? AND user_id = ?`).bind(id, userId).run();
    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, error: 'Database error' }, 500);
  }
});

// 收藏/取消收藏
app.put('/api/chains/:id/favorite', async (c) => {
  const userId = await getUserFromSession(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  try {
    const { isFavorite } = await c.req.json();
    await c.env.DB.prepare(
      `UPDATE saved_chains SET is_favorite = ? WHERE id = ? AND user_id = ?`
    ).bind(isFavorite ? 1 : 0, id, userId).run();
    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, error: 'Database error' }, 500);
  }
});
// --- End Chain Routes ---

// 健康检查
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// 获取工具使用统计
app.get('/api/tools/usage', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'SELECT tool_name, count, updated_at FROM tool_usage ORDER BY count DESC'
    ).all();
    return c.json({ success: true, data: result.results });
  } catch (e) {
    return c.json({ success: false, error: '数据库查询失败' }, 500);
  }
});

// 记录工具使用
app.post('/api/tools/usage/:toolName', async (c) => {
  const toolName = c.req.param('toolName');
  try {
    await c.env.DB.prepare(
      `INSERT INTO tool_usage (tool_name, count, updated_at)
       VALUES (?, 1, datetime('now'))
       ON CONFLICT(tool_name) DO UPDATE SET
         count = count + 1,
         updated_at = datetime('now')`
    )
      .bind(toolName)
      .run();
    return c.json({ success: true, tool: toolName });
  } catch (e) {
    return c.json({ success: false, error: '记录使用失败' }, 500);
  }
});

export default app;
