import { Copy, Cpu, KeyRound, Play, Server, Terminal, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import HistorySidebar from "./openai-connectivity/HistorySidebar";
import {
  buildHistory,
  createIdleState,
  DEFAULT_URL,
  executeConnectivityTests,
  extractTextFromResponse,
  HISTORY_KEY,
  type HistoryItem,
  type JsonValue,
  type ModelItem,
  persistHistory,
  readHistory,
  type TestState,
} from "./openai-connectivity/helpers";
import ResultPanel from "./openai-connectivity/ResultPanel";

const copyScript = (script: string) =>
  navigator.clipboard.writeText(script).then(() => window.showToast?.("已复制", "success"));

const normalizeBaseUrl = (url: string) =>
  url
    .trim()
    .replace(/\/v1\/?$/, "")
    .replace(/\/+$/, "");

function ConnectivityConfigPanel({
  customModel,
  isTesting,
  token,
  url,
  onCustomModelChange,
  onReset,
  onRunTests,
  onTokenChange,
  onUrlChange,
}: {
  customModel: string;
  isTesting: boolean;
  token: string;
  url: string;
  onCustomModelChange: (value: string) => void;
  onReset: () => void;
  onRunTests: () => void;
  onTokenChange: (value: string) => void;
  onUrlChange: (value: string) => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 md:p-6 shadow-2xl shadow-black/5">
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-[var(--accent-color)]/5 blur-[80px] rounded-full pointer-events-none" />

      <div className="relative flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3">
          <InputField
            icon={<Server className="w-4 h-4" />}
            placeholder={DEFAULT_URL}
            type="url"
            value={url}
            onChange={onUrlChange}
          />
          <InputField
            icon={<KeyRound className="w-4 h-4" />}
            placeholder="sk-..."
            type="password"
            value={token}
            onChange={onTokenChange}
          />
          <InputField
            icon={<Cpu className="w-4 h-4" />}
            placeholder="例如：gpt-4o, claude-3-5-sonnet... (留空自动识别)"
            type="text"
            value={customModel}
            onChange={onCustomModelChange}
          />
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-[var(--border-color)]/60">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRunTests}
              disabled={isTesting}
              title={isTesting ? "正在检测..." : "开始执行检测"}
              className="relative overflow-hidden flex items-center justify-center p-2.5 rounded-xl bg-[var(--accent-color)] text-white shadow-xl shadow-[var(--accent-color)]/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTesting ? (
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Play className="w-5 h-5 fill-current" />
              )}
            </button>
            <button
              type="button"
              onClick={onReset}
              disabled={isTesting}
              title="重置所有状态"
              className="flex items-center justify-center p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-secondary)] hover:bg-red-500/5 hover:text-red-500 hover:border-red-500/30 transition-all active:scale-95 disabled:opacity-50"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-main)] border border-[var(--border-color)]">
            <div
              className={`w-2 h-2 rounded-full ${isTesting ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`}
            />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              系统准备就绪
            </span>
          </div>
        </div>

        {url.trim() && token.trim() && <QuickConfig url={url} token={token} />}
      </div>
    </section>
  );
}

function InputField({
  icon,
  onChange,
  placeholder,
  type,
  value,
}: {
  icon: ReactNode;
  onChange: (value: string) => void;
  placeholder: string;
  type: string;
  value: string;
}) {
  return (
    <div className="group relative">
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--accent-color)] opacity-60 pointer-events-none transition-transform group-focus-within:scale-110">
        {icon}
      </div>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] pl-10 pr-10 py-2.5 outline-none focus:ring-4 focus:ring-[var(--accent-color)]/10 focus:border-[var(--accent-color)] transition-all text-sm shadow-sm hover:shadow-md placeholder:text-[var(--text-secondary)]/30"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute inset-y-0 right-3 flex items-center px-1 text-[var(--text-secondary)] hover:text-red-500 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function QuickConfig({ token, url }: { token: string; url: string }) {
  const base = normalizeBaseUrl(url);
  return (
    <div className="rounded-[16px] bg-gradient-to-br from-[var(--bg-main)] to-[var(--bg-main)]/50 border border-[var(--border-color)] p-4 space-y-2 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-bold text-[var(--accent-color)] uppercase tracking-tight">
          <Terminal className="w-3.5 h-3.5" />
          CLI 快速配置 (PowerShell)
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <QuickConfigCard
          label="Claude Code"
          onCopy={() =>
            copyScript(
              `& ([scriptblock]::Create((irm 'https://www.928496.xyz/s/68c6daaf'))) -BaseUrl "${base}" -AuthToken "${token.trim()}"`,
            )
          }
        />
        <QuickConfigCard
          label="OpenAI Codex"
          onCopy={() =>
            copyScript(
              `& ([scriptblock]::Create((irm 'https://www.928496.xyz/s/321b2e18'))) -BaseUrl "${base}/v1" -AuthToken "${token.trim()}"`,
            )
          }
        />
      </div>
    </div>
  );
}

