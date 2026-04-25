import { ArrowRight, Lock, Sparkles } from "lucide-react";
import type { ToolMetadata } from "../types";
import { tools as ALL_TOOLS } from "./app/appConstants";
import SearchBox from "./SearchBox";

interface HomeProps {
  onSelectTool: (toolId: string) => void;
  isLoggedIn: boolean;
  onOpenLogin: () => void;
  searchQuery?: string;
}

const filterHomeTools = (searchQuery: string) =>
  ALL_TOOLS.filter(
    (tool) =>
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tool.description || "").toLowerCase().includes(searchQuery.toLowerCase()),
  );

export default function Home({ onSelectTool, isLoggedIn, onOpenLogin, searchQuery = "" }: HomeProps) {
  const tools = filterHomeTools(searchQuery);

  const handleToolClick = (tool: ToolMetadata) => {
    const { action } = tool;

    // 应用行为策略逻辑
    const strategy: Record<string, () => void> = {
      internal: () => onSelectTool(tool.id),
      external: () => {
        if (action.type === "external") {
          window.open(action.url, "_blank");
        }
      },
      premium: () => (!isLoggedIn ? onOpenLogin() : onSelectTool(tool.id)),
    };

    (strategy[action.type] || strategy.internal)();
  };

  return (
    <div className="flex flex-col gap-8 w-full">
      <SearchBox />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {tools.map((tool) => (
          <button
            type="button"
            key={tool.id}
            onClick={() => handleToolClick(tool)}
            className="group relative flex flex-col h-full min-h-[220px] p-6 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[28px] hover:bg-[var(--hover-color)] hover:border-[var(--text-secondary)] transition-all duration-300 text-left overflow-hidden hover:shadow-2xl hover:shadow-black/10 hover:-translate-y-1"
          >
            {/* Background Glow Effect */}
            <div className="absolute -inset-px bg-gradient-to-br from-[var(--accent-color)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shrink-0 ${
                        tool.action.type === "premium" && !isLoggedIn
                          ? "bg-[var(--bg-main)] text-[var(--text-secondary)]"
                          : "bg-[var(--bg-main)] text-[var(--accent-color)] group-hover:bg-[var(--bg-surface)]"
                      }`}
                    >
                      <tool.icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-color)] transition-colors leading-tight">
                      {tool.name}
                    </h3>
                  </div>

                  {tool.action.type === "premium" && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isLoggedIn && <Lock className="w-3.5 h-3.5 text-[var(--text-secondary)]" />}
                      <div className="flex items-center gap-1 px-2.5 py-1 bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 rounded-full">
                        <Sparkles className="w-3 h-3 text-[var(--accent-color)]" />
                        <span className="text-[10px] font-bold text-[var(--accent-color)] uppercase tracking-wider">
                          高级版
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed line-clamp-2 group-hover:text-[var(--text-primary)] transition-colors">
                  {tool.description}
                </p>
              </div>

              <div className="flex items-center justify-end mt-4">
                <div className="w-9 h-9 rounded-full bg-[var(--bg-main)] flex items-center justify-center group-hover:bg-[var(--accent-color)] transition-all duration-300 group-hover:scale-110">
                  <ArrowRight className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-white" />
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
