import { Cpu, History, ShieldAlert, Trash2 } from "lucide-react";
import { type HistoryItem, maskToken } from "./helpers";

interface HistorySidebarProps {
  history: HistoryItem[];
  onClearHistory: () => void;
  onLoadHistory: (item: HistoryItem) => void;
  onRemoveHistory: (item: HistoryItem) => void;
}

export default function HistorySidebar({
  history,
  onClearHistory,
  onLoadHistory,
  onRemoveHistory,
}: HistorySidebarProps) {
  const historyEmpty = history.length === 0;

  return (
    <aside className="h-full flex flex-col rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden shadow-xl">
      <div className="p-4 border-b border-[var(--border-color)]/60 bg-[var(--bg-main)]/30">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold flex items-center gap-2 tracking-tight">
            <History className="w-4 h-4 text-[var(--accent-color)]" />
            测试历史
          </h3>
          {!historyEmpty && (
            <button
              type="button"
              onClick={onClearHistory}
              title="清空所有测试历史"
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-500 transition-all active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="mt-2 flex gap-2 p-2 rounded-xl bg-amber-500/5 border border-amber-500/10">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[9px] text-[var(--text-secondary)] leading-relaxed opacity-80 font-medium">
            我们深知数据隐私的重要性，历史记录仅存储在当前浏览器的本地存储中，不会上传至任何服务器。
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
        {historyEmpty ? (
          <div className="h-40 flex flex-col items-center justify-center text-[var(--text-secondary)] opacity-20 px-10 text-center">
            <History className="w-10 h-10 mb-2" />
            <p className="text-[10px] font-medium">还没有任何历史记录</p>
          </div>
        ) : (
          <div className="px-3 space-y-1.5 pb-2">
            {history.map((item) => (
              <button
                type="button"
                key={`${item.url}-${item.token}-${item.timestamp}`}
                onClick={() => onLoadHistory(item)}
                className="w-full text-left rounded-[16px] border border-[var(--border-color)] p-3 bg-[var(--bg-main)]/40 hover:bg-[var(--hover-color)] hover:border-[var(--accent-color)]/30 transition-all group relative overflow-hidden"
              >
                <div className="relative z-10">
                  <p className="text-[11px] font-bold text-[var(--text-primary)] truncate max-w-[180px] mb-1">
                    {item.url}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-mono text-[var(--text-secondary)]">{maskToken(item.token)}</span>
                      {item.customModel && (
                        <div className="flex items-center gap-1 text-[8px] text-[var(--accent-color)] opacity-70 font-medium">
                          <Cpu className="w-2.5 h-2.5" />
                          {item.customModel}
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-[var(--text-secondary)] opacity-50">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="absolute top-1/2 -translate-y-1/2 right-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveHistory(item);
                    }}
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
  );
}
