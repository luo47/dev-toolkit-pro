import { ArrowRight, Plus, Save, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "../store";
import "../types";
import ChainLibrary from "./ChainProcessor/ChainLibrary";
import {
  DEFAULT_PROXY_LINK_STEPS,
  DEFAULT_PROXY_STEPS,
  DEFAULT_SMB_STEPS,
  type SavedChain,
  STEP_CONFIG,
  type Step,
  type StepType,
} from "./ChainProcessor/ChainTypes";
import IOSection from "./ChainProcessor/IOSection";
import StepItem from "./ChainProcessor/StepItem";
import { processChainSteps } from "./ChainProcessor/stepExecution";

const normalizeProcessError = (error: unknown) => {
  if (!error || typeof error !== "object" || !("message" in error)) {
    return { stepId: "global", message: "处理失败" };
  }

  return {
    stepId: "stepId" in error && typeof error.stepId === "string" ? error.stepId : "global",
    message: typeof error.message === "string" ? error.message : "处理失败",
  };
};

export default function ChainProcessor() {
  const { isDarkMode } = useAppStore();
  const [input, setInput] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<{ stepId: string; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedChains, setSavedChains] = useState<SavedChain[]>([]);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newChainName, setNewChainName] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setInput(content);
    };
    reader.readAsText(file);
  };

  const processChain = useCallback(() => {
    setError(null);
    if (!input.trim()) {
      setOutput("");
      return;
    }
    try {
      setOutput(processChainSteps(input, steps));
    } catch (e) {
      setError(normalizeProcessError(e));
      setOutput("");
    }
  }, [input, steps]);

  useEffect(() => {
    processChain();
  }, [processChain]);

  useEffect(() => {
    const fetchChains = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_URL || "";
        const res = await fetch(`${baseUrl}/api/chains`, { credentials: "include" });
        if (res.ok) {
          const data = (await res.json()) as { success: boolean; data: SavedChain[] };
          if (data.success && data.data && data.data.length > 0) {
            setSavedChains(data.data);
            return;
          }
        }
      } catch (e) {
        console.error("Failed to load chains:", e);
      }
      setSavedChains([
        {
          id: "def-proxy",
          name: "代理列表转换",
          isFavorite: true,
          createdAt: Date.now(),
          steps: DEFAULT_PROXY_STEPS,
        },
        {
          id: "def-smb",
          name: "SMB 路径互转",
          isFavorite: true,
          createdAt: Date.now() + 1,
          steps: DEFAULT_SMB_STEPS,
        },
        {
          id: "def-link",
          name: "代理链接转换",
          isFavorite: true,
          createdAt: Date.now() + 2,
          steps: DEFAULT_PROXY_LINK_STEPS,
        },
      ]);
    };
    fetchChains();
  }, []);

  const addStep = (type: StepType) =>
    setSteps([
      ...steps,
      { id: Math.random().toString(36).substr(2, 9), type, value: "", active: true },
    ]);
  const removeStep = (id: string) => setSteps(steps.filter((s) => s.id !== id));
  const updateStep = (id: string, updates: Partial<Step>) =>
    setSteps(steps.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  const moveStep = (index: number, direction: "up" | "down") => {
    const newSteps = [...steps];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= steps.length) return;
    [newSteps[index], newSteps[target]] = [newSteps[target], newSteps[index]];
    setSteps(newSteps);
  };

  const handleSaveChain = async () => {
    if (!newChainName.trim() || steps.length === 0) return;
    try {
      const baseUrl = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${baseUrl}/api/chains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newChainName.trim(), steps }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) {
        window.showToast?.("处理链已保存", "success");
        const fetchRes = await fetch(`${baseUrl}/api/chains`, { credentials: "include" });
        const fetchData = (await fetchRes.json()) as { success: boolean; data: SavedChain[] };
        if (fetchData.success) setSavedChains(fetchData.data);
      } else throw new Error(data.error);
    } catch (e) {
      const message = e instanceof Error ? e.message : "保存失败";
      window.showToast?.(`保存失败: ${message}`, "error");
    }
    setNewChainName("");
    setIsSaveModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <IOSection
        input={input}
        output={output}
        error={error}
        isDragging={isDragging}
        copied={copied}
        onInputChange={setInput}
        onClearInput={() => setInput("")}
        onFileUpload={handleFileUpload}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFileUpload(f);
        }}
        onPaste={(e) => {
          const items = e.clipboardData.items;
          for (let i = 0; i < items.length; i++) {
            if (items[i].kind === "file") {
              const f = items[i].getAsFile();
              if (f) handleFileUpload(f);
              break;
            }
          }
        }}
        onExportOutput={() => {
          const blob = new Blob([output], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `result-${Date.now()}.txt`;
          a.click();
          URL.revokeObjectURL(url);
        }}
        onCopyOutput={() => {
          navigator.clipboard.writeText(output);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        <div className="flex items-center justify-between shrink-0">
          <label className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
            <ArrowRight className="w-4 h-4" /> 处理链
          </label>
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-color)] text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all">
              <Plus className="w-3.5 h-3.5" /> 添加步骤
            </button>
            <div className="absolute right-0 top-full pt-2 z-50 hidden group-hover:block">
              <div className="w-48 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1 max-h-80 overflow-y-auto custom-scrollbar">
                {(Object.keys(STEP_CONFIG) as StepType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => addStep(type)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--hover-color)] rounded-lg text-left"
                  >
                    <span className="w-8 h-8 flex items-center justify-center bg-[var(--bg-main)] rounded text-[10px] font-bold text-[var(--accent-color)]">
                      {STEP_CONFIG[type].icon}
                    </span>
                    <span className="text-xs text-[var(--text-primary)]">
                      {STEP_CONFIG[type].label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsSaveModalOpen(true)}
            disabled={steps.length === 0}
            className="p-1.5 hover:bg-[var(--hover-color)] rounded-lg text-[var(--text-secondary)] disabled:opacity-30"
          >
            <Save className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
          {steps.length === 0 ? (
            <div className="h-full border-2 border-dashed border-[var(--border-color)] rounded-2xl flex flex-col items-center justify-center text-[var(--text-secondary)]">
              <Plus className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm">尚未添加处理步骤</p>
            </div>
          ) : (
            steps.map((step, i) => (
              <StepItem
                key={step.id}
                step={step}
                index={i}
                totalSteps={steps.length}
                error={error}
                onUpdate={updateStep}
                onRemove={removeStep}
                onMove={moveStep}
              />
            ))
          )}
        </div>
      </IOSection>

      <ChainLibrary
        savedChains={savedChains}
        onLoadChain={(c) => setSteps(JSON.parse(JSON.stringify(c.steps)))}
        onDeleteChain={async (id) => {
          const baseUrl = import.meta.env.VITE_API_URL || "";
          await fetch(`${baseUrl}/api/chains/${id}`, { method: "DELETE", credentials: "include" });
          setSavedChains(savedChains.filter((c) => c.id !== id));
        }}
        onToggleFavorite={async (id) => {
          const chain = savedChains.find((c) => c.id === id);
          if (!chain) return;
          const newFav = !chain.isFavorite;
          setSavedChains(savedChains.map((c) => (c.id === id ? { ...c, isFavorite: newFav } : c)));
          const baseUrl = import.meta.env.VITE_API_URL || "";
          await fetch(`${baseUrl}/api/chains/${id}/favorite`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ isFavorite: newFav }),
          });
        }}
        onExport={() => {
          const blob = new Blob([JSON.stringify(savedChains, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `chains-${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }}
        onImport={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const r = new FileReader();
          r.onload = (ev) => {
            try {
              const imp = JSON.parse(ev.target?.result as string);
              if (Array.isArray(imp)) setSavedChains((p) => [...imp, ...p]);
            } catch (_err) {
              window.showToast?.("导入失败", "error");
            }
          };
          r.readAsText(f);
          e.target.value = "";
        }}
      />

      {isSaveModalOpen && (
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm ${isDarkMode ? "bg-black/80" : "bg-black/20"}`}
        >
          <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">保存处理链</h3>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="p-2 hover:bg-[var(--hover-color)] rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--text-secondary)]">名称</label>
              <input
                value={newChainName}
                onChange={(e) => setNewChainName(e.target.value)}
                placeholder="例如：提取代理列表..."
                className="w-full px-4 py-3 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all text-[var(--text-primary)]"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="flex-1 py-3 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl font-bold text-[var(--text-secondary)] hover:bg-[var(--hover-color)] transition-all"
              >
                取消
              </button>
              <button
                onClick={handleSaveChain}
                className="flex-1 py-3 bg-[var(--accent-color)] text-white rounded-2xl font-bold shadow-lg shadow-[var(--accent-color)]/20 hover:opacity-90 transition-all"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
