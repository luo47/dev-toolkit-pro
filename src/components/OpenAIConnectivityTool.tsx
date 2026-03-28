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
  requestBody?: any;
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
  if (!data) return '未返回空响应';
  
  let target = data;
  
  // 0. 如果 data 是字符串且看起来像 JSON，尝试解析它（处理双重转义的情况）
  if (typeof data === 'string' && (data.trim().startsWith('{') || data.trim().startsWith('['))) {
    try {
      target = JSON.parse(data);
    } catch {
      // 解析失败则维持原样
    }
  }

  // 1. 标准 OpenAI Chat 格式
  const chatContent = target?.choices?.[0]?.message?.content;
  if (typeof chatContent === 'string' && chatContent.trim()) return chatContent;
  
  // 2. 某些代理或模型的 output_text 格式
  if (typeof target.output_text === 'string' && target.output_text.trim()) return target.output_text;
  
  // 3. 数组形式的 output 格式
  if (Array.isArray(target.output)) {
    const chunks = target.output
      .flatMap((item: any) => item?.content || [])
      .map((item: any) => (typeof item === 'string' ? item : item?.text || item?.content || ''))
      .filter(Boolean);
    if (chunks.length > 0) return chunks.join('\n');
  }

  // 4. 其它常见的 text/content 字段
  if (typeof target.text === 'string' && target.text.trim()) return target.text;
  if (typeof target.content === 'string' && target.content.trim()) return target.content;

  // 5. 特殊保底：如果还是字符串，尝试用正则抓取内容（应对极其混乱的报文）
  if (typeof data === 'string') {
    const match = data.match(/"content"\s*:\s*"([^"]+)"/);
    if (match && match[1]) return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }

  return typeof data === 'string' ? data : '接口可用，但无法解析出文本内容（请检查原始报文）';
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
  return null;
}

