import { BookmarkPlus, Cpu, History, Search, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { dedupeHistoryByDomain, getHistoryDomain, type HistoryItem, maskToken } from "./helpers";

interface HistorySidebarProps {
  history: HistoryItem[];
  onClearHistory: () => void;
  onLoadHistory: (item: HistoryItem) => void;
  onRemoveHistory: (item: HistoryItem) => void;
  onSaveHistory: (item: HistoryItem) => void;
  savingHistoryKey?: string | null;
}

function OverflowTooltipText({ text }: { text: string }) {
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return;

    const updateOverflowState = () => {
      setIsOverflowing(element.scrollWidth > element.clientWidth);
    };

    updateOverflowState();

    const resizeObserver = new ResizeObserver(updateOverflowState);
    resizeObserver.observe(element);
    window.addEventListener("resize", updateOverflowState);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateOverflowState);
    };
  }, []);

  return (
    <p
      ref={textRef}
      title={isOverflowing ? text : undefined}
      className="min-w-0 flex-1 truncate text-[9px] text-[var(--text-secondary)] opacity-80 font-medium"
    >
      {text}
    </p>
  );
}

export default function HistorySidebar({
  history,
  onClearHistory,
  onLoadHistory,
  onRemoveHistory,
  onSaveHistory,
  savingHistoryKey,
}: HistorySidebarProps) {
  const [keyword, setKeyword] = useState("");
  const historyEmpty = history.length === 0;
  const trimmedKeyword = keyword.trim().toLowerCase();
  const uniqueHistory = dedupeHistoryByDomain(history);
  const filteredHistory = uniqueHistory.filter((item) => {
    if (!trimmedKeyword) return true;
    const domain = getHistoryDomain(item.url);
    return domain.includes(trimmedKeyword);
  });
  const filteredEmpty = filteredHistory.length === 0;

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
          <OverflowTooltipText text="历史记录仅保存在当前浏览器本地，不会上传到服务器。" />
        </div>
        {!historyEmpty && (
          <div className="mt-3 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--text-secondary)]/70 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="按域名筛选"
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] px-9 py-2 text-[10px] text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-secondary)]/40 focus:border-[var(--accent-color)]/30 focus:ring-4 focus:ring-[var(--accent-color)]/10"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
        {historyEmpty ? (
          <div className="h-40 flex flex-col items-center justify-center text-[var(--text-secondary)] opacity-20 px-10 text-center">
            <History className="w-10 h-10 mb-2" />
            <p className="text-[10px] font-medium">还没有任何历史记录</p>
          </div>
        ) : filteredEmpty ? (
          <div className="h-40 flex flex-col items-center justify-center text-[var(--text-secondary)] opacity-40 px-8 text-center">
            <Search className="w-8 h-8 mb-2" />
            <p className="text-[10px] font-medium">没有匹配的域名</p>
          </div>
        ) : (
          <div className="px-3 space-y-1.5 pb-2">
            {filteredHistory.map((item) => (
              <div
                key={`${item.url}-${item.token}-${item.timestamp}`}
                className="w-full rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-main)]/40 hover:bg-[var(--hover-color)] hover:border-[var(--accent-color)]/30 transition-all relative overflow-hidden"
              >
                <div className="relative z-10 flex items-start gap-2 p-3">
                  <button type="button" onClick={() => onLoadHistory(item)} className="min-w-0 flex-1 text-left">
                    <p className="text-[9px] uppercase tracking-wide text-[var(--accent-color)]/80 mb-1">
                      {getHistoryDomain(item.url)}
                    </p>
                    <p className="text-[11px] font-bold text-[var(--text-primary)] truncate max-w-[180px] mb-1">
                      {item.url}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[9px] font-mono text-[var(--text-secondary)]">
                          {maskToken(item.token)}
                        </span>
                        {item.models && item.models.length > 0 && (
                          <span
                            title={item.models.join(", ")}
                            className="max-w-[210px] truncate text-[9px] font-mono text-[var(--text-secondary)]/80"
                          >
                            {item.models.join(", ")}
                          </span>
                        )}
                        {item.customModel && (
                          <div className="flex items-center gap-1 text-[8px] text-[var(--accent-color)] opacity-70 font-medium">
                            <Cpu className="w-2.5 h-2.5" />
                            {item.customModel}
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] text-[var(--text-secondary)] opacity-50 shrink-0 ml-3">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                  <div className="shrink-0 flex items-center gap-1 pt-0.5">
                    <button
                      type="button"
                      title="保存到代码片段"
                      onClick={() => onSaveHistory(item)}
                      className="p-1.5 rounded-lg bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20 hover:bg-[var(--accent-color)] hover:text-white transition-all shadow-sm disabled:opacity-60"
                      disabled={savingHistoryKey === `${item.url}-${item.timestamp}`}
                    >
                      <BookmarkPlus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      title="删除该域名历史"
                      onClick={() => onRemoveHistory(item)}
                      className="p-1.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
