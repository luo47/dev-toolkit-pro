import type { Hono } from "hono";
import type { Bindings } from "./serverTypes";

type ProxyRequestBody = {
  url?: string;
  token?: string;
  endpoint?: string;
  method?: string;
  payload?: unknown;
};

const buildProxyRequest = (body: {
  url?: string;
  token?: string;
  endpoint?: string;
  method?: string;
  payload?: unknown;
}) => {
  const baseUrl = (body.url || "").trim();
  const token = (body.token || "").trim();
  const endpoint = (body.endpoint || "/models").trim();
  const method = (body.method || "GET").toUpperCase();
  if (!baseUrl || !token) return null;

  const finalBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const finalEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const headers = new Headers({
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
  });
  const requestInit: RequestInit = { method, headers };
  if (body.payload !== undefined && method !== "GET" && method !== "HEAD") {
    requestInit.body = JSON.stringify(body.payload);
  }
  return { finalUrl: `${finalBaseUrl}${finalEndpoint}`, requestInit };
};

export const registerOpenAiRoutes = (app: Hono<{ Bindings: Bindings }>) => {
  app.post("/api/openai/test", async (c) => {
    try {
      const body = (await c.req.json()) as ProxyRequestBody;

      const proxyRequest = buildProxyRequest(body);
      if (!proxyRequest) {
        return c.json({ success: false, error: "缺少 API Base URL 或 Token" }, 400);
      }

      const response = await fetch(proxyRequest.finalUrl, proxyRequest.requestInit);
      const contentType = response.headers.get("content-type") || "";
      const responseText = await response.text();
      let parsedData: unknown = responseText;

      if (contentType.includes("application/json")) {
        try {
          parsedData = JSON.parse(responseText);
        } catch {
          parsedData = responseText;
        }
      }

      if (!response.ok) {
        return c.json(
          {
            success: false,
            error: `接口返回异常：${response.status} ${response.statusText}`,
            details: parsedData,
            status: response.status,
            url: proxyRequest.finalUrl,
          },
          response.status as 400 | 401 | 403 | 404 | 405 | 429 | 500,
        );
      }

      return c.json({
        success: true,
        data: parsedData,
        status: response.status,
        url: proxyRequest.finalUrl,
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: "代理请求失败",
          details: error instanceof Error ? error.message : "未知错误",
        },
        { status: 500 },
      );
    }
  });
};
