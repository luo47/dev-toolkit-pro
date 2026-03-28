import React, { Suspense, useEffect, useState } from "react";
import AppHeader from "./components/app/AppHeader";
import AppOverlays from "./components/app/AppOverlays";
import AppSidebar from "./components/app/AppSidebar";
import { BREAKPOINTS, tools, WIDE_TOOLS } from "./components/app/appConstants";
import Home from "./components/Home";
import Login from "./components/Login";
import { useAuth } from "./hooks/useAuth";
import { useAppStore } from "./store";
import type { ToolId } from "./types";

const QRCodeTool = React.lazy(() => import("./components/QRCodeTool"));
const ChainProcessor = React.lazy(() => import("./components/ChainProcessor"));
const CodeSnippetsTool = React.lazy(() => import("./components/CodeSnippetsTool"));
const CloudShare = React.lazy(() => import("./components/CloudShare"));
const OpenAIConnectivityTool = React.lazy(() => import("./components/OpenAIConnectivityTool"));
const SharePreview = React.lazy(() => import("./components/SharePreview"));

const getToolIdFromLocation = () => {
  const path = window.location.pathname.replace("/", "");
  if (path.startsWith("share-preview")) return "share-preview" as ToolId;
  return (path === "" ? "home" : path) as ToolId;
};

const getContentWidthClass = (activeTool: ToolId) => (WIDE_TOOLS.has(activeTool) ? "max-w-[1400px]" : "max-w-[840px]");

const LoadingFallback = () => (
  <div className="flex items-center justify-center p-20">
    <div className="w-10 h-10 border-4 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const ToolContent = ({ activeTool }: { activeTool: ToolId }) => (
  <Suspense fallback={<LoadingFallback />}>
    {activeTool === "chain-processor" && <ChainProcessor />}
    {activeTool === "qrcode" && <QRCodeTool />}
    {activeTool === "code-snippets" && <CodeSnippetsTool />}
    {activeTool === "cloud-share" && <CloudShare />}
    {activeTool === "openai-api-tester" && <OpenAIConnectivityTool />}
    {activeTool === "share-preview" && <SharePreview />}
  </Suspense>
);

const AppFooter = () => (
  <div className="py-2 bg-[var(--bg-main)]/80 backdrop-blur-md border-t border-[var(--border-color)] z-20">
    <p className="text-center text-[10px] text-[var(--text-secondary)]">
      浮云工具箱可以提供有用的工具，但某些高级功能可能需要登录。
    </p>
  </div>
);

const ActiveToolPanel = ({ activeTool }: { activeTool: ToolId }) => (
  <div className="flex-1 animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col">
    <div className="mb-3 lg:mb-4">
      <h2 className="text-xl md:text-2xl font-bold tracking-tight leading-tight">
        {tools.find((tool) => tool.id === activeTool)?.name}
      </h2>
    </div>
    <div
      className={`flex-1 ${activeTool === "qrcode" || activeTool === "openai-api-tester" ? "" : "bg-[var(--bg-surface)] p-4 md:p-6 rounded-[24px] border border-[var(--border-color)] shadow-xl"}`}
    >
      <ToolContent activeTool={activeTool} />
    </div>
  </div>
);

