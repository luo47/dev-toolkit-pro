import type { ElementType, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Copy,
  FileJson,
  History,
  KeyRound,
  Loader2,
  MessageSquare,
  Play,
  PlugZap,
  RefreshCw,
  Server,
  ShieldAlert,
  Terminal,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';

type TestStatus = 'idle' | 'loading' | 'success' | 'error' | 'warning';

type HistoryItem = {
  url: string;
  token: string;
  timestamp: number;
};

type TestState = {
  status: TestStatus;
  title: string;
  description: string;
  url?: string;
  data?: any;
  error?: string;
  details?: any;
  requestedModel?: string;
};

type ProxyResult = {
  success: boolean;
  data?: any;
  error?: string;
  details?: any;
  status?: number;
  url?: string;
};

type TestStep = 'models' | 'chat' | 'responses';

const HISTORY_KEY = 'openai-api-tester-history';
const DEFAULT_URL = 'https://api.openai.com/v1';
const PREFERRED_MODELS = [
  'gpt-4.1-mini',
  'gpt-4o-mini',
  'gpt-4.1',
  'gpt-4o',
  'gpt-3.5-turbo',
];

function maskToken(token: string) {
  if (token.length <= 10) return token;
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function extractTextFromResponse(data: any): string {
  if (!data) return '未返回可读文本';
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text;
  if (Array.isArray(data.output)) {
    const chunks = data.output
      .flatMap((item: any) => item?.content || [])
      .map((item: any) => item?.text || item?.content || '')
      .filter(Boolean);
    if (chunks.length > 0) return chunks.join('\n');
  }
  return '接口可用，但未返回可读文本';
}

function detectBestModel(models: any[]): string {
  const ids = models.map((item) => item?.id).filter(Boolean);
  for (const preferred of PREFERRED_MODELS) {
    if (ids.includes(preferred)) return preferred;
  }
  return ids[0] || 'gpt-4.1-mini';
}

function StatusIcon({ status }: { status: TestStatus }) {
  if (status === 'success') return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
  if (status === 'error') return <XCircle className="w-5 h-5 text-red-500" />;
  if (status === 'warning') return <ShieldAlert className="w-5 h-5 text-amber-500" />;
  if (status === 'loading') return <Loader2 className="w-5 h-5 text-[var(--accent-color)] animate-spin" />;
  return <Clock3 className="w-5 h-5 text-[var(--text-secondary)]" />;
}

function ResultPanel({
  icon: Icon,
  state,
  children,
}: {
  icon: ElementType;
  state: TestState;
  children?: ReactNode;
}) {
  const toneClass = {
    idle: 'border-[var(--border-color)] bg-[var(--bg-surface)]',
    loading: 'border-[var(--accent-color)]/20 bg-[var(--accent-color)]/5',
    success: 'border-emerald-500/20 bg-emerald-500/5',
    error: 'border-red-500/20 bg-red-500/5',
    warning: 'border-amber-500/20 bg-amber-500/5',
  }[state.status];

  return (
    <section className={`rounded-[28px] border p-5 md:p-6 transition-colors ${toneClass}`}>
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-[var(--accent-color)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{state.title}</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">{state.description}</p>
            </div>
            <StatusIcon status={state.status} />
          </div>
          {state.url && (
            <p className="mt-3 text-xs font-mono break-all text-[var(--text-secondary)] opacity-80">
              {state.url}
            </p>
          )}
          {state.error && (
            <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-sm font-medium text-red-500">{state.error}</p>
              {state.details && (
                <pre className="mt-3 text-xs overflow-x-auto custom-scrollbar text-[var(--text-primary)]">
                  {JSON.stringify(state.details, null, 2)}
                </pre>
              )}
            </div>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}

export default function OpenAIConnectivityTool() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [token, setToken] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [modelsState, setModelsState] = useState<TestState>({
    status: 'idle',
    title: '模型列表检测',
    description: '验证 `/models` 是否可访问，并提取后续测试使用的模型。',
  });
  const [chatState, setChatState] = useState<TestState>({
    status: 'idle',
    title: 'Chat Completions 检测',
    description: '验证 `/chat/completions` 是否可用，并读取最小对话返回。',
  });
  const [responsesState, setResponsesState] = useState<TestState>({
    status: 'idle',
    title: 'Responses 检测',
    description: '验证 `/responses` 是否支持，优先对齐较新的 OpenAI 接口能力。',
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setHistory(parsed);
      }
    } catch (error) {
      console.error('读取 OPENAI API 测试历史失败', error);
    }
  }, []);

  const historyEmpty = useMemo(() => history.length === 0, [history]);

  const saveHistory = (nextUrl: string, nextToken: string) => {
    setHistory((prev) => {
      const deduped = prev.filter((item) => !(item.url === nextUrl && item.token === nextToken));
      const updated = [{ url: nextUrl, token: nextToken, timestamp: Date.now() }, ...deduped].slice(0, 12);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const resetStates = () => {
    setModelsState((prev) => ({ ...prev, status: 'idle', url: undefined, data: undefined, error: undefined, details: undefined, requestedModel: undefined }));
    setChatState((prev) => ({ ...prev, status: 'idle', url: undefined, data: undefined, error: undefined, details: undefined, requestedModel: undefined }));
    setResponsesState((prev) => ({ ...prev, status: 'idle', url: undefined, data: undefined, error: undefined, details: undefined, requestedModel: undefined }));
  };

  const runProxyTest = async (payload: {
    endpoint: string;
    method?: string;
    payload?: unknown;
  }): Promise<ProxyResult> => {
    const response = await fetch('/api/openai/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: url.trim(),
        token: token.trim(),
        endpoint: payload.endpoint,
        method: payload.method || 'GET',
        payload: payload.payload,
      }),
    });

    const rawText = await response.text();
    if (!rawText.trim()) {
      return {
        success: false,
        error: '代理接口返回空响应',
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
        error: '代理接口返回了无法解析的内容',
        details: {
          status: response.status,
          statusText: response.statusText,
          rawText: rawText.slice(0, 1000),
          endpoint: payload.endpoint,
        },
      };
    }
  };

  const handleRunTests = async () => {
    if (!url.trim() || !token.trim()) {
      window.showToast?.('请先填写 API 地址和 Token', 'error');
      setModelsState((prev) => ({ ...prev, status: 'error', error: '请先填写 API Base URL 和 Bearer Token。', details: undefined }));
      return;
    }

    setIsTesting(true);
    resetStates();

    let selectedModel = 'gpt-4.1-mini';
    let currentStep: TestStep = 'models';
    const normalizedBase = url.trim().replace(/\/+$/, '');

    try {
      currentStep = 'models';
      setModelsState((prev) => ({ ...prev, status: 'loading', url: `${normalizedBase}/models` }));
      const modelsResult = await runProxyTest({ endpoint: '/models' });

      if (!modelsResult.success) {
        setModelsState((prev) => ({
          ...prev,
          status: 'error',
          url: modelsResult.url || `${normalizedBase}/models`,
          error: modelsResult.error || '模型列表检测失败',
          details: modelsResult.details,
        }));
        setChatState((prev) => ({ ...prev, status: 'warning', error: '已跳过：模型列表检测未通过。' }));
        setResponsesState((prev) => ({ ...prev, status: 'warning', error: '已跳过：模型列表检测未通过。' }));
        return;
      }

      const models = Array.isArray(modelsResult.data?.data) ? modelsResult.data.data : [];
      selectedModel = detectBestModel(models);
      setModelsState((prev) => ({
        ...prev,
        status: 'success',
        url: modelsResult.url || `${normalizedBase}/models`,
        data: modelsResult.data,
        requestedModel: selectedModel,
      }));
      saveHistory(url.trim(), token.trim());

      currentStep = 'chat';
      setChatState((prev) => ({
        ...prev,
        status: 'loading',
        requestedModel: selectedModel,
        url: `${normalizedBase}/chat/completions`,
      }));
      const chatResult = await runProxyTest({
        endpoint: '/chat/completions',
        method: 'POST',
        payload: {
          model: selectedModel,
          messages: [{ role: 'user', content: '请回复“连接成功”四个字。' }],
          max_tokens: 32,
        },
      });

      if (!chatResult.success) {
        setChatState((prev) => ({
          ...prev,
          status: 'error',
          url: chatResult.url || `${normalizedBase}/chat/completions`,
          error: chatResult.error || 'Chat Completions 检测失败',
          details: chatResult.details,
          requestedModel: selectedModel,
        }));
      } else {
        setChatState((prev) => ({
          ...prev,
          status: 'success',
          url: chatResult.url || `${normalizedBase}/chat/completions`,
          data: chatResult.data,
          requestedModel: selectedModel,
        }));
      }

      currentStep = 'responses';
      setResponsesState((prev) => ({
        ...prev,
        status: 'loading',
        requestedModel: selectedModel,
        url: `${normalizedBase}/responses`,
      }));
      const responsesResult = await runProxyTest({
        endpoint: '/responses',
        method: 'POST',
        payload: {
          model: selectedModel,
          input: '请回复“连接成功”。',
          max_output_tokens: 32,
        },
      });

      if (!responsesResult.success) {
        const status = responsesResult.status || 0;
        const warning = status === 400 || status === 404 || status === 405;
        setResponsesState((prev) => ({
          ...prev,
          status: warning ? 'warning' : 'error',
          url: responsesResult.url || `${normalizedBase}/responses`,
          error: responsesResult.error || 'Responses 检测失败',
          details: responsesResult.details,
          requestedModel: selectedModel,
        }));
      } else {
        setResponsesState((prev) => ({
          ...prev,
          status: 'success',
          url: responsesResult.url || `${normalizedBase}/responses`,
          data: responsesResult.data,
          requestedModel: selectedModel,
        }));
      }

      window.showToast?.('OPENAI-API 测试已完成', 'success');
    } catch (error: any) {
      const message = error?.message || '测试过程中发生未知错误';
      if (currentStep === 'models') {
        setModelsState((prev) => ({ ...prev, status: 'error', error: message }));
        setChatState((prev) => ({ ...prev, status: 'warning', error: '已跳过：模型列表检测未完成。' }));
        setResponsesState((prev) => ({ ...prev, status: 'warning', error: '已跳过：模型列表检测未完成。' }));
      } else if (currentStep === 'chat') {
        setChatState((prev) => ({ ...prev, status: 'error', error: message }));
      } else {
        setResponsesState((prev) => ({ ...prev, status: 'error', error: message }));
      }
      window.showToast?.(message, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  const loadHistory = (item: HistoryItem) => {
    setUrl(item.url);
    setToken(item.token);
    resetStates();
  };

  const removeHistory = (target: HistoryItem) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item !== target);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6">
      <div className="space-y-6">
        <section className="rounded-[32px] border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 md:p-8 shadow-xl">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent-color)]/10 text-[var(--accent-color)] text-xs font-bold tracking-wider uppercase">
                  <PlugZap className="w-3.5 h-3.5" />
                  OPENAI 兼容接口诊断
                </div>
                <h2 className="mt-4 text-2xl md:text-3xl font-bold tracking-tight">快速定位 API 连通性与兼容层问题</h2>
                <p className="mt-3 text-sm md:text-base text-[var(--text-secondary)] leading-relaxed">
                  这个工具承接了 `docs/openai-api-connectivity-tester` 的核心能力：输入 API Base URL 与 Bearer Token 后，顺序检测
                  `/models`、`/chat/completions`、`/responses` 三类关键接口，并把错误细节、返回结构和本地历史集中展示。
                </p>
              </div>
              <div className="rounded-[24px] border border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                <div>当前风格适配：浮云工具箱统一卡片与配色</div>
                <div className="mt-1">核心差异处理：`responses` 改为 HTTP POST 兼容检测</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                  <Server className="w-4 h-4 text-[var(--accent-color)]" />
                  API Base URL
                </span>
                <div className="relative">
                  <input
                    type="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder={DEFAULT_URL}
                    className="w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-main)] pl-4 pr-12 py-3 outline-none focus:ring-2 focus:ring-[var(--accent-color)]/30 transition-all"
                  />
                  {url && (
                    <button
                      type="button"
                      onClick={() => setUrl('')}
                      aria-label="清空 API Base URL"
                      className="absolute inset-y-0 right-2 flex items-center px-2 text-[var(--text-secondary)] hover:text-[var(--accent-color)] transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </label>

              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                  <KeyRound className="w-4 h-4 text-[var(--accent-color)]" />
                  Bearer Token
                </span>
                <div className="relative">
                  <input
                    type="password"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder="sk-..."
                    className="w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-main)] pl-4 pr-12 py-3 outline-none focus:ring-2 focus:ring-[var(--accent-color)]/30 transition-all font-mono text-sm"
                  />
                  {token && (
                    <button
                      type="button"
                      onClick={() => setToken('')}
                      aria-label="清空 Bearer Token"
                      className="absolute inset-y-0 right-2 flex items-center px-2 text-[var(--text-secondary)] hover:text-[var(--accent-color)] transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleRunTests}
                disabled={isTesting}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[var(--accent-color)] text-white font-semibold hover:brightness-110 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-[var(--accent-color)]/20"
              >
                {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {isTesting ? '正在执行检测' : '开始完整测试'}
              </button>
              <button
                onClick={resetStates}
                disabled={isTesting}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-[var(--border-color)] hover:bg-[var(--hover-color)] transition-colors disabled:opacity-60"
              >
                <RefreshCw className="w-4 h-4" />
                清空结果
              </button>
              <p className="text-sm text-[var(--text-secondary)]">
                Token 仅用于当前测试请求；历史记录保存在浏览器本地。
              </p>
            </div>

            {url.trim() && token.trim() && (
              <div className="mt-2 space-y-3">
                <div className="rounded-2xl border border-[var(--accent-color)]/20 bg-[var(--accent-color)]/5 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent-color)]">
                      <Terminal className="w-4 h-4" />
                      PowerShell 配置命令 (Claude Code CLI)
                    </div>
                    <button
                      onClick={() => {
                        const normalized = url.trim().replace(/\/v1\/?$/, '').replace(/\/+$/, '');
                        const cmd = `& ([scriptblock]::Create((irm 'https://www.928496.xyz/s/68c6daaf'))) -BaseUrl "${normalized}" -AuthToken "${token.trim()}"`;
                        navigator.clipboard.writeText(cmd).then(() => {
                          window.showToast?.('命令已复制到剪贴板', 'success');
                        });
                      }}
                      title="复制命令"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent-color)]/10 hover:bg-[var(--accent-color)]/20 text-[var(--accent-color)] text-xs font-medium transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      复制
                    </button>
                  </div>
                  <div className="relative group">
                    <div className="text-[13px] font-mono break-all bg-[var(--bg-main)] p-3.5 rounded-xl border border-[var(--border-color)] text-[var(--text-primary)] leading-relaxed select-all">
                      & ([scriptblock]::Create((irm 'https://www.928496.xyz/s/68c6daaf'))) -BaseUrl "{url.trim().replace(/\/v1\/?$/, '').replace(/\/+$/, '')}" -AuthToken "{token.trim()}"
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--text-secondary)] opacity-70">
                    复制此命令在 PowerShell 中运行，可快速为当前本地环境配置 Claude API。
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--accent-color)]/20 bg-[var(--accent-color)]/5 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent-color)]">
                      <Terminal className="w-4 h-4" />
                      PowerShell 配置命令 (OpenAI Codex CLI)
                    </div>
                    <button
                      onClick={() => {
                        const normalized = url.trim().replace(/\/v1\/?$/, '').replace(/\/+$/, '');
                        const cmd = `& ([scriptblock]::Create((irm 'https://www.928496.xyz/s/321b2e18'))) -BaseUrl "${normalized}" -AuthToken "${token.trim()}"`;
                        navigator.clipboard.writeText(cmd).then(() => {
                          window.showToast?.('命令已复制到剪贴板', 'success');
                        });
                      }}
                      title="复制命令"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent-color)]/10 hover:bg-[var(--accent-color)]/20 text-[var(--accent-color)] text-xs font-medium transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      复制
                    </button>
                  </div>
                  <div className="relative group">
                    <div className="text-[13px] font-mono break-all bg-[var(--bg-main)] p-3.5 rounded-xl border border-[var(--border-color)] text-[var(--text-primary)] leading-relaxed select-all">
                      & ([scriptblock]::Create((irm 'https://www.928496.xyz/s/321b2e18'))) -BaseUrl "{url.trim().replace(/\/v1\/?$/, '').replace(/\/+$/, '')}" -AuthToken "{token.trim()}"
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--text-secondary)] opacity-70">
                    复制此命令在 PowerShell 中运行，可自动配置 OpenAI Codex CLI 基础地址与密钥。
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ResultPanel icon={Server} state={modelsState}>
            {modelsState.status === 'success' && (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-[var(--text-secondary)]">
                  共识别到 <span className="font-semibold text-[var(--text-primary)]">{modelsState.data?.data?.length || 0}</span> 个模型，
                  已选择 <span className="font-mono text-[var(--text-primary)]">{modelsState.requestedModel}</span> 继续后续测试。
                </p>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                  {(modelsState.data?.data || []).slice(0, 30).map((item: any) => (
                    <span
                      key={item.id}
                      className="px-2.5 py-1 rounded-full bg-[var(--bg-main)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)]"
                    >
                      {item.id}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </ResultPanel>

          <ResultPanel icon={MessageSquare} state={chatState}>
            {chatState.status === 'success' && (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-[var(--text-secondary)]">
                  请求模型：<span className="font-mono text-[var(--text-primary)]">{chatState.requestedModel}</span>
                </p>
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-main)] p-4 text-sm leading-relaxed text-[var(--text-primary)]">
                  {chatState.data?.choices?.[0]?.message?.content || '接口已返回成功，但没有提取到消息文本。'}
                </div>
              </div>
            )}
          </ResultPanel>

          <ResultPanel icon={FileJson} state={responsesState}>
            {(responsesState.status === 'success' || responsesState.status === 'warning') && (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-[var(--text-secondary)]">
                  请求模型：<span className="font-mono text-[var(--text-primary)]">{responsesState.requestedModel}</span>
                </p>
                {responsesState.status === 'success' ? (
                  <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-main)] p-4 text-sm leading-relaxed text-[var(--text-primary)]">
                    {extractTextFromResponse(responsesState.data)}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-relaxed text-[var(--text-primary)]">
                    当前端点可能不支持标准 `responses` 接口，或要求厂商自定义参数。已保留返回细节，便于你继续判断兼容策略。
                  </div>
                )}
                {responsesState.data && (
                  <details className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-main)] p-4">
                    <summary className="cursor-pointer text-sm font-medium">查看原始返回</summary>
                    <pre className="mt-3 text-xs overflow-x-auto custom-scrollbar text-[var(--text-primary)]">
                      {JSON.stringify(responsesState.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </ResultPanel>
        </div>
      </div>

      <aside className="rounded-[32px] border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 md:p-6 shadow-xl h-fit xl:sticky xl:top-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <History className="w-5 h-5 text-[var(--accent-color)]" />
              测试历史
            </h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">快速回填最近使用过的地址与 Token。</p>
          </div>
          {!historyEmpty && (
            <button
              onClick={clearHistory}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              清空
            </button>
          )}
        </div>

        <div className="mt-5 space-y-3 max-h-[560px] overflow-y-auto custom-scrollbar pr-1">
          {historyEmpty ? (
            <div className="rounded-[24px] border border-dashed border-[var(--border-color)] p-8 text-center text-[var(--text-secondary)]">
              <History className="w-8 h-8 mx-auto opacity-30" />
              <p className="mt-3 text-sm">还没有测试历史</p>
            </div>
          ) : (
            history.map((item) => (
              <button
                key={`${item.url}-${item.token}-${item.timestamp}`}
                onClick={() => loadHistory(item)}
                className="w-full text-left rounded-[24px] border border-[var(--border-color)] p-4 bg-[var(--bg-main)] hover:bg-[var(--hover-color)] transition-colors group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text-primary)] break-all">{item.url}</p>
                    <p className="mt-2 text-xs font-mono text-[var(--text-secondary)]">{maskToken(item.token)}</p>
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
                      {new Date(item.timestamp).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeHistory(item);
                    }}
                    className="p-2 rounded-full text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="mt-5 rounded-[24px] border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-[var(--text-secondary)]">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p>
              历史仅保存在当前浏览器的 `localStorage`。如果你在共享设备上使用，请在结束后主动清空。
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
