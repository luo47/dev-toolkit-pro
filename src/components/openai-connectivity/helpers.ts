export type TestStatus = "idle" | "loading" | "success" | "error" | "warning";

export type HistoryItem = {
  url: string;
  token: string;
  customModel?: string;
  timestamp: number;
};

export type TestState = {
  status: TestStatus;
  title: string;
  description: string;
  url?: string;
  data?: any;
  error?: string;
  details?: any;
  requestedModel?: string;
  requestBody?: any;
};

export type ProxyResult = {
  success: boolean;
  data?: any;
  error?: string;
  details?: any;
  status?: number;
  url?: string;
};

export const HISTORY_KEY = "openai-api-tester-history";
export const DEFAULT_URL = "https://api.openai.com/v1";
const PREFERRED_MODELS = ["gpt-4.1-mini", "gpt-4o-mini", "gpt-4.1", "gpt-4o", "gpt-3.5-turbo"];

export const createIdleState = (title: string): TestState => ({
  status: "idle",
  title,
  description: "",
});

export const maskToken = (token: string) =>
  token.length <= 10 ? token : `${token.slice(0, 6)}...${token.slice(-4)}`;

const parsePossibleJson = (data: any) => {
  if (typeof data !== "string") return data;
  if (!data.trim().startsWith("{") && !data.trim().startsWith("[")) return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

const extractOutputChunks = (output: any[]) =>
  output
    .map((item) => {
      if (typeof item === "string") return item;
      if (!Array.isArray(item?.content)) return item?.text || item?.content || "";
      return item.content
        .map((sub: any) => (typeof sub === "string" ? sub : sub?.text || sub?.content || ""))
        .filter(Boolean)
        .join("");
    })
    .filter(Boolean);

const readSimpleText = (target: any) =>
  target?.choices?.[0]?.message?.content ||
  target?.output_text ||
  target?.text ||
  target?.content ||
  "";

const readFallbackString = (data: any) => {
  if (typeof data !== "string") return "";
  const match = data.match(/"content"\s*:\s*"([^"]+)"/);
  if (match?.[1]) return match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
  return data;
};

export function extractTextFromResponse(data: any): string {
  if (!data) return "无响应数据";
  const target = parsePossibleJson(data);
  const errorMessage = target?.error?.message || target?.error;
  if (typeof errorMessage === "string" && errorMessage.trim()) return `Error: ${errorMessage}`;

  const simpleText = readSimpleText(target);
  if (typeof simpleText === "string" && simpleText.trim()) return simpleText;

  if (Array.isArray(target.output)) {
    const chunks = extractOutputChunks(target.output);
    if (chunks.length > 0) return chunks.join("\n");
  }

  return readFallbackString(data) || "接口可用，但无法解析出文本内容（请检查原始报文）";
}

export const detectBestModel = (models: any[]): string => {
  const ids = models.map((item) => item?.id).filter(Boolean);
  for (const preferred of PREFERRED_MODELS) {
    if (ids.includes(preferred)) return preferred;
  }
  return ids[0] || "gpt-4.1-mini";
};

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
) =>
  [
    { url, token, customModel, timestamp: Date.now() },
    ...history.filter(
      (item) => item.url !== url || item.token !== token || item.customModel !== customModel,
    ),
  ].slice(0, 10);

export const persistHistory = (history: HistoryItem[]) => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
};

const runProxyTest = async (
  url: string,
  token: string,
  payload: { endpoint: string; method?: string; payload?: unknown },
): Promise<ProxyResult> => {
  const response = await fetch("/api/openai/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: url.trim(),
      token: token.trim(),
      endpoint: payload.endpoint,
      method: payload.method || "GET",
      payload: payload.payload,
    }),
  });

  const rawText = await response.text();
  if (!rawText.trim()) {
    return {
      success: false,
      error: "代理接口返回空响应",
      details: {
        status: response.status,
        statusText: response.statusText,
        endpoint: payload.endpoint,
      },
    };
  }

  try {
    return JSON.parse(rawText) as ProxyResult;
  } catch {
    return {
      success: false,
      error: "代理接口返回了无法解析的内容",
      details: {
        status: response.status,
        statusText: response.statusText,
        rawText: rawText.slice(0, 1000),
        endpoint: payload.endpoint,
      },
    };
  }
};

