import assert from "node:assert/strict";
import test from "node:test";
import {
  dedupeHistoryByDomain,
  executeConnectivityTests,
  extractTextFromResponse,
  getHistoryDomain,
  type JsonValue,
  URL_STRATEGY_KEY,
} from "./helpers";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.has(key) ? (this.store.get(key) ?? null) : null;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

type MockResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  body: JsonValue;
};

const originalFetch = globalThis.fetch;
const originalLocalStorage = globalThis.localStorage;

const buildJsonResponse = (response: MockResponse) =>
  new Response(
    JSON.stringify(
      response.ok
        ? {
            success: true,
            data: response.body,
            status: response.status,
          }
        : {
            success: false,
            error: `接口返回异常：${response.status} ${response.statusText}`,
            details: response.body,
            status: response.status,
          },
    ),
    {
      status: response.status,
      statusText: response.statusText,
      headers: { "Content-Type": "application/json" },
    },
  );

test.beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: new MemoryStorage(),
  });
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: originalLocalStorage,
  });
});

test("模型探测失败后会自动补上 /v1，并把成功策略缓存下来", async () => {
  const requestedUrls: string[] = [];
  const responses = new Map<string, MockResponse>([
    [
      "https://example.com/models",
      {
        ok: false,
        status: 404,
        statusText: "Not Found",
        body: { error: { message: "没有这个接口" } },
      },
    ],
    [
      "https://example.com/v1/models",
      {
        ok: true,
        status: 200,
        statusText: "OK",
        body: { data: [{ id: "gpt-4o-mini" }] },
      },
    ],
    [
      "https://example.com/v1/chat/completions",
      {
        ok: true,
        status: 200,
        statusText: "OK",
        body: { choices: [{ message: { content: "你好" } }] },
      },
    ],
    [
      "https://example.com/v1/responses",
      {
        ok: true,
        status: 200,
        statusText: "OK",
        body: { output_text: "你好" },
      },
    ],
    [
      "https://example.com/v1/messages",
      {
        ok: true,
        status: 200,
        statusText: "OK",
        body: { content: [{ text: "你好" }] },
      },
    ],
  ]);

  globalThis.fetch = async (input, init) => {
    assert.equal(typeof input, "string");
    requestedUrls.push(input);
    const bodyText = typeof init?.body === "string" ? init.body : "{}";
    const body = JSON.parse(bodyText) as { url: string; endpoint: string };
    const targetUrl = `${body.url}${body.endpoint}`;
    const response = responses.get(targetUrl);
    assert.ok(response, `未为 ${targetUrl} 提供模拟响应`);
    return buildJsonResponse(response);
  };

  const result = await executeConnectivityTests({
    customModel: "",
    token: "sk-test",
    url: "https://example.com",
  });

  assert.equal(result.modelsState.status, "success");
  assert.equal(result.modelsState.url, "https://example.com/v1/models");
  assert.equal(result.chatState.url, "https://example.com/v1/chat/completions");
  assert.equal(result.responsesState.url, "https://example.com/v1/responses");
  assert.equal(result.messagesState.url, "https://example.com/v1/messages");
  assert.deepEqual(requestedUrls, [
    "/api/openai/test",
    "/api/openai/test",
    "/api/openai/test",
    "/api/openai/test",
    "/api/openai/test",
  ]);

  const strategyCache = JSON.parse(localStorage.getItem(URL_STRATEGY_KEY) || "{}") as Record<string, string>;
  assert.equal(strategyCache["https://example.com"], "with-v1");
});

test("命中缓存后会优先使用已记住的 /v1 策略", async () => {
  localStorage.setItem(
    URL_STRATEGY_KEY,
    JSON.stringify({
      "https://example.com": "with-v1",
    }),
  );

  const targetUrls: string[] = [];
  globalThis.fetch = async (_input, init) => {
    const bodyText = typeof init?.body === "string" ? init.body : "{}";
    const body = JSON.parse(bodyText) as { url: string; endpoint: string };
    const targetUrl = `${body.url}${body.endpoint}`;
    targetUrls.push(targetUrl);
    return buildJsonResponse({
      ok: true,
      status: 200,
      statusText: "OK",
      body:
        body.endpoint === "/models"
          ? { data: [{ id: "gpt-4o-mini" }] }
          : { choices: [{ message: { content: "你好" } }], output_text: "你好", content: [{ text: "你好" }] },
    });
  };

  await executeConnectivityTests({
    customModel: "",
    token: "sk-test",
    url: "https://example.com",
  });

  assert.deepEqual(targetUrls, [
    "https://example.com/v1/models",
    "https://example.com/v1/chat/completions",
    "https://example.com/v1/responses",
    "https://example.com/v1/messages",
  ]);
});

