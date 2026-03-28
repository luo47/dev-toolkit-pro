import { Cloud, Home as HomeIcon, LogIn, Menu, Search, Settings, X } from "lucide-react";
import type { User } from "../../hooks/useAuth";
import type { ToolId, ToolMetadata } from "../../types";
import LogoutConfirmPopup from "./LogoutConfirmPopup";

interface AppSidebarProps {
  activeTool: ToolId;
  filteredTools: ToolMetadata[];
  isSidebarOpen: boolean;
  logoutConfirmSource: "sidebar" | "topbar" | null;
  searchQuery: string;
  showLogoutConfirm: boolean;
  user: User | null;
  onClearSearch: () => void;
  onOpenLogin: () => void;
  onSearchChange: (value: string) => void;
  onToggleLogoutConfirm: (source: "sidebar" | "topbar") => void;
  onToolSelect: (id: ToolId) => void;
  onToggleSidebar: () => void;
  onConfirmLogout: () => void;
  onCloseLogoutConfirm: () => void;
}

function SidebarHeader({
  isSidebarOpen,
  onToggleSidebar,
}: {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  return (
    <div
      className={`p-4 flex items-center ${isSidebarOpen ? "justify-between" : "justify-center"}`}
    >
      {isSidebarOpen && (
        <div className="flex items-center gap-2 lg:hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4285f4] to-[#9b72cb] flex items-center justify-center text-white shadow-lg shadow-blue-500/10">
            <Cloud className="w-5 h-5" />
          </div>
          <span className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
            浮云工具箱
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={onToggleSidebar}
        className="p-2 hover:bg-[var(--hover-color)] rounded-full transition-colors"
        title={isSidebarOpen ? "收起菜单" : "展开菜单"}
      >
        {isSidebarOpen ? <X className="w-6 h-6 text-[var(--text-secondary)] lg:hidden" /> : null}
        <Menu
          className={`w-6 h-6 text-[var(--text-secondary)] ${isSidebarOpen ? "hidden lg:block" : ""}`}
        />
      </button>
    </div>
  );
}

function SidebarSearch({
  isSidebarOpen,
  searchQuery,
  onClearSearch,
  onSearchChange,
  onToggleSidebar,
}: {
  isSidebarOpen: boolean;
  searchQuery: string;
  onClearSearch: () => void;
  onSearchChange: (value: string) => void;
  onToggleSidebar: () => void;
}) {
  return (
    <div className="px-3 mb-4">
      {isSidebarOpen ? (
        <div className="relative group">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索工具或输入命令"
            className="w-full h-10 pl-10 pr-10 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-full text-sm outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          {searchQuery && (
            <button
              type="button"
              onClick={onClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-[var(--hover-color)] rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={onToggleSidebar}
          className="w-10 h-10 flex items-center justify-center hover:bg-[var(--hover-color)] rounded-full border border-[var(--border-color)] transition-colors mx-auto"
          title="搜索工具"
        >
          <Search className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
      )}
    </div>
  );
}

function SidebarNav({
  activeTool,
  filteredTools,
  isSidebarOpen,
  onToolSelect,
}: {
  activeTool: ToolId;
  filteredTools: ToolMetadata[];
  isSidebarOpen: boolean;
  onToolSelect: (id: ToolId) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
      <button
        type="button"
        onClick={() => onToolSelect("home")}
        className={`flex items-center gap-3 w-full h-10 rounded-full transition-colors group ${
          activeTool === "home"
            ? "bg-[var(--accent-color)] text-white"
            : "hover:bg-[var(--hover-color)] text-[var(--text-primary)]"
        } ${isSidebarOpen ? "px-4" : "justify-center"}`}
        title={!isSidebarOpen ? "首页" : undefined}
      >
        <HomeIcon
          className={`w-5 h-5 shrink-0 ${activeTool === "home" ? "text-white" : "text-[var(--text-secondary)]"}`}
        />
        {isSidebarOpen && <span className="text-sm truncate flex-1 text-left">首页</span>}
      </button>

      {filteredTools.map((tool) => (
        <button
          type="button"
          key={tool.id}
          onClick={() => onToolSelect(tool.id)}
          className={`flex items-center gap-3 w-full rounded-full transition-colors group ${
            activeTool === tool.id
              ? "bg-[var(--accent-color)] text-white"
              : "hover:bg-[var(--hover-color)] text-[var(--text-primary)]"
          } ${isSidebarOpen ? "px-4 py-2" : "justify-center h-10"}`}
          title={!isSidebarOpen ? tool.name : undefined}
        >
          <tool.icon
            className={`w-5 h-5 shrink-0 ${activeTool === tool.id ? "text-white" : "text-[var(--text-secondary)]"}`}
          />
          {isSidebarOpen && (
            <div className="flex flex-col items-start overflow-hidden">
              <span className="text-sm font-medium truncate w-full leading-tight">{tool.name}</span>
              {tool.subName && (
                <span
                  className={`text-[10px] opacity-70 leading-tight ${activeTool === tool.id ? "text-white" : "text-[var(--text-secondary)]"}`}
                >
                  {tool.subName}
                </span>
              )}
            </div>
          )}
        </button>
      ))}

      {isSidebarOpen && filteredTools.length === 0 && (
        <p className="px-4 py-2 text-xs text-[var(--text-secondary)] italic">未找到匹配工具</p>
      )}
    </div>
  );
}

function SidebarAccount({
  isSidebarOpen,
  logoutConfirmSource,
  showLogoutConfirm,
  user,
  onCloseLogoutConfirm,
  onConfirmLogout,
  onOpenLogin,
  onToggleLogoutConfirm,
}: {
  isSidebarOpen: boolean;
  logoutConfirmSource: "sidebar" | "topbar" | null;
  showLogoutConfirm: boolean;
  user: User | null;
  onCloseLogoutConfirm: () => void;
  onConfirmLogout: () => void;
  onOpenLogin: () => void;
  onToggleLogoutConfirm: (source: "sidebar" | "topbar") => void;
}) {
  return (
    <div className="p-3 space-y-1 border-t border-[var(--border-color)]">
      <button
        type="button"
        className={`flex items-center gap-3 w-full h-10 rounded-full hover:bg-[var(--hover-color)] transition-colors ${isSidebarOpen ? "px-4" : "justify-center"}`}
      >
        <Settings className="w-5 h-5 text-[var(--text-secondary)]" />
        {isSidebarOpen && <span className="text-sm">设置</span>}
      </button>

      <div className="pt-2 relative">
        {user ? (
          <SidebarLoggedInAccount
            isSidebarOpen={isSidebarOpen}
            logoutConfirmSource={logoutConfirmSource}
            showLogoutConfirm={showLogoutConfirm}
            user={user}
            onCloseLogoutConfirm={onCloseLogoutConfirm}
            onConfirmLogout={onConfirmLogout}
            onToggleLogoutConfirm={onToggleLogoutConfirm}
          />
        ) : (
          <SidebarLoggedOutAccount isSidebarOpen={isSidebarOpen} onOpenLogin={onOpenLogin} />
        )}
      </div>
    </div>
  );
}

function SidebarLoggedInAccount({
  isSidebarOpen,
  logoutConfirmSource,
  showLogoutConfirm,
  user,
  onCloseLogoutConfirm,
  onConfirmLogout,
  onToggleLogoutConfirm,
}: {
  isSidebarOpen: boolean;
  logoutConfirmSource: "sidebar" | "topbar" | null;
  showLogoutConfirm: boolean;
  user: User;
  onCloseLogoutConfirm: () => void;
  onConfirmLogout: () => void;
  onToggleLogoutConfirm: (source: "sidebar" | "topbar") => void;
}) {
  return (
    <>
      {showLogoutConfirm && logoutConfirmSource === "sidebar" && (
        <LogoutConfirmPopup
          source="sidebar"
          isSidebarOpen={isSidebarOpen}
          onCancel={onCloseLogoutConfirm}
          onConfirm={onConfirmLogout}
        />
      )}
      <button
        type="button"
        onClick={() => onToggleLogoutConfirm("sidebar")}
        className={`flex items-center gap-3 w-full h-12 rounded-full hover:bg-[var(--hover-color)] transition-colors ${isSidebarOpen ? "px-4" : "justify-center"} ${showLogoutConfirm && logoutConfirmSource === "sidebar" ? "bg-[var(--hover-color)]" : ""}`}
      >
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt="avatar"
            className="w-8 h-8 rounded-full border border-white/10 shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4285f4] to-[#9b72cb] flex items-center justify-center text-white text-xs font-bold border border-white/10 shrink-0">
            {(user.name || user.username).charAt(0).toUpperCase()}
          </div>
        )}
        {isSidebarOpen && (
          <div className="flex flex-col items-start overflow-hidden">
            <span className="text-sm font-medium truncate w-full">
              {user.name || user.username} (退出)
            </span>
          </div>
        )}
      </button>
    </>
  );
}

function SidebarLoggedOutAccount({
  isSidebarOpen,
  onOpenLogin,
}: {
  isSidebarOpen: boolean;
  onOpenLogin: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpenLogin}
      className={`flex items-center gap-3 w-full h-10 rounded-full hover:bg-[var(--hover-color)] transition-colors ${isSidebarOpen ? "px-4" : "justify-center"}`}
    >
      <LogIn className="w-5 h-5 text-[var(--text-secondary)]" />
      {isSidebarOpen && <span className="text-sm">登录</span>}
    </button>
  );
}

export default function AppSidebar(props: AppSidebarProps) {
  const {
    activeTool,
    filteredTools,
    isSidebarOpen,
    searchQuery,
    onClearSearch,
    onSearchChange,
    onToggleSidebar,
    onToolSelect,
  } = props;

  return (
    <aside
      className={`
        ${isSidebarOpen ? "w-[280px] translate-x-0" : "w-0 lg:w-[68px] -translate-x-full lg:translate-x-0"}
        bg-[var(--bg-surface)] fixed lg:sticky top-0 h-screen z-50 lg:z-40 border-r border-[var(--border-color)] transition-all duration-300 flex flex-col overflow-hidden
      `}
    >
      <SidebarHeader isSidebarOpen={isSidebarOpen} onToggleSidebar={onToggleSidebar} />
      <SidebarSearch
        isSidebarOpen={isSidebarOpen}
        searchQuery={searchQuery}
        onClearSearch={onClearSearch}
        onSearchChange={onSearchChange}
        onToggleSidebar={onToggleSidebar}
      />
      <SidebarNav
        activeTool={activeTool}
        filteredTools={filteredTools}
        isSidebarOpen={isSidebarOpen}
        onToolSelect={onToolSelect}
      />
      <SidebarAccount {...props} />
    </aside>
  );
}
