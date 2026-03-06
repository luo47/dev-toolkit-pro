import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

// 全局 CORS
app.use('/api/*', cors());

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