test("当带 /v1 的地址返回空模型数据时，会自动回退到不带 /v1 的地址", async () => {
  const targetUrls: string[] = [];
  const responses = new Map<string, MockResponse>([
    [
      "https://example.com/v1/models",
      {
        ok: true,
        status: 200,
        statusText: "OK",
        body: { data: [] },
      },
    ],
    [
      "https://example.com/models",
      {
        ok: true,
        status: 200,
        statusText: "OK",
        body: { data: [{ id: "claude-3-5-sonnet" }] },
      },
    ],
    [
      "https://example.com/chat/completions",
      {
        ok: true,
        status: 200,
        statusText: "OK",
        body: { choices: [{ message: { content: "你好" } }] },
      },
    ],
    [
      "https://example.com/responses",
      {
        ok: false,
        status: 404,
        statusText: "Not Found",
        body: { error: { message: "不支持 responses" } },
      },
    ],
    [
      "https://example.com/messages",
      {
        ok: true,
        status: 200,
        statusText: "OK",
        body: { content: [{ text: "你好" }] },
      },
    ],
  ]);

  globalThis.fetch = async (_input, init) => {
    const bodyText = typeof init?.body === "string" ? init.body : "{}";
    const body = JSON.parse(bodyText) as { url: string; endpoint: string };
    const targetUrl = `${body.url}${body.endpoint}`;
    targetUrls.push(targetUrl);
    const response = responses.get(targetUrl);
    assert.ok(response, `未为 ${targetUrl} 提供模拟响应`);
    return buildJsonResponse(response);
  };

  const result = await executeConnectivityTests({
    customModel: "",
    token: "sk-test",
    url: "https://example.com/v1",
  });

  assert.equal(result.modelsState.url, "https://example.com/models");
  assert.equal(result.chatState.url, "https://example.com/chat/completions");
  assert.equal(result.messagesState.url, "https://example.com/messages");
  assert.deepEqual(targetUrls, [
    "https://example.com/v1/models",
    "https://example.com/models",
    "https://example.com/chat/completions",
    "https://example.com/responses",
    "https://example.com/messages",
  ]);

  const strategyCache = JSON.parse(localStorage.getItem(URL_STRATEGY_KEY) || "{}") as Record<string, string>;
  assert.equal(strategyCache["https://example.com"], "without-v1");
});

test("可以从 messages 接口返回的 content 数组中提取文本", () => {
  const text = extractTextFromResponse({
    id: "resp_xxx",
    type: "message",
    role: "assistant",
    content: [{ type: "text", text: "你好！有什么我可以帮助你的吗？" }],
    model: "gpt-4o",
    stop_reason: "end_turn",
  });

  assert.equal(text, "你好！有什么我可以帮助你的吗？");
});

test("可以从历史 URL 中提取域名，并在异常 URL 时回退到原始文本", () => {
  assert.equal(getHistoryDomain("https://Api.OpenAI.com/v1"), "api.openai.com");
  assert.equal(getHistoryDomain(" custom-domain.example.com/v1 "), "custom-domain.example.com/v1");
});

test("历史记录会按域名去重，并保留每个域名最新的一条", () => {
  const history = [
    { url: "https://new.145678.xyz/v1", token: "sk-1", timestamp: 3 },
    { url: "https://ice.vv.ua/v1", token: "sk-2", timestamp: 2, customModel: "gpt-4.1" },
    { url: "https://new.145678.xyz/v1/chat", token: "sk-3", timestamp: 1, customModel: "gpt-4.1-mini" },
  ];

  assert.deepEqual(dedupeHistoryByDomain(history), [history[0], history[1]]);
});
