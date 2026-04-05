export type TestStatus = "idle" | "loading" | "success" | "error" | "warning";

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue;
}

export type ModelItem = {
  id: string;
};

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
  data?: JsonValue;
  error?: string;
  details?: JsonValue;
  requestedModel?: string;
  requestBody?: JsonValue;
};

export type ProxyResult = {
  success: boolean;
  data?: JsonValue;
  error?: string;
  details?: JsonValue;
  status?: number;
  url?: string;
};

export const HISTORY_KEY = "openai-api-tester-history";
export const URL_STRATEGY_KEY = "openai-api-tester-url-strategy";
export const DEFAULT_URL = "https://api.openai.com/v1";
const PREFERRED_MODELS = ["gpt-4.1-mini", "gpt-4o-mini", "gpt-4.1", "gpt-4o", "gpt-3.5-turbo"];
type UrlStrategy = "with-v1" | "without-v1";
type StrategyMap = Record<string, UrlStrategy>;

export const createIdleState = (title: string): TestState => ({
  status: "idle",
  title,
  description: "",
});

export const maskToken = (token: string) => (token.length <= 10 ? token : `${token.slice(0, 6)}...${token.slice(-4)}`);

const asObject = (value: JsonValue | undefined): JsonObject | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? value : undefined;

const asArray = (value: JsonValue | undefined): JsonValue[] | undefined => (Array.isArray(value) ? value : undefined);

const readObjectText = (value: JsonValue | undefined) => {
  const objectValue = asObject(value);
  if (!objectValue) return "";
  return (
    (typeof objectValue.text === "string" ? objectValue.text : "") ||
    (typeof objectValue.content === "string" ? objectValue.content : "") ||
    ""
  );
};

const parsePossibleJson = (data: JsonValue | undefined) => {
  if (typeof data !== "string") return data;
  if (!data.trim().startsWith("{") && !data.trim().startsWith("[")) return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

const extractOutputChunks = (output: JsonValue[]) =>
  output
    .map((item) => {
      if (typeof item === "string") return item;
      const objectItem = asObject(item);
      if (!objectItem) return "";
      const content = objectItem.content;
      if (!Array.isArray(content)) return readObjectText(item);
      return content
        .map((sub) => (typeof sub === "string" ? sub : readObjectText(sub)))
        .filter(Boolean)
        .join("");
    })
    .filter(Boolean);

const readSimpleText = (target: JsonValue | undefined) => {
  const targetObject = asObject(target);
  if (!targetObject) return "";

  const choices = asArray(targetObject.choices);
  const firstChoice = choices?.[0];
  const firstChoiceObject = asObject(firstChoice);
  const messageObject = asObject(firstChoiceObject?.message);
  const contentValue = targetObject.content;
  const contentItems = asArray(contentValue);
  const contentText = contentItems
    ?.map((item) => {
      if (typeof item === "string") return item;
      const objectItem = asObject(item);
      return readObjectText(objectItem);
    })
    .filter(Boolean)
    .join("\n");

  return (
    (typeof messageObject?.content === "string" ? messageObject.content : "") ||
    (Array.isArray(messageObject?.content)
      ? messageObject.content
          .map((item) => (typeof item === "string" ? item : readObjectText(item)))
          .filter(Boolean)
          .join("\n")
      : "") ||
    (typeof targetObject.output_text === "string" ? targetObject.output_text : "") ||
    (typeof targetObject.text === "string" ? targetObject.text : "") ||
    (typeof contentText === "string" ? contentText : "") ||
    (typeof targetObject.content === "string" ? targetObject.content : "") ||
    ""
  );
};

const readFallbackString = (data: JsonValue | undefined) => {
  if (typeof data !== "string") return "";
  const match = data.match(/"content"\s*:\s*"([^"]+)"/);
  if (match?.[1]) return match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
  return data;
};

export function extractTextFromResponse(data: JsonValue | undefined): string {
  if (!data) return "无响应数据";
  const target = parsePossibleJson(data);
  const targetObject = asObject(target);
  const errorValue = targetObject?.error;
  const errorObject = asObject(errorValue);
  const errorMessage =
    (typeof errorObject?.message === "string" ? errorObject.message : undefined) ||
    (typeof errorValue === "string" ? errorValue : undefined);
  if (typeof errorMessage === "string" && errorMessage.trim()) return `Error: ${errorMessage}`;

  const simpleText = readSimpleText(target);
  if (typeof simpleText === "string" && simpleText.trim()) return simpleText;

  const output = asArray(targetObject?.output);
  if (output) {
    const chunks = extractOutputChunks(output);
    if (chunks.length > 0) return chunks.join("\n");
  }

  return readFallbackString(data) || "接口可用，但无法解析出文本内容（请检查原始报文）";
}

export const detectBestModel = (models: ModelItem[]): string => {
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

export const buildHistory = (history: HistoryItem[], url: string, token: string, customModel?: string) =>
  [
    { url, token, customModel, timestamp: Date.now() },
    ...history.filter((item) => item.url !== url || item.token !== token || item.customModel !== customModel),
  ].slice(0, 10);

export const persistHistory = (history: HistoryItem[]) => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
};

const normalizeBaseUrl = (url: string) => url.trim().replace(/\/+$/, "");

const ensureV1Suffix = (url: string) => {
  const normalized = normalizeBaseUrl(url);
  return /\/v1$/i.test(normalized) ? normalized : `${normalized}/v1`;
};

