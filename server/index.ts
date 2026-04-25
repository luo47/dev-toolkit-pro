import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import {
  type AuthProvider,
  getFrontendUrl,
  getProviderCallbackUrl,
  getProviderConfig,
  getProviderDisplayName,
  type OAuthUserProfile,
  shouldUseSecureCookie,
} from "./oauthProviders";
import { registerChainsRoutes } from "./registerChainsRoutes";
import { registerSearchEngineRoutes } from "./registerSearchEngineRoutes";
import { registerShareRoutes } from "./registerShareRoutes";
import { registerSnippetsRoutes } from "./registerSnippetsRoutes";
import type { Bindings } from "./serverTypes";

type GitHubUser = {
  id: number;
  login: string;
  name?: string | null;
  avatar_url?: string | null;
};

type LinuxDoUser = {
  sub?: string;
  id?: string | number;
  preferred_username?: string | null;
  username?: string | null;
  name?: string | null;
  picture?: string | null;
  avatar_url?: string | null;
};

const app = new Hono<{ Bindings: Bindings }>();

const createSession = async (c: { env: Bindings }, userId: string) => {
  const sessionId = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  await c.env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`)
    .bind(sessionId, userId, expiresAt)
    .run();
  return sessionId;
};

const upsertOAuthUser = async (c: { env: Bindings }, provider: AuthProvider, profile: OAuthUserProfile) => {
  const userId = `${provider}_${profile.providerUserId}`;
  await c.env.DB.prepare(
    `INSERT INTO users (id, provider, provider_user_id, username, name, avatar_url)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider, provider_user_id) DO UPDATE SET
       username = excluded.username,
       name = excluded.name,
       avatar_url = excluded.avatar_url`,
  )
    .bind(userId, provider, profile.providerUserId, profile.username, profile.name, profile.avatarUrl)
    .run();
  return userId;
};

const exchangeCodeForAccessToken = async (c: { env: Bindings }, provider: AuthProvider, code: string) => {
  const config = getProviderConfig(provider);
  const clientId = config.getClientId(c.env);
  const clientSecret = config.getClientSecret(c.env);
  const redirectUri = getProviderCallbackUrl(c.env, provider);

  if (!clientId || !clientSecret) {
    throw new Error(`${getProviderDisplayName(provider)} OAuth 环境变量未配置完整`);
  }

  const params = new URLSearchParams();
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", redirectUri);

  const credential = btoa(`${clientId}:${clientSecret}`);
  const tokenUrls = [config.tokenUrl, ...(config.tokenFallbackUrls || [])];
  let lastError = "未知错误";

  for (const tokenUrl of tokenUrls) {
    try {
      const tokenRes = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${credential}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const tokenData = (await tokenRes.json()) as {
        access_token?: string;
        error?: string;
        error_description?: string;
      };
      if (tokenData.access_token) {
        return tokenData.access_token;
      }

      lastError = tokenData.error_description || tokenData.error || `HTTP ${tokenRes.status}`;
      console.error(`${getProviderDisplayName(provider)} token 交换失败:`, { tokenUrl, lastError });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error(`${getProviderDisplayName(provider)} token 交换异常:`, { tokenUrl, lastError });
    }
  }

  throw new Error(`${getProviderDisplayName(provider)} access token 获取失败: ${lastError}`);
};

const fetchGithubUserProfile = async (accessToken: string): Promise<OAuthUserProfile> => {
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "dev-toolkit-pro",
    },
  });
  if (!userRes.ok) {
    throw new Error(`获取 GitHub 用户信息失败: ${await userRes.text()}`);
  }

  const githubUser = (await userRes.json()) as GitHubUser;
  return {
    providerUserId: String(githubUser.id),
    username: githubUser.login,
    name: githubUser.name || githubUser.login,
    avatarUrl: githubUser.avatar_url || "",
  };
};

const getLinuxDoUserUrls = () => {
  const config = getProviderConfig("linuxdo");
  return [config.userInfoUrl || "https://connect.linux.do/api/user", ...(config.userInfoFallbackUrls || [])];
};

const mapLinuxDoUserProfile = (linuxDoUser: LinuxDoUser): OAuthUserProfile => {
  const providerUserId = linuxDoUser.sub || (linuxDoUser.id ? String(linuxDoUser.id) : "");
  const username = linuxDoUser.preferred_username || linuxDoUser.username || "";
  if (!providerUserId || !username) {
    throw new Error("LINUX DO 返回的用户信息缺少必要字段");
  }

  return {
    providerUserId,
    username,
    name: linuxDoUser.name || username,
    avatarUrl: linuxDoUser.picture || linuxDoUser.avatar_url || "",
  };
};

const requestLinuxDoUserProfile = async (userUrl: string, accessToken: string): Promise<OAuthUserProfile> => {
  const userRes = await fetch(userUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!userRes.ok) {
    throw new Error(await userRes.text());
  }

  const linuxDoUser = (await userRes.json()) as LinuxDoUser;
  return mapLinuxDoUserProfile(linuxDoUser);
};

const fetchLinuxDoUserProfile = async (accessToken: string): Promise<OAuthUserProfile> => {
  const userUrls = getLinuxDoUserUrls();
  let lastError = "未知错误";

  for (const userUrl of userUrls) {
    try {
      return await requestLinuxDoUserProfile(userUrl, accessToken);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error("获取 LINUX DO 用户信息异常:", { userUrl, lastError });
    }
  }

  throw new Error(`获取 LINUX DO 用户信息失败: ${lastError}`);
};

const fetchOAuthUserProfile = (provider: AuthProvider, accessToken: string) => {
  if (provider === "github") return fetchGithubUserProfile(accessToken);
  return fetchLinuxDoUserProfile(accessToken);
};

const buildProviderAuthUrl = (c: { env: Bindings }, provider: AuthProvider) => {
  const config = getProviderConfig(provider);
  const clientId = config.getClientId(c.env);

  if (!clientId) {
    return {
      error: `未配置 ${provider === "github" ? "GITHUB_CLIENT_ID" : "LINUX_DO_CLIENT_ID"}`,
      redirectUri: "",
    };
  }

  const redirectUri = getProviderCallbackUrl(c.env, provider);
  const authUrl = new URL(config.authorizeUrl);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", config.scope);

  return { url: authUrl.toString(), redirectUri };
};

const handleOAuthCallback =
  (provider: AuthProvider, displayName: string) => async (c: Context<{ Bindings: Bindings }>) => {
    console.log(`已进入 ${displayName} 登录回调`);
    const code = c.req.query("code");
    if (!code) return c.json({ error: `缺少 ${displayName} 授权码` }, 400);

    try {
      const frontendUrl = getFrontendUrl(c.env);
      const accessToken = await exchangeCodeForAccessToken(c, provider, code);
      const profile = await fetchOAuthUserProfile(provider, accessToken);
      const userId = await upsertOAuthUser(c, provider, profile);
      const sessionId = await createSession(c, userId);

      setCookie(c, "auth_session", sessionId, {
        path: "/",
        httpOnly: true,
        secure: shouldUseSecureCookie(frontendUrl),
        sameSite: "Lax",
        maxAge: 60 * 60 * 24 * 30,
      });

      console.log(`${displayName} 登录成功，正在跳转首页`);
      return c.redirect(frontendUrl, 302);
    } catch (error) {
      console.error(`${displayName} 鉴权异常:`, error);
      return c.text(`${displayName} 登录失败`, 500);
    }
  };

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
  const result = buildProviderAuthUrl(c, "github");
  console.log("收到 GitHub 登录地址请求:", {
    hasClientId: !("error" in result),
    redirectUri: result.redirectUri,
  });
  if ("error" in result) return c.json({ error: result.error }, 500);
  console.log("已生成 GitHub 授权地址");
  return c.json({ url: result.url });
});

app.get("/api/auth/github/callback", handleOAuthCallback("github", "GitHub"));

app.get("/api/auth/linuxdo/login", (c) => {
  const result = buildProviderAuthUrl(c, "linuxdo");
  console.log("收到 LINUX DO 登录地址请求:", {
    hasClientId: !("error" in result),
    redirectUri: result.redirectUri,
  });
  if ("error" in result) return c.json({ error: result.error }, 500);
  console.log("已生成 LINUX DO 授权地址");
  return c.json({ url: result.url });
});

app.get("/api/auth/linuxdo/callback", handleOAuthCallback("linuxdo", "LINUX DO"));

app.get("/api/auth/callback", (c) =>
  c.redirect(`/api/auth/github/callback?${new URL(c.req.url).searchParams.toString()}`, 302),
);

app.get("/api/auth/me", async (c) => {
  const sessionId = getCookie(c, "auth_session");
  if (!sessionId) return c.json({ user: null });

  try {
    const result = await c.env.DB.prepare(
      `SELECT users.id, users.provider, users.provider_user_id, users.username, users.name, users.avatar_url
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
        const existing = await env.DB.prepare("SELECT * FROM shares WHERE id = ?").bind(match[1]).first();
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
        return Response.redirect(`${env.FRONTEND_URL || url.origin}/share-preview/${match[1]}`, 302);
      } catch (error) {
        console.error("CRITICAL: Share system failure:", error);
      }
    }

    return app.fetch(request, env, ctx);
  },
};
