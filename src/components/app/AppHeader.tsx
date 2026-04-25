import { Cloud, LogIn, Menu, Moon, Search, Sun, X } from "lucide-react";
import type { User } from "../../hooks/useAuth";
import type { ToolId, ToolMetadata } from "../../types";
import LogoutConfirmPopup from "./LogoutConfirmPopup";

interface AppHeaderProps {
  filteredTools: ToolMetadata[];
  isDarkMode: boolean;
  isSidebarOpen: boolean;
  logoutConfirmSource: "sidebar" | "topbar" | null;
  searchQuery: string;
  showLogoutConfirm: boolean;
  titleClassName: string;
  user: User | null;
  onClearSearch: () => void;
  onOpenLogin: () => void;
  onSearchChange: (value: string) => void;
  onToggleDarkMode: () => void;
  onToggleLogoutConfirm: (source: "sidebar" | "topbar") => void;
  onToggleSidebar: () => void;
  onToolSelect: (id: ToolId) => void;
  onConfirmLogout: () => void;
  onCloseLogoutConfirm: () => void;
}

function MobileSidebarToggle({
  isSidebarOpen,
  onToggleSidebar,
}: {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  if (isSidebarOpen) return null;
  return (
    <div className="lg:hidden absolute top-4 left-4 z-50">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="p-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-lg text-[var(--text-secondary)] hover:bg-[var(--hover-color)] transition-all"
        aria-label="打开侧边栏"
        title="打开菜单"
      >
        <Menu className="w-5 h-5" />
      </button>
    </div>
  );
}

function HeaderSearch({
  filteredTools,
  searchQuery,
  onClearSearch,
  onSearchChange,
  onToolSelect,
}: {
  filteredTools: ToolMetadata[];
  searchQuery: string;
  onClearSearch: () => void;
  onSearchChange: (value: string) => void;
  onToolSelect: (id: ToolId) => void;
}) {
  return (
    <div className="hidden md:flex flex-1 max-w-md relative">
      <div className="relative w-full group">
        <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
          <Search className="w-4 h-4 text-[var(--text-secondary)]" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索工具或输入命令"
          className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-full pl-10 pr-10 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:ring-2 focus:ring-[var(--accent-color)]/50 outline-none transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={onClearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-[var(--hover-color)] rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="清除搜索"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {searchQuery && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-2 max-h-[400px] overflow-y-auto custom-scrollbar">
              {filteredTools.length > 0 ? (
                <>
                  <div className="px-3 py-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    匹配的工具 ({filteredTools.length})
                  </div>
                  {filteredTools.map((tool) => (
                    <button
                      type="button"
                      key={tool.id}
                      onClick={() => {
                        onToolSelect(tool.id);
                        onClearSearch();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--hover-color)] rounded-xl transition-colors text-left group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[var(--bg-main)] flex items-center justify-center group-hover:bg-[var(--accent-color)]/10 transition-colors">
                        <tool.icon className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--accent-color)]" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--text-primary)]">{tool.name}</div>
                        <div className="text-[10px] text-[var(--text-secondary)]">点击立即使用</div>
                      </div>
                      {tool.action.type === "premium" && (
                        <span className="text-[8px] font-bold bg-[var(--accent-color)]/10 text-[var(--accent-color)] px-1.5 py-0.5 rounded uppercase tracking-wider">
                          PRO
                        </span>
                      )}
                    </button>
                  ))}
                </>
              ) : (
                <div className="px-4 py-8 text-center text-[var(--text-secondary)]">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">未找到与 "{searchQuery}" 相关的工具</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HeaderUserArea({
  isDarkMode,
  isSidebarOpen,
  logoutConfirmSource,
  showLogoutConfirm,
  user,
  onCloseLogoutConfirm,
  onConfirmLogout,
  onOpenLogin,
  onToggleDarkMode,
  onToggleLogoutConfirm,
}: {
  isDarkMode: boolean;
  isSidebarOpen: boolean;
  logoutConfirmSource: "sidebar" | "topbar" | null;
  showLogoutConfirm: boolean;
  user: User | null;
  onCloseLogoutConfirm: () => void;
  onConfirmLogout: () => void;
  onOpenLogin: () => void;
  onToggleDarkMode: () => void;
  onToggleLogoutConfirm: (source: "sidebar" | "topbar") => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggleDarkMode}
        className="p-2 hover:bg-[var(--hover-color)] rounded-full transition-colors text-[var(--text-secondary)]"
        title={isDarkMode ? "切换到浅色模式" : "切换到深色模式"}
        aria-label={isDarkMode ? "切换到浅色模式" : "切换到深色模式"}
      >
        {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>
      {user && (
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] animate-pulse" />
          <span className="text-[10px] font-bold text-[var(--accent-color)] uppercase tracking-widest">高级会员</span>
        </div>
      )}
      {user ? (
        <div className="relative">
          {showLogoutConfirm && logoutConfirmSource === "topbar" && (
            <LogoutConfirmPopup
              source="topbar"
              isSidebarOpen={isSidebarOpen}
              onCancel={onCloseLogoutConfirm}
              onConfirm={onConfirmLogout}
            />
          )}
          <button
            type="button"
            onClick={() => onToggleLogoutConfirm("topbar")}
            className={`flex items-center gap-2 p-1 hover:bg-[var(--hover-color)] rounded-full transition-colors ${showLogoutConfirm && logoutConfirmSource === "topbar" ? "bg-[var(--hover-color)]" : ""}`}
            title={`${user.name || user.username} (退出)`}
            aria-label="用户菜单"
          >
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="avatar" className="w-8 h-8 rounded-full border border-white/20" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4285f4] to-[#9b72cb] flex items-center justify-center text-white text-xs font-bold border border-white/20">
                {(user.name || user.username).charAt(0).toUpperCase()}
              </div>
            )}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpenLogin}
          className="p-2 hover:bg-[var(--hover-color)] rounded-full transition-colors text-[var(--text-secondary)]"
          title="登录"
          aria-label="登录"
        >
          <LogIn className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

export default function AppHeader(props: AppHeaderProps) {
  const {
    filteredTools,
    isSidebarOpen,
    searchQuery,
    titleClassName,
    onClearSearch,
    onSearchChange,
    onToggleSidebar,
    onToolSelect,
  } = props;

  return (
    <>
      <MobileSidebarToggle isSidebarOpen={isSidebarOpen} onToggleSidebar={onToggleSidebar} />

      <div className="h-16 flex items-center border-b border-[var(--border-color)] sticky top-0 bg-[var(--bg-main)]/80 backdrop-blur-md z-30">
        <div className={`${titleClassName} mx-auto w-full px-4 lg:px-8 flex items-center justify-between`}>
          <div className="flex items-center gap-4 lg:gap-8 flex-1 overflow-hidden">
            {!isSidebarOpen && <div className="w-10 lg:hidden shrink-0" />}

            <button
              type="button"
              onClick={() => onToolSelect("home")}
              className="flex items-center gap-2 cursor-pointer hover:bg-[var(--hover-color)] px-2 lg:px-3 py-1.5 rounded-lg transition-colors shrink-0"
              aria-label="返回首页"
            >
              <div className="hidden sm:flex w-8 h-8 rounded-lg bg-gradient-to-br from-[#4285f4] to-[#9b72cb] items-center justify-center text-white shadow-lg shadow-blue-500/10">
                <Cloud className="w-5 h-5" />
              </div>
              <span className="text-base lg:text-lg font-bold tracking-tight truncate">浮云工具箱</span>
              <span className="hidden sm:inline text-[var(--text-secondary)] text-sm font-normal">v1.0</span>
            </button>

            <HeaderSearch
              filteredTools={filteredTools}
              searchQuery={searchQuery}
              onClearSearch={onClearSearch}
              onSearchChange={onSearchChange}
              onToolSelect={onToolSelect}
            />
          </div>

          <HeaderUserArea {...props} />
        </div>
      </div>
    </>
  );
}
