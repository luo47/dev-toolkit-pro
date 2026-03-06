import { useState, useEffect, useMemo } from 'react';
import { Copy, Check, Server, ArrowRightLeft, Trash2, History, Search, Clock, Pin, Star } from 'lucide-react';

interface HistoryItem {
  id: string;
  win: string;
  uri: string;
  copyCount: number;
  lastCopiedAt: number;
  isPinned?: boolean;
  isFavorite?: boolean;
}

export default function SmbConverter() {
  const [input, setInput] = useState('');
  const [windowsPath, setWindowsPath] = useState('');
  const [smbUri, setSmbUri] = useState('');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('smb_history');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('smb_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    const cleanInput = input.trim();
    if (!cleanInput) {
      setWindowsPath('');
      setSmbUri('');
      return;
    }

    if (cleanInput.startsWith('\\\\')) {
      setWindowsPath(cleanInput);
      const pathParts = cleanInput.substring(2).split('\\');
      const uri = 'smb://' + pathParts.map(p => encodeURIComponent(p)).join('/');
      setSmbUri(uri.replace(/\/+$/, ''));
    } 
    else if (cleanInput.toLowerCase().startsWith('smb://')) {
      setSmbUri(cleanInput);
      try {
        const url = new URL(cleanInput.replace(/^smb:/i, 'http:'));
        let winPath = '\\\\' + url.hostname;
        const pathname = decodeURIComponent(url.pathname);
        if (pathname && pathname !== '/') {
          winPath += pathname.replace(/\//g, '\\');
        }
        setWindowsPath(winPath);
      } catch (e) {
        const parts = cleanInput.substring(6).split('/');
        setWindowsPath('\\\\' + parts.join('\\'));
      }
    } else {
      setWindowsPath('');
      setSmbUri('');
    }
  }, [input]);

  const addToHistory = (win: string, uri: string) => {
    if (!win || !uri) return;
    
    setHistory(prev => {
      const existingIndex = prev.findIndex(item => item.win === win && item.uri === uri);
      const now = Date.now();
      
      if (existingIndex > -1) {
        const newHistory = [...prev];
        newHistory[existingIndex] = {
          ...newHistory[existingIndex],
          copyCount: newHistory[existingIndex].copyCount + 1,
          lastCopiedAt: now
        };
        return newHistory;
      } else {
        return [{
          id: Math.random().toString(36).substr(2, 9),
          win,
          uri,
          copyCount: 1,
          lastCopiedAt: now,
          isPinned: false,
          isFavorite: false
        }, ...prev];
      }
    });
  };

  const togglePin = (id: string) => {
    setHistory(prev => prev.map(item => 
      item.id === id ? { ...item, isPinned: !item.isPinned } : item
    ));
  };

  const toggleFavorite = (id: string) => {
    setHistory(prev => prev.map(item => 
      item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
    ));
  };

  const copyToClipboard = (text: string, type: string, win?: string, uri?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedType(type);
      if (win && uri) {
        addToHistory(win, uri);
      }
      setTimeout(() => setCopiedType(null), 2000);
    });
  };

  const displayHistory = useMemo(() => {
    if (history.length === 0) return [];
    
    const filtered = history.filter(item => 
      item.win.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.uri.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (filtered.length === 0) return [];

    // Sorting logic:
    // 1. Pinned items first (sorted by lastCopiedAt among themselves)
    // 2. Then others (sorted by copyCount)
    
    const pinned = filtered
      .filter(item => item.isPinned)
      .sort((a, b) => b.lastCopiedAt - a.lastCopiedAt);
      
    const unpinnedItems = filtered.filter(item => !item.isPinned);
    if (unpinnedItems.length > 0) {
      const latestUnpinnedAt = Math.max(...unpinnedItems.map(i => i.lastCopiedAt));
      unpinnedItems.sort((a, b) => {
        if (a.lastCopiedAt === latestUnpinnedAt) return -1;
        if (b.lastCopiedAt === latestUnpinnedAt) return 1;
        return b.copyCount - a.copyCount;
      });
    }

    return [...pinned, ...unpinnedItems];
  }, [history, searchQuery]);

  const absoluteLatestAt = useMemo(() => {
    if (history.length === 0) return 0;
    return Math.max(...history.map(i => i.lastCopiedAt));
  }, [history]);

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const clearHistory = () => {
    const itemsToKeep = history.filter(item => item.isPinned || item.isFavorite);
    setHistory(itemsToKeep);
    setShowClearConfirm(false);
  };

  const regularItemsCount = history.length - history.filter(item => item.isPinned || item.isFavorite).length;

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4 pb-20">
      {/* Input Section */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-[var(--accent-color)]/20 to-transparent rounded-[32px] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[28px] p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
              <Server className="w-4 h-4" />
              输入 SMB 路径
            </label>
            {input && (
              <button 
                onClick={() => setInput('')}
                className="p-2 hover:bg-[var(--hover-color)] rounded-full text-[var(--text-secondary)] transition-colors"
                title="清空"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full h-32 p-4 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-2xl font-mono text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)]/30 outline-none transition-all resize-none placeholder:text-[var(--text-secondary)]/50"
            placeholder="例如: \\192.168.1.1\share 或 smb://192.168.1.1/share"
          />
        </div>
      </div>

      {/* Result Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`p-6 rounded-[28px] border transition-all duration-500 ${windowsPath ? 'bg-[var(--bg-surface)] border-[var(--border-color)] shadow-lg' : 'bg-[var(--bg-surface)]/30 border-dashed border-[var(--border-color)] opacity-50'}`}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest">Windows 格式</span>
            {windowsPath && (
              <button
                onClick={() => copyToClipboard(windowsPath, 'win-main', windowsPath, smbUri)}
                className="p-2 hover:bg-[var(--hover-color)] rounded-xl text-[var(--text-secondary)] transition-all"
              >
                {copiedType === 'win-main' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
          </div>
          <div className="min-h-[60px] flex items-center">
            <code className="block w-full p-3 bg-[var(--bg-input)] rounded-xl font-mono text-sm break-all text-[var(--text-primary)]">
              {windowsPath || '等待输入...'}
            </code>
          </div>
        </div>

        <div className={`p-6 rounded-[28px] border transition-all duration-500 ${smbUri ? 'bg-[var(--bg-surface)] border-[var(--border-color)] shadow-lg' : 'bg-[var(--bg-surface)]/30 border-dashed border-[var(--border-color)] opacity-50'}`}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest">URI 格式 (macOS/Linux)</span>
            {smbUri && (
              <button
                onClick={() => copyToClipboard(smbUri, 'uri-main', windowsPath, smbUri)}
                className="p-2 hover:bg-[var(--hover-color)] rounded-xl text-[var(--text-secondary)] transition-all"
              >
                {copiedType === 'uri-main' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
          </div>
          <div className="min-h-[60px] flex items-center">
            <code className="block w-full p-3 bg-[var(--bg-input)] rounded-xl font-mono text-sm break-all text-[var(--text-primary)]">
              {smbUri || '等待输入...'}
            </code>
          </div>
        </div>
      </div>

      {/* History Section */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[var(--text-primary)]">
            <History className="w-5 h-5 text-[var(--accent-color)]" />
            <h3 className="font-bold text-lg">历史记录</h3>
            <span className="text-xs px-2 py-0.5 bg-[var(--hover-color)] rounded-full text-[var(--text-secondary)]">
              {history.length}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索记录..."
                className="w-full pl-9 pr-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-full text-sm outline-none focus:ring-2 focus:ring-[var(--accent-color)]/20 transition-all"
              />
            </div>
            {history.length > 0 && (
              <div className="relative">
                {showClearConfirm ? (
                  <div className="absolute right-0 bottom-full mb-2 w-48 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-3 shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2">
                    <p className="text-xs text-[var(--text-primary)] mb-3">确定清空 {regularItemsCount} 条普通记录？</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={clearHistory}
                        className="flex-1 py-1.5 bg-red-500 text-white text-[10px] font-bold rounded-lg hover:bg-red-600 transition-colors"
                      >
                        确定
                      </button>
                      <button 
                        onClick={() => setShowClearConfirm(false)}
                        className="flex-1 py-1.5 bg-[var(--hover-color)] text-[var(--text-secondary)] text-[10px] font-bold rounded-lg hover:bg-[var(--border-color)] transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : null}
                <button 
                  onClick={() => {
                    if (regularItemsCount > 0) {
                      setShowClearConfirm(true);
                    } else {
                      // No items to clear, maybe show a temporary tooltip or just do nothing
                    }
                  }}
                  className={`p-2 transition-colors rounded-full ${regularItemsCount > 0 ? 'text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10' : 'text-[var(--text-secondary)]/30 cursor-not-allowed'}`}
                  title={regularItemsCount > 0 ? "清空普通历史" : "没有可清空的普通记录"}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {displayHistory.length > 0 ? (
            displayHistory.map((item) => {
              const isLatest = item.lastCopiedAt === absoluteLatestAt && absoluteLatestAt > 0;
              
              return (
                <div 
                  key={item.id}
                  className={`group relative bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 transition-all hover:shadow-md ${item.isPinned ? 'ring-2 ring-[var(--accent-color)]/40 bg-[var(--accent-color)]/[0.02]' : isLatest ? 'ring-2 ring-[var(--accent-color)]/10' : ''}`}
                >
                  <div className="absolute -top-2.5 right-4 flex items-center gap-2">
                    {item.isPinned && (
                      <div className="px-2 py-0.5 bg-[var(--accent-color)] text-white text-[10px] font-bold rounded-full flex items-center gap-1 shadow-sm">
                        <Pin className="w-3 h-3" />
                        已置顶
                      </div>
                    )}
                    {isLatest && (
                      <div className="px-2 py-0.5 bg-[var(--text-primary)] text-white text-[10px] font-bold rounded-full flex items-center gap-1 shadow-sm">
                        <Clock className="w-3 h-3" />
                        刚复制
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    {/* Row 1: Windows */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-[var(--text-secondary)] uppercase font-bold mb-0.5">Windows</div>
                        <div className="font-mono text-xs truncate text-[var(--text-primary)]">{item.win}</div>
                      </div>
                      <button 
                        onClick={() => copyToClipboard(item.win, `win-${item.id}`, item.win, item.uri)}
                        className="p-2 bg-[var(--bg-input)] hover:bg-[var(--hover-color)] rounded-lg text-[var(--text-secondary)] transition-all"
                      >
                        {copiedType === `win-${item.id}` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* Row 2: URI */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-[var(--text-secondary)] uppercase font-bold mb-0.5">URI</div>
                        <div className="font-mono text-xs truncate text-[var(--text-primary)]">{item.uri}</div>
                      </div>
                      <button 
                        onClick={() => copyToClipboard(item.uri, `uri-${item.id}`, item.win, item.uri)}
                        className="p-2 bg-[var(--bg-input)] hover:bg-[var(--hover-color)] rounded-lg text-[var(--text-secondary)] transition-all"
                      >
                        {copiedType === `uri-${item.id}` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[var(--border-color)] flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
                    <div className="flex items-center gap-3">
                      <span>复制次数: <span className="font-bold text-[var(--text-primary)]">{item.copyCount}</span></span>
                      <span>最后复制: {new Date(item.lastCopiedAt).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => togglePin(item.id)}
                        className={`p-1.5 rounded-md transition-colors ${item.isPinned ? 'text-[var(--accent-color)] bg-[var(--accent-color)]/10' : 'hover:bg-[var(--hover-color)]'}`}
                        title={item.isPinned ? "取消置顶" : "置顶"}
                      >
                        <Pin className={`w-3.5 h-3.5 ${item.isPinned ? 'fill-current' : ''}`} />
                      </button>
                      <button 
                        onClick={() => toggleFavorite(item.id)}
                        className={`p-1.5 rounded-md transition-colors ${item.isFavorite ? 'text-yellow-500 bg-yellow-500/10' : 'hover:bg-[var(--hover-color)]'}`}
                        title={item.isFavorite ? "取消收藏" : "收藏"}
                      >
                        <Star className={`w-3.5 h-3.5 ${item.isFavorite ? 'fill-current' : ''}`} />
                      </button>
                      <button 
                        onClick={() => {
                          setHistory(prev => prev.filter(i => i.id !== item.id));
                        }}
                        className="p-1.5 rounded-md hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-[var(--text-secondary)] bg-[var(--bg-surface)]/30 border border-dashed border-[var(--border-color)] rounded-2xl">
              <History className="w-8 h-8 opacity-20 mb-2" />
              <p className="text-sm">{searchQuery ? '未找到匹配的记录' : '暂无历史记录'}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center">
        <div className="flex items-center gap-4 px-6 py-3 bg-[var(--accent-color)]/5 border border-[var(--accent-color)]/10 rounded-full text-[var(--text-secondary)] text-sm">
          <ArrowRightLeft className="w-4 h-4 text-[var(--accent-color)]" />
          <span>自动识别并双向转换</span>
        </div>
      </div>
    </div>
  );
}