function ResultPanel({
  state,
  children,
}: {
  state: TestState;
  children?: ReactNode;
}) {
  const toneClass = {
    idle: 'bg-[var(--bg-surface)] border-[var(--border-color)] opacity-60 grayscale hover:grayscale-0 hover:opacity-100',
    loading: 'bg-[var(--accent-color)]/5 border-[var(--accent-color)]/30 ring-4 ring-[var(--accent-color)]/5',
    success: 'bg-emerald-500/5 border-emerald-500/30 shadow-lg shadow-emerald-500/5',
    error: 'bg-red-500/5 border-red-500/30 shadow-lg shadow-red-500/5',
    warning: 'bg-amber-500/5 border-amber-500/30 shadow-lg shadow-amber-500/5',
  }[state.status];

  return (
    <section className={`rounded-[24px] border p-5 transition-all duration-500 ${toneClass}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 overflow-hidden">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-[var(--text-primary)] truncate text-xs tracking-tight uppercase opacity-90">
              {state.title}
            </h3>
            {state.description && (
              <p className="text-[10px] text-[var(--text-secondary)] mt-1 truncate opacity-70">
                {state.description}
              </p>
            )}
          </div>
          <div className="shrink-0 scale-90">
            <StatusIcon status={state.status} />
          </div>
        </div>
        {state.url && (
          <p className="mt-2 text-[10px] font-mono break-all text-[var(--text-secondary)] opacity-40 leading-tight">
            {state.url}
          </p>
        )}
        {state.error && (
          <div className="mt-3 rounded-xl border border-red-500/10 bg-red-500/5 p-3">
            <p className="text-[11px] font-medium text-red-500">{state.error}</p>
          </div>
        )}
        {(state.requestBody || state.data) && (
          <div className="mt-4 pt-3 border-t border-[var(--border-color)]/30">
            <details className="group">
              <summary className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest cursor-pointer hover:text-[var(--accent-color)] transition-colors list-none">
                <FileJson className="w-3 h-3 transition-transform group-open:rotate-90" />
                查看原始报文
              </summary>
              <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-300">
                {state.requestBody && (
                  <div className="space-y-1.5">
                    <div className="text-[9px] font-bold text-[var(--accent-color)] flex items-center gap-1 uppercase opacity-60">
                      <Terminal className="w-2.5 h-2.5" />
                      Request Body
                    </div>
                    <pre className="p-2.5 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] text-[9px] font-mono overflow-x-auto custom-scrollbar text-[var(--text-primary)]/80 leading-tight">
                      {JSON.stringify(state.requestBody, null, 2)}
                    </pre>
                  </div>
                )}
                {state.data && (
                  <div className="space-y-1.5">
                    <div className="text-[9px] font-bold text-emerald-500 flex items-center gap-1 uppercase opacity-60">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      Response Body
                    </div>
                    <pre className="p-2.5 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] text-[9px] font-mono overflow-x-auto custom-scrollbar text-[var(--text-primary)]/80 leading-tight">
                      {JSON.stringify(state.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

export default function OpenAIConnectivityTool() {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [modelsState, setModelsState] = useState<TestState>({
    status: 'idle',
    title: '模型列表检测',
    description: '',
  });
  const [chatState, setChatState] = useState<TestState>({
    status: 'idle',
    title: 'Chat Completions 检测',
    description: '',
  });
  const [responsesState, setResponsesState] = useState<TestState>({
    status: 'idle',
    title: 'Responses 检测',
    description: '',
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

      const chatPayload = {
        model: selectedModel,
        messages: [{ role: 'user', content: '你好' }],
        max_tokens: 32,
      };
      setChatState((prev) => ({
        ...prev,
        status: 'loading',
        requestedModel: selectedModel,
        requestBody: chatPayload,
        url: `${normalizedBase}/chat/completions`,
      }));
      const chatResult = await runProxyTest({
        endpoint: '/chat/completions',
        method: 'POST',
        payload: chatPayload,
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

      const responsesPayload = {
        model: selectedModel,
        input: '请回复“连接成功”。',
        max_output_tokens: 32,
      };
      setResponsesState((prev) => ({
        ...prev,
        status: 'loading',
        requestedModel: selectedModel,
        requestBody: responsesPayload,
        url: `${normalizedBase}/responses`,
      }));
      const responsesResult = await runProxyTest({
        endpoint: '/responses',
        method: 'POST',
        payload: responsesPayload,
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
    <div className="max-w-[1400px] mx-auto w-full p-2 lg:p-4">
      {/* 顶部布局网格 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 左侧主要配置区 */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <section className="relative overflow-hidden rounded-[32px] border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 md:p-10 shadow-2xl shadow-black/5">
            {/* 背景装饰渐变 */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-[var(--accent-color)]/5 blur-[80px] rounded-full pointer-events-none" />
            
            <div className="relative flex flex-col gap-8">
              {/* 输入区域 */}
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-70">
                    <Server className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                    API Base URL
                  </label>
                  <div className="group relative">
                    <input
                      type="url"
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                      placeholder={DEFAULT_URL}
                      className="w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-main)] px-5 py-4 outline-none focus:ring-4 focus:ring-[var(--accent-color)]/10 focus:border-[var(--accent-color)] transition-all text-sm font-medium shadow-sm hover:shadow-md"
                    />
                    {url && (
                      <button
                        type="button"
                        onClick={() => setUrl('')}
                        className="absolute inset-y-0 right-3 flex items-center px-2 text-[var(--text-secondary)] hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-70">
                    <KeyRound className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                    Bearer Token
                  </label>
                  <div className="group relative">
                    <input
                      type="password"
                      value={token}
                      onChange={(event) => setToken(event.target.value)}
                      placeholder="sk-..."
                      className="w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-main)] px-5 py-4 outline-none focus:ring-4 focus:ring-[var(--accent-color)]/10 focus:border-[var(--accent-color)] transition-all text-sm font-mono shadow-sm hover:shadow-md"
                    />
                    {token && (
                      <button
                        type="button"
                        onClick={() => setToken('')}
                        className="absolute inset-y-0 right-3 flex items-center px-2 text-[var(--text-secondary)] hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)]/60">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRunTests}
                    disabled={isTesting}
                    title={isTesting ? '正在检测...' : '开始执行检测'}
                    className={`relative overflow-hidden flex items-center justify-center p-4 rounded-2xl bg-[var(--accent-color)] text-white shadow-xl shadow-[var(--accent-color)]/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isTesting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6 fill-current" />}
                  </button>
                  <button
                    onClick={resetStates}
                    disabled={isTesting}
                    title="清置所有状态"
                    className="flex items-center justify-center p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-secondary)] hover:bg-red-500/5 hover:text-red-500 hover:border-red-500/30 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Trash2 className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-main)] border border-[var(--border-color)]">
                  <div className={`w-2 h-2 rounded-full ${isTesting ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">系统准备就绪</span>
                </div>
              </div>

              {/* CLI 配置快照 - 仅在有配置时显示 */}
              {url.trim() && token.trim() && (
                <div className="rounded-[24px] bg-gradient-to-br from-[var(--bg-main)] to-[var(--bg-main)]/50 border border-[var(--border-color)] p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-[var(--accent-color)] uppercase tracking-tight">
                      <Terminal className="w-3.5 h-3.5" />
                      CLI 快速配置 (PowerShell)
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="group relative bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--border-color)] hover:border-[var(--accent-color)]/40 transition-all">
                      <div className="text-[9px] font-bold text-[var(--text-secondary)] mb-1.5 uppercase opacity-60">Claude Code</div>
                      <div className="text-[10px] font-mono truncate opacity-80 pr-8">
                        & ([scriptblock]::Create((irm '...'))) -BaseUrl "{url}" ...
                      </div>
                      <button 
                        onClick={() => {
                          const base = url.trim().replace(/\/+$/, '');
                          const normalized = base.endsWith('/v1') ? base : `${base}/v1`;
                          const cmd = `& ([scriptblock]::Create((irm 'https://www.928496.xyz/s/68c6daaf'))) -BaseUrl "${normalized}" -AuthToken "${token.trim()}"`;
                          navigator.clipboard.writeText(cmd).then(() => window.showToast?.('已复制', 'success'));
                        }}
                        className="absolute right-2 bottom-2 p-1.5 rounded-lg bg-[var(--accent-color)] text-white opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="group relative bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--border-color)] hover:border-[var(--accent-color)]/40 transition-all">
                      <div className="text-[9px] font-bold text-[var(--text-secondary)] mb-1.5 uppercase opacity-60">OpenAI Codex</div>
                      <div className="text-[10px] font-mono truncate opacity-80 pr-8">
                        & ([scriptblock]::Create((irm '...'))) -BaseUrl "{url}" ...
                      </div>
                      <button 
                         onClick={() => {
                          const base = url.trim().replace(/\/v1\/?$/, '').replace(/\/+$/, '');
                          const normalized = `${base}/v1`;
                          const cmd = `& ([scriptblock]::Create((irm 'https://www.928496.xyz/s/321b2e18'))) -BaseUrl "${normalized}" -AuthToken "${token.trim()}"`;
                          navigator.clipboard.writeText(cmd).then(() => window.showToast?.('已复制', 'success'));
                        }}
                        className="absolute right-2 bottom-2 p-1.5 rounded-lg bg-[var(--accent-color)] text-white opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 三列检测结果 - 始终显示但会有状态变化 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ResultPanel state={modelsState}>
              {modelsState.status === 'success' && (
                <div className="mt-4 pt-4 border-t border-[var(--border-color)]/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-[var(--text-secondary)]">识别到 {modelsState.data?.data?.length || 0} 个模型</span>
                    <button
                      onClick={() => {
                        const ids = (modelsState.data?.data || []).map((m: any) => m.id).join('\n');
                        navigator.clipboard.writeText(ids).then(() => window.showToast?.('已全部复制', 'success'));
                      }}
                      title="复制全部模型 ID"
                      className="p-1.5 rounded bg-[var(--accent-color)]/10 text-[var(--accent-color)] hover:bg-[var(--accent-color)]/20 transition-all active:scale-90"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                    {(modelsState.data?.data || []).slice(0, 10).map((item: any) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          navigator.clipboard.writeText(item.id).then(() => {
                            window.showToast?.(`模型 ID [${item.id}] 已复制`, 'success');
                          });
                        }}
                        title="点击复制模型 ID"
                        className="px-1.5 py-0.5 rounded-md bg-[var(--bg-main)] border border-[var(--border-color)] text-[9px] font-mono hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-all active:scale-95 cursor-pointer"
                      >
                        {item.id}
                      </button>
                    ))}
                    {(modelsState.data?.data || []).length > 10 && <span className="text-[9px] opacity-40 italic py-0.5">+{(modelsState.data?.data || []).length - 10} more</span>}
                  </div>
                </div>
              )}
            </ResultPanel>

            <ResultPanel state={chatState}>
              {chatState.status === 'success' && (
                <div className="mt-4 pt-4 border-t border-[var(--border-color)]/40 group relative">
                  <div className="text-[10px] text-[var(--text-secondary)] mb-2 uppercase tracking-tighter opacity-60">采样响应内容</div>
                  <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)]/50 p-3 text-[11px] leading-relaxed line-clamp-4 hover:line-clamp-none transition-all">
                    {extractTextFromResponse(chatState.data)}
                  </div>
                </div>
              )}
            </ResultPanel>

            <ResultPanel state={responsesState}>
              {(responsesState.status === 'success' || responsesState.status === 'warning') && (
                <div className="mt-4 pt-4 border-t border-[var(--border-color)]/40">
                   <div className="text-[10px] text-[var(--text-secondary)] mb-2 uppercase tracking-tighter opacity-60">端点可用性</div>
                   <div className={`rounded-xl border ${responsesState.status === 'success' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'} p-3 text-[10px] leading-relaxed`}>
                     {responsesState.status === 'success' ? '标准 Responses 端点响应正常' : '端点返回异常，建议确认兼容模式'}
                   </div>
                </div>
              )}
            </ResultPanel>
          </div>
        </div>

        {/* 右侧边栏：历史记录与辅助功能 */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <aside className="h-full flex flex-col rounded-[32px] border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden shadow-xl">
            <div className="p-6 border-b border-[var(--border-color)]/60 bg-[var(--bg-main)]/30">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold flex items-center gap-2 tracking-tight">
                  <History className="w-4 h-4 text-[var(--accent-color)]" />
                  测试历史
                </h3>
                {!historyEmpty && (
                  <button
                    onClick={clearHistory}
                    className="text-[10px] font-bold text-[var(--text-secondary)] hover:text-red-500 transition-colors uppercase tracking-widest"
                  >
                    清空历史
                  </button>
                )}
              </div>
              <div className="mt-4 flex gap-3 p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[9px] text-[var(--text-secondary)] leading-relaxed opacity-80 font-medium">
                  我们深知数据隐私的重要性，历史记录仅存储在当前浏览器的本地存储中，不会上传至任何服务器。
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
              {historyEmpty ? (
                <div className="h-40 flex flex-col items-center justify-center text-[var(--text-secondary)] opacity-20 px-10 text-center">
                  <History className="w-10 h-10 mb-2" />
                  <p className="text-[10px] font-medium">还没有任何历史记录</p>
                </div>
              ) : (
                <div className="px-3 space-y-2">
                  {history.map((item) => (
                    <button
                      key={`${item.url}-${item.token}-${item.timestamp}`}
                      onClick={() => loadHistory(item)}
                      className="w-full text-left rounded-[20px] border border-[var(--border-color)] p-4 bg-[var(--bg-main)]/40 hover:bg-[var(--hover-color)] hover:border-[var(--accent-color)]/30 transition-all group relative overflow-hidden"
                    >
                      <div className="relative z-10">
                        <p className="text-[11px] font-bold text-[var(--text-primary)] truncate max-w-[180px] mb-1">{item.url}</p>
                        <div className="flex items-center justify-between">
                           <span className="text-[9px] font-mono text-[var(--text-secondary)]">{maskToken(item.token)}</span>
                           <span className="text-[9px] text-[var(--text-secondary)] opacity-50">{new Date(item.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="absolute top-1/2 -translate-y-1/2 right-3 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                           onClick={(e) => { e.stopPropagation(); removeHistory(item); }}
                           className="p-1.5 rounded-lg bg-red-500 text-white shadow-lg shadow-red-500/20"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>


          </aside>
        </div>
      </div>
    </div>
  );
}