function QuickConfigCard({ label, onCopy }: { label: string; onCopy: () => void }) {
  return (
    <div className="group relative bg-[var(--bg-surface)] p-2.5 rounded-lg border border-[var(--border-color)] hover:border-[var(--accent-color)]/40 transition-all">
      <div className="text-[9px] font-bold text-[var(--text-secondary)] mb-1 uppercase opacity-60">
        {label}
      </div>
      <div className="text-[10px] font-mono truncate opacity-80 pr-8">
        &amp; ([scriptblock]::Create((irm '...'))) -BaseUrl "..." ...
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="absolute right-2 bottom-2 p-1.5 rounded bg-[var(--accent-color)] text-white opacity-0 group-hover:opacity-100 transition-all"
      >
        <Copy className="w-3 h-3" />
      </button>
    </div>
  );
}

const getModelsFromState = (data: JsonValue | undefined): ModelItem[] => {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const models = data.data;
  if (!Array.isArray(models)) return [];
  return models.filter(
    (item): item is ModelItem =>
      !!item && typeof item === "object" && !Array.isArray(item) && typeof item.id === "string",
  );
};

function ModelsPanel({
  allModels,
  modelsState,
  onToggleShowAll,
  showAllModels,
}: {
  allModels: ModelItem[];
  modelsState: TestState;
  onToggleShowAll: () => void;
  showAllModels: boolean;
}) {
  const displayedModels = showAllModels ? allModels : allModels.slice(0, 10);
  return (
    <ResultPanel state={modelsState}>
      {modelsState.status === "success" && (
        <div className="mt-2 pt-2 border-t border-[var(--border-color)]/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-[var(--text-secondary)]">
              识别到 {allModels.length || 0} 个模型
            </span>
            <div className="flex items-center gap-1.5">
              {allModels.length > 10 && (
                <button
                  type="button"
                  onClick={onToggleShowAll}
                  className="px-2 py-0.5 rounded-md bg-[var(--accent-color)]/5 text-[var(--accent-color)] text-[9px] font-bold hover:bg-[var(--accent-color)]/10 transition-all uppercase tracking-tighter"
                >
                  {showAllModels ? "收起" : "详细"}
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard
                    .writeText(allModels.map((item) => item.id).join("\n"))
                    .then(() => window.showToast?.("已全部复制", "success"))
                }
                title="复制全部模型 ID"
                className="p-1 rounded bg-[var(--accent-color)]/10 text-[var(--accent-color)] hover:bg-[var(--accent-color)]/20 transition-all active:scale-90"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div
            className={`flex flex-wrap gap-1.5 transition-all duration-300 ${showAllModels ? "max-h-[300px]" : "max-h-24"} overflow-y-auto custom-scrollbar p-0.5`}
          >
            {displayedModels.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() =>
                  navigator.clipboard.writeText(item.id).then(() => {
                    window.showToast?.(`模型 ID [${item.id}] 已复制`, "success");
                  })
                }
                title="点击复制模型 ID"
                className="px-1.5 py-0.5 rounded bg-[var(--bg-main)] border border-[var(--border-color)] text-[9px] font-mono hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-all active:scale-95 cursor-pointer"
              >
                {item.id}
              </button>
            ))}
            {!showAllModels && allModels.length > 10 && (
              <button
                type="button"
                onClick={onToggleShowAll}
                className="px-1.5 py-0.5 rounded bg-[var(--accent-color)]/5 border border-dashed border-[var(--accent-color)]/30 text-[9px] text-[var(--accent-color)] opacity-60 italic hover:opacity-100 transition-all"
              >
                +{allModels.length - 10} more
              </button>
            )}
          </div>
        </div>
      )}
    </ResultPanel>
  );
}