const createWarningState = (title: string, error: string): TestState => ({
  ...createIdleState(title),
  status: "warning",
  error,
});

const buildSuccessState = (
  title: string,
  url: string,
  data: any,
  requestedModel: string,
  requestBody?: any,
): TestState => ({
  ...createIdleState(title),
  status: "success",
  url,
  data,
  requestBody,
  requestedModel,
});

const buildErrorState = (
  title: string,
  url: string,
  error: string,
  details: any,
  requestedModel?: string,
  requestBody?: any,
  warning = false,
): TestState => ({
  ...createIdleState(title),
  status: warning ? "warning" : "error",
  url,
  error,
  details,
  requestBody,
  requestedModel,
});

const buildChatState = async (
  normalizedBase: string,
  url: string,
  token: string,
  selectedModel: string,
) => {
  const chatPayload = {
    model: selectedModel,
    messages: [{ role: "user", content: "你好" }],
    max_tokens: 32,
  };
  const result = await runProxyTest(url, token, {
    endpoint: "/chat/completions",
    method: "POST",
    payload: chatPayload,
  });
  const targetUrl = result.url || `${normalizedBase}/chat/completions`;
  return result.success
    ? buildSuccessState("Chat Completions 检测", targetUrl, result.data, selectedModel, chatPayload)
    : buildErrorState(
        "Chat Completions 检测",
        targetUrl,
        result.error || "Chat Completions 检测失败",
        result.details,
        selectedModel,
        chatPayload,
      );
};

const buildResponsesState = async (
  normalizedBase: string,
  url: string,
  token: string,
  selectedModel: string,
) => {
  const responsesPayload = {
    model: selectedModel,
    input: "你好",
    instructions: "You are a helpful coding assistant.",
  };
  const result = await runProxyTest(url, token, {
    endpoint: "/responses",
    method: "POST",
    payload: responsesPayload,
  });
  const targetUrl = result.url || `${normalizedBase}/responses`;
  const warning = [400, 404, 405].includes(result.status || 0);
  return result.success
    ? buildSuccessState("Responses 检测", targetUrl, result.data, selectedModel, responsesPayload)
    : buildErrorState(
        "Responses 检测",
        targetUrl,
        result.error || "Responses 检测失败",
        result.details,
        selectedModel,
        responsesPayload,
        warning,
      );
};

export const executeConnectivityTests = async ({
  customModel,
  token,
  url,
}: {
  customModel: string;
  token: string;
  url: string;
}) => {
  const normalizedBase = url.trim().replace(/\/+$/, "");
  const modelsResult = await runProxyTest(url, token, { endpoint: "/models" });

  if (!modelsResult.success) {
    return {
      selectedModel: "",
      modelsState: buildErrorState(
        "模型列表检测",
        modelsResult.url || `${normalizedBase}/models`,
        modelsResult.error || "模型列表检测失败",
        modelsResult.details,
      ),
      chatState: createWarningState("Chat Completions 检测", "已跳过：模型列表检测未通过。"),
      responsesState: createWarningState("Responses 检测", "已跳过：模型列表检测未通过。"),
    };
  }

  const models = Array.isArray(modelsResult.data?.data) ? modelsResult.data.data : [];
  const selectedModel = customModel.trim() || detectBestModel(models);

  return {
    selectedModel,
    modelsState: buildSuccessState(
      "模型列表检测",
      modelsResult.url || `${normalizedBase}/models`,
      modelsResult.data,
      selectedModel,
    ),
    chatState: await buildChatState(normalizedBase, url, token, selectedModel),
    responsesState: await buildResponsesState(normalizedBase, url, token, selectedModel),
  };
};
