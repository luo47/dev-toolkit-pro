import type { HistoryItem } from "./helpers";

export const HISTORY_KEY = "openai-api-tester-history";

const normalizeBaseUrl = (url: string) => url.trim().replace(/\/+$/, "");

export const readHistory = () => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryItem[]) : [];
  } catch (error) {
    console.error("读取 OPENAI API 测试历史失败", error);
    return [];
  }
};

export const buildHistory = (
  history: HistoryItem[],
  url: string,
  token: string,
  customModel?: string,
  models?: string[],
) =>
  [
    { url, token, customModel, models, timestamp: Date.now() },
    ...history.filter((item) => item.url !== url || item.token !== token || item.customModel !== customModel),
  ].slice(0, 10);

export const persistHistory = (history: HistoryItem[]) => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
};

export const maskToken = (token: string) => (token.length <= 10 ? token : `${token.slice(0, 6)}...${token.slice(-4)}`);

export const getHistoryDomain = (url: string) => {
  const normalizedUrl = url.trim();
  if (!normalizedUrl) return "";

  try {
    return new URL(normalizedUrl).hostname.toLowerCase();
  } catch {
    return normalizeBaseUrl(normalizedUrl).toLowerCase();
  }
};

export const dedupeHistoryByDomain = (history: HistoryItem[]) => {
  const domainMap = new Map<string, HistoryItem>();

  for (const item of history) {
    const domain = getHistoryDomain(item.url);
    if (!domainMap.has(domain)) {
      domainMap.set(domain, item);
    }
  }

  return Array.from(domainMap.values());
};
