import type { Context } from "hono";

export type FileItem = {
  key: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
};

export type Bindings = {
  DB: D1Database;
  SHARE_KV: KVNamespace;
  SHARE_R2: R2Bucket;
  ASSETS: Fetcher;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  LINUX_DO_CLIENT_ID: string;
  LINUX_DO_CLIENT_SECRET: string;
  FRONTEND_URL: string;
  OAUTH_CALLBACK_BASE_URL: string;
};

export type AppContext = Context<{ Bindings: Bindings }>;
