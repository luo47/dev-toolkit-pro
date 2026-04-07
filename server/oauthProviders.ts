import type { Bindings } from "./serverTypes";

export type AuthProvider = "github" | "linuxdo";

type ProviderConfig = {
  authorizeUrl: string;
  tokenUrl: string;
  tokenFallbackUrls?: string[];
  userInfoUrl?: string;
  userInfoFallbackUrls?: string[];
  scope: string;
  getClientId: (env: Bindings) => string | undefined;
  getClientSecret: (env: Bindings) => string | undefined;
  getCallbackPath: () => string;
};

export type OAuthUserProfile = {
  providerUserId: string;
  username: string;
  name: string;
  avatarUrl: string;
};

const providerConfigs: Record<AuthProvider, ProviderConfig> = {
  github: {
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scope: "read:user",
    getClientId: (env) => env.GITHUB_CLIENT_ID,
    getClientSecret: (env) => env.GITHUB_CLIENT_SECRET,
    getCallbackPath: () => "/api/auth/github/callback",
  },
  linuxdo: {
    authorizeUrl: "https://connect.linux.do/oauth2/authorize",
    tokenUrl: "https://connect.linux.do/oauth2/token",
    tokenFallbackUrls: ["https://connect.linuxdo.org/oauth2/token"],
    userInfoUrl: "https://connect.linux.do/api/user",
    userInfoFallbackUrls: ["https://connect.linuxdo.org/api/user"],
    scope: "read",
    getClientId: (env) => env.LINUX_DO_CLIENT_ID,
    getClientSecret: (env) => env.LINUX_DO_CLIENT_SECRET,
    getCallbackPath: () => "/api/auth/linuxdo/callback",
  },
};

export const getFrontendUrl = (env: Bindings) => env.FRONTEND_URL || "http://localhost:3000";

export const getOAuthCallbackBaseUrl = (env: Bindings) => env.OAUTH_CALLBACK_BASE_URL || getFrontendUrl(env);

export const shouldUseSecureCookie = (url: string) => {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
};

export const getProviderConfig = (provider: AuthProvider) => providerConfigs[provider];

export const getProviderDisplayName = (provider: AuthProvider) => (provider === "github" ? "GitHub" : "LINUX DO");

export const getProviderCallbackUrl = (env: Bindings, provider: AuthProvider) =>
  `${getOAuthCallbackBaseUrl(env)}${getProviderConfig(provider).getCallbackPath()}`;
