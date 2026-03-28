import { Download, FileText, History, Play, Search, Star, Trash2, Upload } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { type SavedChain, STEP_CONFIG } from "./ChainTypes";

interface ChainLibraryProps {
  savedChains: SavedChain[];
  onLoadChain: (chain: SavedChain) => void;
  onDeleteChain: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function ChainLibrary({
  savedChains,
  onLoadChain,
  onDeleteChain,
  onToggleFavorite,
  onExport,
  onImport,
}: ChainLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredChains = savedChains
    .filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return b.createdAt - a.createdAt;
    });

  return (
    <div className="space-y-4 pt-6 border-t border-[var(--border-color)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="text-lg font-bold text-[var(--text-primary)]">已保存的处理链</h3>
          <span className="px-2 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-full text-[10px] text-[var(--text-secondary)]">
            {savedChains.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索处理链..."
              className="pl-9 pr-4 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg text-xs outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 w-48 transition-all"
            />
          </div>
          <div className="h-4 w-px bg-[var(--border-color)]" />
          <button
            type="button"
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-[var(--hover-color)] rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            导出
          </button>
          <label className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-[var(--hover-color)] rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer">
            <Download className="w-3.5 h-3.5" />
            导入
            <input type="file" accept=".json" onChange={onImport} className="hidden" />
          </label>
        </div>
      </div>

      {filteredChains.length === 0 ? (
        <div className="py-12 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl flex flex-col items-center justify-center text-[var(--text-secondary)]">
          <FileText className="w-8 h-8 mb-2 opacity-20" />
          <p className="text-sm">暂无保存的处理链</p>
          {searchQuery && <p className="text-xs mt-1 opacity-60">尝试更换搜索关键词</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredChains.map((chain) => (
            <div
              key={chain.id}
              className="group relative bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 hover:shadow-lg hover:border-[var(--accent-color)]/30 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">{chain.name}</h4>
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    {chain.steps.length} 个步骤 · {new Date(chain.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(chain.id)}
                    className={`p-1.5 rounded-lg transition-colors ${chain.isFavorite ? "text-[var(--warning-color)] hover:bg-[var(--warning-color)]/10" : "text-[var(--text-secondary)] hover:bg-[var(--hover-color)] md:opacity-0 md:group-hover:opacity-100"}`}
                  >
                    <Star className={`w-3.5 h-3.5 ${chain.isFavorite ? "fill-current" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteChain(chain.id)}
                    className="p-1.5 text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors md:opacity-0 md:group-hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mb-4">
                {chain.steps.slice(0, 4).map((step) => (
                  <span
                    key={step.id}
                    className="px-1.5 py-0.5 bg-[var(--bg-main)] rounded text-[9px] font-medium text-[var(--text-secondary)]"
                  >
                    {STEP_CONFIG[step.type].icon}
                  </span>
                ))}
                {chain.steps.length > 4 && (
                  <span className="px-1.5 py-0.5 bg-[var(--bg-main)] rounded text-[9px] font-medium text-[var(--text-secondary)]">
                    +{chain.steps.length - 4}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => onLoadChain(chain)}
                className="w-full py-2 bg-[var(--bg-main)] hover:bg-[var(--accent-color)] hover:text-white border border-[var(--border-color)] hover:border-[var(--accent-color)] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-3 h-3" />
                加载此处理链
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
