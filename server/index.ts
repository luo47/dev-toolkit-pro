import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { registerChainsRoutes } from "./registerChainsRoutes";
import { registerOpenAiRoutes } from "./registerOpenAiRoutes";
import { registerSearchEngineRoutes } from "./registerSearchEngineRoutes";
import { registerShareRoutes } from "./registerShareRoutes";
import { registerSnippetsRoutes } from "./registerSnippetsRoutes";
import type { Bindings } from "./serverTypes";

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", async (c, next) => {
  console.log(`[${new Date().toISOString()}] Request: ${c.req.method} ${c.req.url}`);
  await next();
});

app.use("/api/*", async (c, next) => {
  c.header("Cache-Control", "no-store, no-cache, must-revalidate, private");
  c.header("Pragma", "no-cache");
  c.header("Expires", "0");
  return cors({
    origin: [c.env.FRONTEND_URL || "*", "http://localhost:3000", "https://www.928496.xyz"],
    credentials: true,
  })(c, next);
});

app.get("/api/auth/github/login", (c) => {
  const clientId = c.env.GITHUB_CLIENT_ID;
  const frontendUrl = c.env.FRONTEND_URL || "https://www.928496.xyz";
  const redirectUri = `${frontendUrl}/api/auth/github/callback`;
  console.log("Login URL requested:", { clientId: !!clientId, redirectUri });
  if (!clientId) return c.json({ error: "GITHUB_CLIENT_ID not configured" }, 500);
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user`;
  console.log("Returning auth url:", githubAuthUrl);
  return c.json({ url: githubAuthUrl });
});

app.get("/api/auth/github/callback", async (c) => {
  console.log("Callback reached");
  const code = c.req.query("code");
  if (!code) return c.json({ error: "No code provided" }, 400);

  try {
    const frontendUrl = c.env.FRONTEND_URL || "https://www.928496.xyz";
    const redirectUri = `${frontendUrl}/api/auth/github/callback`;
    const params = new URLSearchParams();
    params.append("client_id", c.env.GITHUB_CLIENT_ID);
    params.append("client_secret", c.env.GITHUB_CLIENT_SECRET);
    params.append("code", code);
    params.append("redirect_uri", redirectUri);

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      console.error("Failed to get access token:", tokenData);
      return c.json({ error: "Failed to get access token", details: tokenData }, 400);
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "dev-toolkit-pro",
      },
    });
    if (!userRes.ok) {
      console.error("Failed to get user info:", await userRes.text());
      return c.json({ error: "Failed to get user info" }, 400);
    }

    const githubUser = (await userRes.json()) as any;
    const userId = `github_${githubUser.id}`;
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

    const sessionId = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
    await c.env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`)
      .bind(sessionId, userId, expiresAt)
      .run();

    setCookie(c, "auth_session", sessionId, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: 60 * 60 * 24 * 30,
    });

    console.log("Login success, redirecting home");
    return c.redirect("/", 302);
  } catch (error) {
    console.error("Auth error:", error);
    return c.text("Authentication failed", 500);
  }
});

app.get("/api/auth/me", async (c) => {
  const sessionId = getCookie(c, "auth_session");
  if (!sessionId) return c.json({ user: null });
  try {
    const result = await c.env.DB.prepare(
      `SELECT users.id, users.github_id, users.username, users.name, users.avatar_url
       FROM users
       JOIN sessions ON users.id = sessions.user_id
       WHERE sessions.id = ? AND sessions.expires_at > ?`,
    )
      .bind(sessionId, Math.floor(Date.now() / 1000))
      .first();
    return c.json({ user: result || null });
  } catch {
    return c.json({ user: null });
  }
});

app.post("/api/auth/logout", async (c) => {
  const sessionId = getCookie(c, "auth_session");
  if (sessionId) {
    await c.env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
  }
  deleteCookie(c, "auth_session", { path: "/" });
  return c.json({ success: true });
});

registerChainsRoutes(app);
registerSnippetsRoutes(app);
registerSearchEngineRoutes(app);
registerOpenAiRoutes(app);
registerShareRoutes(app);

app.get("/api/health", (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  }),
);

app.get("/api/tools/usage", async (c) => {
  try {
    const result = await c.env.DB.prepare(
      "SELECT tool_name, count, updated_at FROM tool_usage ORDER BY count DESC",
    ).all();
    return c.json({ success: true, data: result.results });
  } catch {
    return c.json({ success: false, error: "数据库查询失败" }, 500);
  }
});

app.post("/api/tools/usage/:toolName", async (c) => {
  try {
    await c.env.DB.prepare(
      `INSERT INTO tool_usage (tool_name, count, updated_at)
       VALUES (?, 1, datetime('now'))
       ON CONFLICT(tool_name) DO UPDATE SET
         count = count + 1,
         updated_at = datetime('now')`,
    )
      .bind(c.req.param("toolName"))
      .run();
    return c.json({ success: true, tool: c.req.param("toolName") });
  } catch {
    return c.json({ success: false, error: "记录使用失败" }, 500);
  }
});

app.get("*", async (c) => {
  const url = new URL(c.req.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/s/")) return c.notFound();
  try {
    const response = await c.env.ASSETS.fetch(c.req.raw);
    if (response.status !== 404) return response;
    return c.env.ASSETS.fetch(new Request(`${url.origin}/index.html`, c.req.raw));
  } catch (error) {
    console.error("Asset fetch error:", error);
    return c.notFound();
  }
});

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/s\/([a-z0-9]{6,12})\/?$/i);
    console.log(">>> [WORKER_FETCH_START]", url.pathname, request.method);

    if (match && request.method === "GET") {
      try {
        const existing = await env.DB.prepare("SELECT * FROM shares WHERE id = ?")
          .bind(match[1])
          .first();
        if (!existing) {
          return new Response("Content Lost or Invalid ID", {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
        if (existing.type === "text") {
          return new Response((existing.content as string) || "", {
            status: 200,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "X-Content-Type-Options": "nosniff",
              "Cache-Control": "no-store, no-cache, must-revalidate",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
        return Response.redirect(
          `${env.FRONTEND_URL || url.origin}/share-preview/${match[1]}`,
          302,
        );
      } catch (error) {
        console.error("CRITICAL: Share system failure:", error);
      }
    }

    return app.fetch(request, env, ctx);
  },
};
