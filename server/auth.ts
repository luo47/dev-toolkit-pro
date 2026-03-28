import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

export type Bindings = {
  DB: D1Database;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  FRONTEND_URL: string;
};

type GitHubUser = {
  id: number;
  login: string;
  name?: string | null;
  avatar_url?: string | null;
  created_at: string;
};

const auth = new Hono<{ Bindings: Bindings }>();

// 重定向到 GitHub 登录
auth.get("/github/login", (c) => {
  const clientId = c.env.GITHUB_CLIENT_ID;
  const redirectUri = `${c.env.FRONTEND_URL}/api/auth/github/callback`;
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=read:user`;
  return c.redirect(githubAuthUrl);
});

// GitHub 登录回调处理
auth.get("/github/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) return c.json({ error: "No code provided" }, 400);

  // 用 Authorization Code 交换 Access Token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = (await tokenRes.json()) as { access_token?: string };
  const accessToken = tokenData.access_token;
  if (!accessToken) return c.json({ error: "Failed to get access token" }, 400);

  // 获取 GitHub 用户信息
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "dev-toolkit-pro",
    },
  });

  if (!userRes.ok) return c.json({ error: "Failed to get user info" }, 400);
  const githubUser = (await userRes.json()) as GitHubUser;

  // 检查注册时间是否大于 7 天
  const createdAt = new Date(githubUser.created_at).getTime();
  const now = Date.now();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  if (now - createdAt < SEVEN_DAYS) {
    return c.json({ error: "GitHub 账号注册时间少于 7 天，由于风控原因禁止登录。" }, 403);
  }

  const userId = `github_${githubUser.id}`;

  // 在 D1 中插入或更新用户记录
  await c.env.DB.prepare(
    `INSERT INTO users (id, github_id, username, name, avatar_url)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(github_id) DO UPDATE SET
       username = excluded.username,
       name = excluded.name,
       avatar_url = excluded.avatar_url`,
  )
    .bind(
      userId,
      githubUser.id,
      githubUser.login,
      githubUser.name || "",
      githubUser.avatar_url || "",
    )
    .run();

  // 创建新 Session
  const sessionId = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // 30天后过期

  await c.env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`)
    .bind(sessionId, userId, expiresAt)
    .run();

  // 设置会话 Cookie
  setCookie(c, "auth_session", sessionId, {
    path: "/",
    httpOnly: true,
    secure: true, // 生产环境通常需要 HTTPS
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  // 返回首页
  return c.redirect("/");
});

// 获取当前会话状态
auth.get("/me", async (c) => {
  const sessionId = getCookie(c, "auth_session");
  if (!sessionId) return c.json({ user: null });

  // 校验 session 有效性和关联的用户
  const result = await c.env.DB.prepare(
    `SELECT users.id, users.github_id, users.username, users.name, users.avatar_url 
     FROM users
     JOIN sessions ON users.id = sessions.user_id
     WHERE sessions.id = ? AND sessions.expires_at > ?`,
  )
    .bind(sessionId, Math.floor(Date.now() / 1000))
    .first();

  if (!result) {
    return c.json({ user: null });
  }

  return c.json({ user: result });
});

// 登出处理
auth.post("/logout", async (c) => {
  const sessionId = getCookie(c, "auth_session");
  if (sessionId) {
    await c.env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
  }
  deleteCookie(c, "auth_session", { path: "/" });
  return c.json({ success: true });
});

export default auth;
