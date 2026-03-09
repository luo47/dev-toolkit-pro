import React, { useState, useEffect, Suspense } from 'react';
import { Code, Hash, Menu, Search, X, Plus, Github, Home as HomeIcon, LogIn, LogOut, FileSearch, Settings, HelpCircle, History, Link2, FileText, Sun, Moon, Cloud, QrCode, Server, List } from 'lucide-react';
import Home from './components/Home';
import Login from './components/Login';
import { useAuth } from './hooks/useAuth';
const QRCodeTool = React.lazy(() => import('./components/QRCodeTool'));
const ChainProcessor = React.lazy(() => import('./components/ChainProcessor'));
const CodeSnippetsTool = React.lazy(() => import('./components/CodeSnippetsTool'));
const CloudShare = React.lazy(() => import('./components/CloudShare'));
const SharePreview = React.lazy(() => import('./components/SharePreview'));

type Tool = 'home' | 'qrcode' | 'chain-processor' | 'code-snippets' | 'cloud-share' | 'share-preview';

export default function App() {
  const [activeTool, setActiveTool] = useState<Tool>(() => {
    const path = window.location.pathname.replace('/', '');
    // 关键修复：正确识别 /share-preview/:id 等深层路径
    if (path.startsWith('share-preview')) return 'share-preview';
    return (path === '' ? 'home' : path) as Tool;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const { user, loading, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.replace('/', '');
      setActiveTool((path === '' ? 'home' : path) as Tool);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle post-login redirection
  useEffect(() => {
    if (!loading && user) {
      const redirectTo = localStorage.getItem('redirect_to');
      if (redirectTo) {
        localStorage.removeItem('redirect_to');
        const toolId = redirectTo.replace('/', '') as Tool;
        if (toolId && (toolId === 'home' || tools.some(t => t.id === toolId))) {
          setActiveTool(toolId);
          if (window.location.pathname !== redirectTo) {
            window.history.replaceState(null, '', redirectTo);
          }
        }
      }
    }
  }, [user, loading]);

  // Update document title
  useEffect(() => {
    if (activeTool === 'home') {
      document.title = '浮云工具箱 - v1.0';
    } else {
      const tool = tools.find(t => t.id === activeTool);
      if (tool) {
        document.title = `浮云工具箱 - ${tool.name}`;
      }
    }
  }, [activeTool]);

  const tools = [
    { id: 'cloud-share', name: '云分享', icon: Server, isPremium: false, subName: '文本 & 文件' },
    { id: 'code-snippets', name: '代码片段', icon: Code, isPremium: true },
    { id: 'chain-processor', name: '链式文本处理', icon: FileSearch, isPremium: true },
    { id: 'qrcode', name: '二维码', icon: QrCode, isPremium: false },
  ];

  const filteredTools = tools.filter(tool =>
    tool.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToolSelect = (id: Tool) => {
    if (id === 'share-preview') return;
    const tool = tools.find(t => t.id === id);
    if (tool?.isPremium && !user) {
      // Save current intended tool path for redirection after login
      localStorage.setItem('redirect_to', `/${id}`);
      setShowLogin(true);
    } else {
      setActiveTool(id);
      const newPath = id === 'home' ? '/' : `/${id}`;
      if (window.location.pathname !== newPath) {
        window.history.pushState(null, '', newPath);
      }
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      }
    }
  };

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutConfirmSource, setLogoutConfirmSource] = useState<'sidebar' | 'topbar' | null>(null);

  const handleLogout = async () => {
    await logout();
    setActiveTool('home');
    setShowLogoutConfirm(false);
    setLogoutConfirmSource(null);
  };

  const LogoutConfirmPopup = ({ source }: { source: 'sidebar' | 'topbar' }) => (
    <div className={`absolute ${source === 'sidebar' ? 'bottom-full left-0 mb-2' : 'top-full right-0 mt-2'} ${source === 'sidebar' && !isSidebarOpen ? 'left-1/2 -translate-x-1/2 w-48' : 'w-full'} min-w-[180px] bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200 origin-bottom`}>
      <p className="text-xs text-[var(--text-primary)] mb-3 font-medium px-1">确定要退出登录吗？</p>
      <div className="flex gap-2">
        <button
          onClick={handleLogout}
          className="flex-1 py-2 bg-red-500 text-white text-[10px] font-bold rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
        >
          确定退出
        </button>
        <button
          onClick={() => { setShowLogoutConfirm(false); setLogoutConfirmSource(null); }}
          className="flex-1 py-2 bg-[var(--hover-color)] text-[var(--text-secondary)] text-[10px] font-bold rounded-xl hover:bg-[var(--border-color)] transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] flex font-sans transition-colors duration-300">
      {showLogin && (
        <Login
          onLogin={(name) => {
            if (name !== 'GitHub 用户') setShowLogin(false);
          }}
          onClose={() => setShowLogin(false)}
        />
      )}

      {/* Mobile Toggle Button - in Top Bar */}
      <div className="lg:hidden absolute top-4 left-4 z-50">
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-lg text-[var(--text-secondary)] hover:bg-[var(--hover-color)] transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity animate-in fade-in"
        />
      )}

      {/* Sidebar */}
      <aside className={`
        ${isSidebarOpen ? 'w-[280px] translate-x-0' : 'w-0 lg:w-[68px] -translate-x-full lg:translate-x-0'} 
        bg-[var(--bg-surface)] fixed lg:sticky top-0 h-screen z-50 lg:z-40 border-r border-[var(--border-color)] transition-all duration-300 flex flex-col overflow-hidden
      `}>
        <div className={`p-4 flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
          {isSidebarOpen && (
            <div className="flex items-center gap-2 lg:hidden">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4285f4] to-[#9b72cb] flex items-center justify-center text-white shadow-lg shadow-blue-500/10">
                <Cloud className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-[var(--text-primary)]">浮云工具箱</span>
            </div>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-[var(--hover-color)] rounded-full transition-colors"
            title={isSidebarOpen ? '收起菜单' : '展开菜单'}
          >
            {isSidebarOpen ? <X className="w-6 h-6 text-[var(--text-secondary)] lg:hidden" /> : null}
            <Menu className={`w-6 h-6 text-[var(--text-secondary)] ${isSidebarOpen ? 'hidden lg:block' : ''}`} />
          </button>
        </div>

        <div className="px-3 mb-4">
          {isSidebarOpen ? (
            <div className="relative group">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索工具或输入命令"
                className="w-full h-10 pl-10 pr-10 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-full text-sm outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-[var(--hover-color)] rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="w-10 h-10 flex items-center justify-center hover:bg-[var(--hover-color)] rounded-full border border-[var(--border-color)] transition-colors mx-auto"
              title="搜索工具"
            >
              <Search className="w-5 h-5 text-[var(--text-secondary)]" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
          <button
            onClick={() => {
              setActiveTool('home');
              if (window.innerWidth < 1024) {
                setIsSidebarOpen(false);
              }
            }}
            className={`flex items-center gap-3 w-full h-10 rounded-full transition-colors group ${activeTool === 'home' ? 'bg-[var(--accent-color)] text-white' : 'hover:bg-[var(--hover-color)] text-[var(--text-primary)]'
              } ${isSidebarOpen ? 'px-4' : 'justify-center'}`}
            title={!isSidebarOpen ? '首页' : undefined}
          >
            <HomeIcon className={`w-5 h-5 shrink-0 ${activeTool === 'home' ? 'text-white' : 'text-[var(--text-secondary)]'}`} />
            {isSidebarOpen && <span className="text-sm truncate flex-1 text-left">首页</span>}
          </button>

          {filteredTools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => handleToolSelect(tool.id as Tool)}
              className={`flex items-center gap-3 w-full rounded-full transition-colors group ${activeTool === tool.id ? 'bg-[var(--accent-color)] text-white' : 'hover:bg-[var(--hover-color)] text-[var(--text-primary)]'
                } ${isSidebarOpen ? 'px-4 py-2' : 'justify-center h-10'}`}
              title={!isSidebarOpen ? tool.name : undefined}
            >
              <tool.icon className={`w-5 h-5 shrink-0 ${activeTool === tool.id ? 'text-white' : 'text-[var(--text-secondary)]'}`} />
              {isSidebarOpen && (
                <div className="flex flex-col items-start overflow-hidden">
                  <span className="text-sm font-medium truncate w-full leading-tight">
                    {tool.name}
                  </span>
                  {'subName' in tool && tool.subName && (
                    <span className={`text-[10px] opacity-70 leading-tight ${activeTool === tool.id ? 'text-white' : 'text-[var(--text-secondary)]'}`}>
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

        <div className="p-3 space-y-1 border-t border-[var(--border-color)]">
          <button className={`flex items-center gap-3 w-full h-10 rounded-full hover:bg-[var(--hover-color)] transition-colors ${isSidebarOpen ? 'px-4' : 'justify-center'}`}>
            <Settings className="w-5 h-5 text-[var(--text-secondary)]" />
            {isSidebarOpen && <span className="text-sm">设置</span>}
          </button>

          <div className="pt-2 relative">
            {user ? (
              <>
                {showLogoutConfirm && logoutConfirmSource === 'sidebar' && <LogoutConfirmPopup source="sidebar" />}
                <button
                  onClick={() => {
                    if (showLogoutConfirm && logoutConfirmSource === 'sidebar') {
                      setShowLogoutConfirm(false);
                      setLogoutConfirmSource(null);
                    } else {
                      setShowLogoutConfirm(true);
                      setLogoutConfirmSource('sidebar');
                    }
                  }}
                  className={`flex items-center gap-3 w-full h-12 rounded-full hover:bg-[var(--hover-color)] transition-colors ${isSidebarOpen ? 'px-4' : 'justify-center'} ${showLogoutConfirm && logoutConfirmSource === 'sidebar' ? 'bg-[var(--hover-color)]' : ''}`}
                >
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="avatar" className="w-8 h-8 rounded-full border border-white/10 shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4285f4] to-[#9b72cb] flex items-center justify-center text-white text-xs font-bold border border-white/10 shrink-0">
                      {(user.name || user.username).charAt(0).toUpperCase()}
                    </div>
                  )}
                  {isSidebarOpen && (
                    <div className="flex flex-col items-start overflow-hidden">
                      <span className="text-sm font-medium truncate w-full">{user.name || user.username} (退出)</span>
                    </div>
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className={`flex items-center gap-3 w-full h-10 rounded-full hover:bg-[var(--hover-color)] transition-colors ${isSidebarOpen ? 'px-4' : 'justify-center'}`}
              >
                <LogIn className="w-5 h-5 text-[var(--text-secondary)]" />
                {isSidebarOpen && <span className="text-sm">登录</span>}
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="h-16 flex items-center border-b border-[var(--border-color)] sticky top-0 bg-[var(--bg-main)]/80 backdrop-blur-md z-30">
          <div className={`${activeTool === 'chain-processor' || activeTool === 'code-snippets' ? 'max-w-[1400px]' : 'max-w-[840px]'} mx-auto w-full px-4 lg:px-8 flex items-center justify-between`}>
            <div className="flex items-center gap-4 lg:gap-8 flex-1 overflow-hidden">
              {!isSidebarOpen && <div className="w-10 lg:hidden shrink-0" />}

              <div
                onClick={() => {
                  setActiveTool('home');
                  const newPath = '/';
                  if (window.location.pathname !== newPath) {
                    window.history.pushState(null, '', newPath);
                  }
                  if (window.innerWidth < 1024) {
                    setIsSidebarOpen(false);
                  }
                }}
                className="flex items-center gap-2 cursor-pointer hover:bg-[var(--hover-color)] px-2 lg:px-3 py-1.5 rounded-lg transition-colors shrink-0"
              >
                <div className="hidden sm:flex w-8 h-8 rounded-lg bg-gradient-to-br from-[#4285f4] to-[#9b72cb] items-center justify-center text-white shadow-lg shadow-blue-500/10">
                  <Cloud className="w-5 h-5" />
                </div>
                <span className="text-base lg:text-lg font-bold tracking-tight truncate">浮云工具箱</span>
                <span className="hidden sm:inline text-[var(--text-secondary)] text-sm font-normal">v1.0</span>
              </div>

              {/* Header Search Bar */}
              <div className="hidden md:flex flex-1 max-w-md relative">
                <div className="relative w-full group">
                  <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                    <Search className="w-4 h-4 text-[var(--text-secondary)]" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索工具或输入命令"
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-full pl-10 pr-10 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:ring-2 focus:ring-[var(--accent-color)]/50 outline-none transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-[var(--hover-color)] rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  {/* Search Results Dropdown */}
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
                                key={tool.id}
                                onClick={() => {
                                  handleToolSelect(tool.id as Tool);
                                  setSearchQuery('');
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
                                {tool.isPremium && (
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
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 hover:bg-[var(--hover-color)] rounded-full transition-colors text-[var(--text-secondary)]"
                title={isDarkMode ? '切换到浅色模式' : '切换到深色模式'}
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
                  {showLogoutConfirm && logoutConfirmSource === 'topbar' && <LogoutConfirmPopup source="topbar" />}
                  <button
                    onClick={() => {
                      if (showLogoutConfirm && logoutConfirmSource === 'topbar') {
                        setShowLogoutConfirm(false);
                        setLogoutConfirmSource(null);
                      } else {
                        setShowLogoutConfirm(true);
                        setLogoutConfirmSource('topbar');
                      }
                    }}
                    className={`flex items-center gap-2 p-1 hover:bg-[var(--hover-color)] rounded-full transition-colors ${showLogoutConfirm && logoutConfirmSource === 'topbar' ? 'bg-[var(--hover-color)]' : ''}`}
                    title={`${user.name || user.username} (退出)`}
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
                  onClick={() => setShowLogin(true)}
                  className="p-2 hover:bg-[var(--hover-color)] rounded-full transition-colors text-[var(--text-secondary)]"
                  title="登录"
                >
                  <LogIn className="w-6 h-6" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto w-full">
          <div className={`${activeTool === 'chain-processor' || activeTool === 'code-snippets' ? 'max-w-[1400px]' : 'max-w-[840px]'} mx-auto w-full px-4 lg:px-8 py-8 flex flex-col min-h-full`}>
            {activeTool === 'home' ? (
              <div className="flex-1 flex flex-col pb-20">
                <Home
                  onSelectTool={(id) => handleToolSelect(id as Tool)}
                  isLoggedIn={!!user}
                  onOpenLogin={() => setShowLogin(true)}
                />
              </div>
            ) : (
              <div className="flex-1 animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col">
                <div className="mb-6">
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">
                    {tools.find((t) => t.id === activeTool)?.name}
                  </h2>
                </div>
                <div className={`flex-1 ${activeTool === 'qrcode' ? '' : 'bg-[var(--bg-surface)] p-4 md:p-8 rounded-[28px] border border-[var(--border-color)] shadow-xl'}`}>
                  <Suspense fallback={
                    <div className="flex items-center justify-center p-20">
                      <div className="w-10 h-10 border-4 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  }>
                    {activeTool === 'chain-processor' && <ChainProcessor />}
                    {activeTool === 'qrcode' && <QRCodeTool />}
                    {activeTool === 'code-snippets' && <CodeSnippetsTool />}
                    {activeTool === 'cloud-share' && <CloudShare />}
                    {activeTool === 'share-preview' && <SharePreview />}
                  </Suspense>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* 固定页脚 */}
        <div className="py-2 bg-[var(--bg-main)]/80 backdrop-blur-md border-t border-[var(--border-color)] z-20">
          <p className="text-center text-[10px] text-[var(--text-secondary)]">
            浮云工具箱可以提供有用的工具，但某些高级功能可能需要登录。
          </p>
        </div>
      </main>
    </div>
  );
}
