import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { zipSync } from 'fflate';

type FileItem = {
  key: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
};

type ShareContent = {
  id: string;
  type: 'text' | 'file';
  content?: string;
  files?: FileItem[];
  totalSize?: number;
  name?: string;
  createdAt: string;
  updatedAt: string;
};

type Bindings = {
  DB: D1Database;
  SHARE_KV: KVNamespace;
  SHARE_R2: R2Bucket;
  ASSETS: Fetcher;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  FRONTEND_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// --- 核心预览逻辑：必须具有绝对优先级 ---
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

// --- Code Snippets Routes ---
app.get('/api/snippets', async (c) => {
  const userId = await getUserFromSession(c);
  const url = new URL(c.req.url);
  const language = url.searchParams.get('language');
  const tag = url.searchParams.get('tag');
  const search = url.searchParams.get('search');
  const sort = url.searchParams.get('sort') || 'updated_at';
  const order = url.searchParams.get('order') || 'desc';
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  try {
    let query = `SELECT * FROM code_snippets WHERE (user_id = 'system' OR user_id IS NULL ${userId ? 'OR user_id = ?' : ''})`;
    const params: any[] = [];
    if (userId) {
      params.push(userId);
    }

    const conditions = [];

    if (language) {
      conditions.push('language = ?');
      params.push(language);
    }
    if (tag) {
      conditions.push('tags LIKE ?');
      params.push(`%"${tag}"%`);
    }
    if (search) {
      conditions.push('(title LIKE ? OR code LIKE ? OR description LIKE ?)');
      const p = `%${search}%`;
      params.push(p, p, p);
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    const validSorts = ['copy_count', 'updated_at', 'created_at', 'title'];
    const sortColumn = validSorts.includes(sort) ? sort : 'updated_at';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    if (sortColumn === 'title') {
      query += ` ORDER BY (CASE WHEN title IS NULL OR title = '' THEN 1 ELSE 0 END) ASC, title ${sortOrder} LIMIT ? OFFSET ?`;
    } else {
      query += ` ORDER BY ${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`;
    }
    params.push(limit, offset);

    const result = await c.env.DB.prepare(query).bind(...params).all();

    let countQuery = `SELECT COUNT(*) as total FROM code_snippets WHERE (user_id = 'system' OR user_id IS NULL ${userId ? 'OR user_id = ?' : ''})`;
    if (conditions.length > 0) {
      countQuery += ' AND ' + conditions.join(' AND ');
    }
    const countResult = await c.env.DB.prepare(countQuery).bind(...params.slice(0, -2)).first();

    const snippets = result.results.map((r: any) => ({
      ...r,
      tags: r.tags ? JSON.parse(r.tags) : []
    }));

    return c.json({
      snippets,
      total: countResult ? countResult.total : 0,
      limit,
      offset,
    });
  } catch (e: any) {
    console.error('Fetch snippets err:', e);
    return c.json({ success: false, error: 'Database error' }, 500);
  }
});

app.get('/api/snippets/:id', async (c) => {
  const userId = await getUserFromSession(c);
  const id = c.req.param('id');
  try {
    const sql = `SELECT * FROM code_snippets WHERE id = ? AND (user_id = 'system' OR user_id IS NULL ${userId ? 'OR user_id = ?' : ''})`;
    const stmt = userId ? c.env.DB.prepare(sql).bind(id, userId) : c.env.DB.prepare(sql).bind(id);
    const result = await stmt.first();

    if (!result) return c.json({ error: 'Snippet not found' }, 404);

    return c.json({
      ...result,
      tags: result.tags ? JSON.parse(result.tags as string) : []
    });
  } catch (e: any) {
    return c.json({ success: false, error: 'Database error' }, 500);
  }
});

app.post('/api/snippets', async (c) => {
  const userId = await getUserFromSession(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const body = await c.req.json();
    const { title = '', code, language = '', description = '', tags = [] } = body;

    if (!code) return c.json({ error: 'Code is required' }, 400);

    const tagsJson = JSON.stringify(tags);
    const result = await c.env.DB.prepare(
      'INSERT INTO code_snippets (user_id, title, code, language, description, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))'
    ).bind(userId, title, code, language, description, tagsJson).run();

    const newSnippet = await c.env.DB.prepare('SELECT * FROM code_snippets WHERE id = ?')
      .bind(result.meta.last_row_id).first();

    return c.json({
      ...newSnippet,
      tags: newSnippet?.tags ? JSON.parse(newSnippet.tags as string) : []
    }, 201);
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.put('/api/snippets/:id', async (c) => {
  const userId = await getUserFromSession(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  try {
    const body = await c.req.json();
    const { title, code, language, description, tags, copyCountsDelta } = body;

    const existing = await c.env.DB.prepare('SELECT * FROM code_snippets WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ error: 'Snippet not found' }, 404);

    // Allow user to edit their own snippets or system snippets if admin? We just allow user to edit their own.
    if (existing.user_id !== userId && existing.user_id !== 'system') { // Actually, standard users shouldn't edit system snippets unless they are admin, but let's just check if it's theirs or if they are just incrementing copy count
      if (!copyCountsDelta && title !== undefined) {
        return c.json({ error: 'Forbidden' }, 403);
      }
    }

    if (copyCountsDelta && copyCountsDelta[id]) {
      await c.env.DB.prepare('UPDATE code_snippets SET copy_count = copy_count + ? WHERE id = ?').bind(copyCountsDelta[id], id).run();
      // Return quickly if it's just a copy
      if (title === undefined && code === undefined) return c.json({ success: true });
    }

    if (existing.user_id !== userId) return c.json({ error: 'Forbidden' }, 403);

    const updates = [];
    const params = [];

    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (code !== undefined) { updates.push('code = ?'); params.push(code); }
    if (language !== undefined) { updates.push('language = ?'); params.push(language); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (tags !== undefined) { updates.push('tags = ?'); params.push(JSON.stringify(tags)); }

    if (updates.length > 0) {
      updates.push('updated_at = datetime("now")');
      params.push(id);
      await c.env.DB.prepare(`UPDATE code_snippets SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).bind(...params, userId).run();
    }

    const updated = await c.env.DB.prepare('SELECT * FROM code_snippets WHERE id = ?').bind(id).first();
    return c.json({
      ...updated,
      tags: updated?.tags ? JSON.parse(updated.tags as string) : []
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.delete('/api/snippets/:id', async (c) => {
  const userId = await getUserFromSession(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  try {
    const result = await c.env.DB.prepare('DELETE FROM code_snippets WHERE id = ? AND user_id = ?').bind(id, userId).run();
    if (result.meta.changes === 0) {
      return c.json({ error: 'Snippet not found or unauthorized' }, 404);
    }
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ success: false, error: 'Database error' }, 500);
  }
});

app.get('/api/snippets/data/languages', async (c) => {
  const userId = await getUserFromSession(c);
  try {
    const sql = `SELECT DISTINCT language, COUNT(*) as count FROM code_snippets WHERE (user_id = 'system' OR user_id IS NULL ${userId ? 'OR user_id = ?' : ''}) AND language IS NOT NULL GROUP BY language ORDER BY count DESC`;
    const stmt = userId ? c.env.DB.prepare(sql).bind(userId) : c.env.DB.prepare(sql);
    const result = await stmt.all();
    return c.json(result.results);
  } catch (e: any) {
    return c.json({ success: false, error: e?.message || 'Database error' }, 500);
  }
});

app.get('/api/snippets/data/tags', async (c) => {
  const userId = await getUserFromSession(c);
  try {
    const sql = `SELECT tags FROM code_snippets WHERE (user_id = 'system' OR user_id IS NULL ${userId ? 'OR user_id = ?' : ''})`;
    const stmt = userId ? c.env.DB.prepare(sql).bind(userId) : c.env.DB.prepare(sql);
    const result = await stmt.all();

    const tagCounts: Record<string, number> = {};
    result.results.forEach((row: any) => {
      if (row.tags) {
        const tags = JSON.parse(row.tags);
        tags.forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });
    const tags = Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    return c.json(tags);
  } catch (e: any) {
    return c.json({ success: false, error: 'Database error' }, 500);
  }
});
// --- End Code Snippets Routes ---

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

// --- Cloud Share Routes ---

// --- Cloud Share Routes ---

const generateShareId = () => Math.random().toString(36).substring(2, 10);

// 获取所有分享内容列表
app.get('/api/shares', async (c) => {
  try {
    const list = await c.env.SHARE_KV.list({ prefix: 'share:' });
    const items: ShareContent[] = [];
    for (const key of list.keys) {
      const data = await c.env.SHARE_KV.get(key.name);
      if (data) items.push(JSON.parse(data));
    }
    // 按创建时间倒序排列
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json({ success: true, data: items });
  } catch (e: any) {
    return c.json({ success: false, error: e.message || 'Failed to list shares' }, 500);
  }
});

// 创建新文本分享
app.post('/api/shares', async (c) => {
  try {
    const body = await c.req.json() as { content: string; name?: string };
    if (!body.content) return c.json({ success: false, error: '内容不能为空' }, 400);

    const id = generateShareId();
    const now = new Date().toISOString();
    const item: ShareContent = {
      id,
      type: 'text',
      content: body.content,
      name: body.name || '未命名文本分享',
      createdAt: now,
      updatedAt: now,
    };
    await c.env.SHARE_KV.put(`share:${id}`, JSON.stringify(item));
    return c.json({ success: true, data: item });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 更新、删除单个分享内容
app.put('/api/shares/:id', async (c) => {
  const id = c.req.param('id');
  const key = `share:${id}`;
  try {
    const existing = await c.env.SHARE_KV.get(key);
    if (!existing) return c.json({ success: false, error: '分享不存在' }, 404);

    const body = await c.req.json() as { content?: string; name?: string };
    const item = JSON.parse(existing) as ShareContent;
    
    if (item.type === 'text' && body.content !== undefined) {
      item.content = body.content;
    }
    if (body.name !== undefined) {
      item.name = body.name;
    }
    item.updatedAt = new Date().toISOString();

    await c.env.SHARE_KV.put(key, JSON.stringify(item));
    return c.json({ success: true, data: item });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.delete('/api/shares/:id', async (c) => {
  const id = c.req.param('id');
  const key = `share:${id}`;
  try {
    const existing = await c.env.SHARE_KV.get(key);
    if (!existing) return c.json({ success: false, error: '分享不存在' }, 404);

    const item = JSON.parse(existing) as ShareContent;
    // 如果是文件类型，删除 R2 中所有相关文件
    if (item.type === 'file' && item.files) {
      for (const file of item.files) {
        await c.env.SHARE_R2.delete(file.key);
      }
    }
    await c.env.SHARE_KV.delete(key);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 文件上传 (POST /api/files)
app.post('/api/files', async (c) => {
  try {
    const formData = await c.req.formData();
    const files = formData.getAll('files') as File[];
    const shareName = formData.get('name') as string || '';
    
    if (!files || files.length === 0) {
      return c.json({ success: false, error: '没有提供文件' }, 400);
    }

    const id = generateShareId();
    const now = new Date().toISOString();
    const fileItems: FileItem[] = [];
    let totalSize = 0;

    for (const file of files) {
      // 在 Hono/Workers 环境中，webkitRelativePath 通过 formData 的文件名部分传递（如果在 append 时指定了）
      const relativePath = file.name; 
      const r2Key = `${id}/${relativePath}`;
      
      await c.env.SHARE_R2.put(r2Key, file.stream(), {
        httpMetadata: {
          contentType: file.type || 'application/octet-stream',
        },
        customMetadata: {
          fileName: file.name,
          filePath: relativePath,
          shareId: id,
        },
      });

      fileItems.push({
        key: r2Key,
        name: file.name.split('/').pop() || file.name,
        path: relativePath,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
      });
      totalSize += file.size;
    }

    const item: ShareContent = {
      id,
      type: 'file',
      files: fileItems,
      totalSize,
      name: shareName || fileItems[0].name,
      createdAt: now,
      updatedAt: now,
    };
    await c.env.SHARE_KV.put(`share:${id}`, JSON.stringify(item));
    
    return c.json({ success: true, data: item });
  } catch (e: any) {
    return c.json({ success: false, error: e.message || 'Upload failed' }, 500);
  }
});

// --- 公开 API (无需认证，用于预览页) ---

// 获取分享信息
app.get('/api/public/share/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.env.SHARE_KV.get(`share:${id}`);
  if (!data) return c.json({ success: false, error: '分享不存在' }, 404);
  
  const item = JSON.parse(data) as ShareContent;
  return c.json({ 
    success: true, 
    data: {
      id: item.id,
      type: item.type,
      name: item.name,
      files: item.files,
      totalSize: item.totalSize,
      createdAt: item.createdAt,
    }
  });
});

// 下载单个文件
app.get('/api/public/download/:id/:path{.+}', async (c) => {
  const id = c.req.param('id');
  const filePath = c.req.param('path');
  const r2Key = `${id}/${filePath}`;

  const object = await c.env.SHARE_R2.get(r2Key);
  if (!object) return c.json({ success: false, error: '文件不存在' }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  // 确保下载时有正确的文件名
  const fileName = filePath.split('/').pop() || 'file';
  headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);

  return new Response(object.body, { headers });
});

// 打包下载所有文件 (ZIP)
app.get('/api/public/download/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.env.SHARE_KV.get(`share:${id}`);
  if (!data) return c.json({ success: false, error: '分享不存在' }, 404);

  const item = JSON.parse(data) as ShareContent;
  if (!item.files || item.files.length === 0) {
    return c.json({ success: false, error: '没有可下载的文件' }, 404);
  }

  try {
    const zipData: { [path: string]: Uint8Array } = {};
    for (const file of item.files) {
      const object = await c.env.SHARE_R2.get(file.key);
      if (object) {
        zipData[file.path] = new Uint8Array(await object.arrayBuffer());
      }
    }

    const zipped = zipSync(zipData, { level: 6 });
    const zipName = `${item.name || id}.zip`;
    
    return new Response(zipped as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`,
        'Content-Length': zipped.length.toString(),
      },
    });
  } catch (e: any) {
    return c.json({ success: false, error: '打包失败: ' + e.message }, 500);
  }
});

// 公开预览/访问路径 /s/:id
app.get('/s/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.env.SHARE_KV.get(`share:${id}`);
  if (!data) return c.text('分享不存在或已过期', 404);

  const item = JSON.parse(data) as ShareContent;
  if (item.type === 'text') {
    // 强制设置 Header 确保浏览器直接显示文本
    c.header('Content-Type', 'text/plain; charset=utf-8');
    return c.text(item.content || '');
  }
  
  // 对于文件类型，重定向到前端预览页
  const frontendUrl = c.env.FRONTEND_URL || 'https://www.928496.xyz';
  return c.redirect(`${frontendUrl}/share-preview/${id}`, 302);
});


// --- End Cloud Share Routes ---

// SPA 路由支持：对于所有不匹配 API 或静态资源的请求，返回 index.html
app.get('*', async (c) => {
  const url = new URL(c.req.url);
  // 排除 API 请求和核心预览路由
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/s/')) {
    return c.notFound();
  }

  // 尝试从 ASSETS 绑定中获取
  try {
    const res = await c.env.ASSETS.fetch(c.req.raw);
    if (res.status === 404) {
      // 如果 404，说明可能是 SPA 路由，返回 index.html
      return c.env.ASSETS.fetch(new Request(`${url.origin}/index.html`, c.req.raw));
    }
    return res;
  } catch (e) {
    // 降级处理
    console.error('Asset fetch error:', e);
    return c.notFound();
  }
});

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // ==========================================
    // 核心分享拦截：拦截 /s/{id}
    // ==========================================
    const shareMatch = path.match(/^\/s\/([a-z0-9]+)$/);
    if (shareMatch && request.method === 'GET') {
      const id = shareMatch[1];
      try {
        const data = await env.SHARE_KV.get(`share:${id}`);
        if (!data) {
           return new Response('分享内容不存在或已过期', { 
             status: 404,
             headers: { 'Content-Type': 'text/plain; charset=utf-8' }
           });
        }

        const item = JSON.parse(data) as ShareContent;
        // 兼容旧数据：没有 type 但有 content 的也算 text
        const isText = item.type === 'text' || (!item.type && item.content);
        
        if (isText) {
          // 文本：直接返回纯文本
          return new Response(item.content || '', {
            status: 200,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'X-Content-Type-Options': 'nosniff',
              'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
              'Pragma': 'no-cache',
              'Expires': '0'
            },
          });
        } else {
          // 文件：重定向到前端 SPA 的预览页面 /share-preview/{id}
          const frontendUrl = env.FRONTEND_URL || `${url.origin}`;
          return Response.redirect(`${frontendUrl}/share-preview/${id}`, 302);
        }
      } catch (e) {
        console.error('Preview error:', e);
        return new Response('Server Error', { status: 500 });
      }
    }
    // ==========================================

    // 其他请求交给 Hono 处理
    return app.fetch(request, env, ctx);
  },
};