function ResponsePreview({
  state,
  title,
  visible,
}: {
  state: TestState;
  title?: string;
  visible: boolean;
}) {
  return (
    <ResultPanel title={title} state={state}>
      {visible && (
        <div className="mt-2 pt-2 border-t border-[var(--border-color)]/40 group relative text-left">
          <div className="text-[10px] text-[var(--text-secondary)] mb-1 uppercase tracking-tighter opacity-60">
            采样响应内容
          </div>
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)]/50 p-2 text-[11px] leading-relaxed line-clamp-4 hover:line-clamp-none transition-all">
            {extractTextFromResponse(state.data || state.details)}
          </div>
        </div>
      )}
    </ResultPanel>
  );
}

function ResultsGrid({
  chatState,
  modelsState,
  responsesState,
  showAllModels,
  toggleShowAllModels,
}: {
  chatState: TestState;
  modelsState: TestState;
  responsesState: TestState;
  showAllModels: boolean;
  toggleShowAllModels: () => void;
}) {
  const allModels = getModelsFromState(modelsState.data);
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <ModelsPanel
        allModels={allModels}
        modelsState={modelsState}
        onToggleShowAll={toggleShowAllModels}
        showAllModels={showAllModels}
      />
      <ResponsePreview state={chatState} visible={chatState.status === "success"} />
      <ResponsePreview
        title="CLAUDE CODE / RESPONSES"
        state={responsesState}
        visible={responsesState.status === "success" || responsesState.status === "warning"}
      />
    </div>
  );
}

export default function OpenAIConnectivityTool() {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showAllModels, setShowAllModels] = useState(false);
  const [modelsState, setModelsState] = useState<TestState>(createIdleState("模型列表检测"));
  const [chatState, setChatState] = useState<TestState>(createIdleState("Chat Completions 检测"));
  const [responsesState, setResponsesState] = useState<TestState>(
    createIdleState("Responses 检测"),
  );

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  const resetStates = () => {
    setModelsState(createIdleState("模型列表检测"));
    setChatState(createIdleState("Chat Completions 检测"));
    setResponsesState(createIdleState("Responses 检测"));
  };

  const handleRunTests = async () => {
    if (!url.trim() || !token.trim()) {
      window.showToast?.("请先填写 API 地址和 Token", "error");
      setModelsState({
        ...createIdleState("模型列表检测"),
        status: "error",
        error: "请先填写 API Base URL 和 Bearer Token。",
      });
      return;
    }

    setIsTesting(true);
    resetStates();

    try {
      const result = await executeConnectivityTests({ customModel, token, url });
      setModelsState(result.modelsState);
      setChatState(result.chatState);
      setResponsesState(result.responsesState);

      if (result.selectedModel) {
        const nextHistory = buildHistory(history, url.trim(), token.trim(), customModel.trim());
        setHistory(nextHistory);
        persistHistory(nextHistory);
      }
      window.showToast?.("OPENAI-API 测试已完成", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "测试过程中发生未知错误";
      window.showToast?.(message, "error");
      setModelsState((prev) => ({ ...prev, status: "error", error: message }));
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto w-full p-2 lg:p-2">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 flex flex-col gap-3">
          <ConnectivityConfigPanel
            customModel={customModel}
            isTesting={isTesting}
            token={token}
            url={url}
            onCustomModelChange={setCustomModel}
            onReset={resetStates}
            onRunTests={handleRunTests}
            onTokenChange={setToken}
            onUrlChange={setUrl}
          />
          <ResultsGrid
            chatState={chatState}
            modelsState={modelsState}
            responsesState={responsesState}
            showAllModels={showAllModels}
            toggleShowAllModels={() => setShowAllModels((prev) => !prev)}
          />
        </div>

        <div className="lg:col-span-4 flex flex-col gap-4">
          <HistorySidebar
            history={history}
            onClearHistory={() => {
              setHistory([]);
              localStorage.removeItem(HISTORY_KEY);
            }}
            onLoadHistory={(item) => {
              setUrl(item.url);
              setToken(item.token);
              setCustomModel(item.customModel || "");
              resetStates();
            }}
            onRemoveHistory={(target) => {
              const updated = history.filter((item) => item !== target);
              setHistory(updated);
              persistHistory(updated);
            }}
          />
        </div>
      </div>
    </div>
  );
}