const removeV1Suffix = (url: string) => normalizeBaseUrl(url).replace(/\/v1$/i, "");

const readStrategyMap = (): StrategyMap => {
  try {
    const raw = localStorage.getItem(URL_STRATEGY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as StrategyMap) : {};
  } catch (error) {
    console.error("读取 URL 策略缓存失败", error);
    return {};
  }
};

const persistStrategyMap = (value: StrategyMap) => {
  localStorage.setItem(URL_STRATEGY_KEY, JSON.stringify(value));
};

const getStrategyKey = (url: string) => {
  try {
    return new URL(normalizeBaseUrl(url)).origin;
  } catch {
    return "";
  }
};

const resolveStrategyFromUrl = (url: string): UrlStrategy =>
  /\/v1$/i.test(normalizeBaseUrl(url)) ? "with-v1" : "without-v1";

const rememberUrlStrategy = (inputUrl: string, resolvedUrl: string) => {
  const strategyKey = getStrategyKey(inputUrl);
  if (!strategyKey) return;
  const current = readStrategyMap();
  current[strategyKey] = resolveStrategyFromUrl(resolvedUrl);
  persistStrategyMap(current);
};

const getCandidateBaseUrls = (url: string) => {
  const enteredUrl = normalizeBaseUrl(url);
  const withV1 = ensureV1Suffix(enteredUrl);
  const withoutV1 = removeV1Suffix(enteredUrl);
  const alternateUrl = /\/v1$/i.test(enteredUrl) ? withoutV1 : withV1;
  const strategyKey = getStrategyKey(enteredUrl);
  const preferredStrategy = strategyKey ? readStrategyMap()[strategyKey] : undefined;
  const preferredUrl =
    preferredStrategy === "with-v1" ? withV1 : preferredStrategy === "without-v1" ? withoutV1 : enteredUrl;

  return Array.from(new Set([preferredUrl, enteredUrl, alternateUrl].filter(Boolean)));
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

const hasUsableModels = (data: JsonValue | undefined) => {
  const payload = asObject(data);
  const models = asArray(payload?.data);
  return Array.isArray(models) && models.length > 0;
};

const probeModelsBaseUrl = async (url: string, token: string) => {
  let lastResult: ProxyResult | null = null;

  for (const candidate of getCandidateBaseUrls(url)) {
    const result = await runProxyTest(candidate, token, { endpoint: "/models" });
    lastResult = result;
    if (result.success && hasUsableModels(result.data)) {
      rememberUrlStrategy(url, candidate);
      return {
        result,
        resolvedBaseUrl: candidate,
      };
    }
  }

  return {
    result:
      lastResult ||
      ({
        success: false,
        error: "模型列表检测失败",
        url: `${normalizeBaseUrl(url)}/models`,
      } satisfies ProxyResult),
    resolvedBaseUrl: normalizeBaseUrl(url),
  };
};

const createWarningState = (title: string, error: string): TestState => ({
  ...createIdleState(title),
  status: "warning",
  error,
});

const buildSuccessState = (
  title: string,
  url: string,
  data: JsonValue,
  requestedModel: string,
  requestBody?: JsonValue,
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
  details: JsonValue,
  requestedModel?: string,
  requestBody?: JsonValue,
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

const buildChatState = async (normalizedBase: string, url: string, token: string, selectedModel: string) => {
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

const buildResponsesState = async (normalizedBase: string, url: string, token: string, selectedModel: string) => {
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

const buildMessagesState = async (normalizedBase: string, url: string, token: string, selectedModel: string) => {
  const messagesPayload = {
    model: selectedModel,
    max_tokens: 32,
    messages: [{ role: "user", content: "你好" }],
  };
  const result = await runProxyTest(url, token, {
    endpoint: "/messages",
    method: "POST",
    payload: messagesPayload,
  });
  const targetUrl = result.url || `${normalizedBase}/messages`;
  const warning = [400, 404, 405].includes(result.status || 0);
  return result.success
    ? buildSuccessState("Claude Code / Messages 检测", targetUrl, result.data, selectedModel, messagesPayload)
    : buildErrorState(
        "Claude Code / Messages 检测",
        targetUrl,
        result.error || "Claude Code / Messages 检测失败",
        result.details,
        selectedModel,
        messagesPayload,
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
  const { resolvedBaseUrl, result: modelsResult } = await probeModelsBaseUrl(url, token);
  const normalizedBase = normalizeBaseUrl(resolvedBaseUrl);

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
      messagesState: createWarningState("Claude Code / Messages 检测", "已跳过：模型列表检测未通过。"),
    };
  }

  const modelPayload = asObject(modelsResult.data);
  const modelList = asArray(modelPayload?.data);
  const models = (modelList?.filter(
    (item): item is ModelItem => !!asObject(item)?.id && typeof asObject(item)?.id === "string",
  ) || []) as ModelItem[];
  const selectedModel = customModel.trim() || detectBestModel(models);

  return {
    selectedModel,
    modelsState: buildSuccessState(
      "模型列表检测",
      modelsResult.url || `${normalizedBase}/models`,
      modelsResult.data,
      selectedModel,
    ),
    chatState: await buildChatState(normalizedBase, resolvedBaseUrl, token, selectedModel),
    responsesState: await buildResponsesState(normalizedBase, resolvedBaseUrl, token, selectedModel),
    messagesState: await buildMessagesState(normalizedBase, resolvedBaseUrl, token, selectedModel),
  };
};