export default function App() {
  const { user, loading, isDarkMode, toast, toggleDarkMode, showToast, logout } = useAppStore();
  const [activeTool, setActiveTool] = useState<ToolId>(getToolIdFromLocation);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= BREAKPOINTS.LG);
  const [showLogin, setShowLogin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutConfirmSource, setLogoutConfirmSource] = useState<"sidebar" | "topbar" | null>(null);

  useEffect(() => {
    window.showToast = showToast;
  }, [showToast]);

  useAuth();

  useEffect(() => {
    const handlePopState = () => setActiveTool(getToolIdFromLocation());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    const redirectTo = localStorage.getItem("redirect_to");
    if (!redirectTo) return;

    localStorage.removeItem("redirect_to");
    const toolId = redirectTo.replace("/", "") as ToolId;
    const isValidTool = toolId === "home" || tools.some((tool) => tool.id === toolId);
    if (!isValidTool) return;

    setActiveTool(toolId);
    if (window.location.pathname !== redirectTo) {
      window.history.replaceState(null, "", redirectTo);
    }
  }, [loading, user]);

  useEffect(() => {
    document.title =
      activeTool === "home"
        ? "浮云工具箱 - v1.0"
        : `浮云工具箱 - ${tools.find((tool) => tool.id === activeTool)?.name ?? "工具"}`;
  }, [activeTool]);

  const filteredTools = tools.filter((tool) => tool.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const closeLogoutConfirm = () => {
    setShowLogoutConfirm(false);
    setLogoutConfirmSource(null);
  };

  const navigateToTool = (id: ToolId) => {
    if (id === "share-preview") return;
    setActiveTool(id);
    const newPath = id === "home" ? "/" : `/${id}`;
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, "", newPath);
    }
    if (window.innerWidth < BREAKPOINTS.LG) {
      setIsSidebarOpen(false);
    }
  };

  const handleToolSelect = (id: ToolId) => {
    const tool = tools.find((item) => item.id === id);
    if (tool?.isPremium && !user) {
      localStorage.setItem("redirect_to", `/${id}`);
      setShowLogin(true);
      return;
    }
    navigateToTool(id);
  };

  const toggleLogoutConfirm = (source: "sidebar" | "topbar") => {
    if (showLogoutConfirm && logoutConfirmSource === source) {
      closeLogoutConfirm();
      return;
    }
    setShowLogoutConfirm(true);
    setLogoutConfirmSource(source);
  };

  const handleLogout = async () => {
    await logout();
    navigateToTool("home");
    closeLogoutConfirm();
  };

  const contentWidthClass = getContentWidthClass(activeTool);

  const renderMainContent = () => {
    if (activeTool === "home") {
      return (
        <div className="flex-1 flex flex-col pb-20">
          <Home
            onSelectTool={(id) => handleToolSelect(id as ToolId)}
            isLoggedIn={!!user}
            onOpenLogin={() => setShowLogin(true)}
            searchQuery={searchQuery}
          />
        </div>
      );
    }

    return <ActiveToolPanel activeTool={activeTool} />;
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] flex font-sans transition-colors duration-300">
      {showLogin && (
        <Login
          onLogin={(name) => {
            if (name !== "GitHub 用户") setShowLogin(false);
          }}
          onClose={() => setShowLogin(false)}
        />
      )}

      {isSidebarOpen && (
        <button
          type="button"
          aria-label="关闭侧边栏"
          onClick={() => setIsSidebarOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity animate-in fade-in"
        />
      )}

      <AppSidebar
        activeTool={activeTool}
        filteredTools={filteredTools}
        isSidebarOpen={isSidebarOpen}
        logoutConfirmSource={logoutConfirmSource}
        searchQuery={searchQuery}
        showLogoutConfirm={showLogoutConfirm}
        user={user}
        onClearSearch={() => setSearchQuery("")}
        onOpenLogin={() => setShowLogin(true)}
        onSearchChange={setSearchQuery}
        onToggleLogoutConfirm={toggleLogoutConfirm}
        onToolSelect={handleToolSelect}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onConfirmLogout={handleLogout}
        onCloseLogoutConfirm={closeLogoutConfirm}
      />

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <AppHeader
          filteredTools={filteredTools}
          isDarkMode={isDarkMode}
          isSidebarOpen={isSidebarOpen}
          logoutConfirmSource={logoutConfirmSource}
          searchQuery={searchQuery}
          showLogoutConfirm={showLogoutConfirm}
          titleClassName={contentWidthClass}
          user={user}
          onClearSearch={() => setSearchQuery("")}
          onOpenLogin={() => setShowLogin(true)}
          onSearchChange={setSearchQuery}
          onToggleDarkMode={toggleDarkMode}
          onToggleLogoutConfirm={toggleLogoutConfirm}
          onToggleSidebar={() => setIsSidebarOpen(true)}
          onToolSelect={handleToolSelect}
          onConfirmLogout={handleLogout}
          onCloseLogoutConfirm={closeLogoutConfirm}
        />

        <div className="flex-1 overflow-y-auto w-full">
          <div className={`${contentWidthClass} mx-auto w-full px-4 lg:px-8 py-4 lg:py-6 flex flex-col min-h-full`}>
            {renderMainContent()}
          </div>
        </div>

        <AppFooter />
      </main>

      <AppOverlays loading={loading} toast={toast} />
    </div>
  );
}
