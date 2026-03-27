import React, { useState, useEffect, useRef } from 'react';
import { Search, Settings, Plus, X, GripVertical, Trash2, Edit2, Check } from 'lucide-react';
import { useAppStore } from '../store';

export interface SearchEngine {
  id: string;
  name: string;
  icon?: string;
  url_template: string;
  is_visible: boolean;
  sort_order: number;
}

const DEFAULT_ENGINES: SearchEngine[] = [
  { id: 'sys_google', name: 'Google', url_template: 'https://www.google.com/search?q=%s', is_visible: true, sort_order: 0, icon: 'https://www.google.com/favicon.ico' },
  { id: 'sys_bing', name: 'Bing', url_template: 'https://www.bing.com/search?q=%s', is_visible: true, sort_order: 1, icon: 'https://www.bing.com/sa/simg/favicon-2x.ico' },
  { id: 'sys_github', name: 'GitHub', url_template: 'https://github.com/search?q=%s', is_visible: true, sort_order: 2, icon: 'https://github.com/favicon.ico' },
  { id: 'sys_scoop', name: 'Scoop', url_template: 'https://scoop.sh/#/apps?q=%s', is_visible: true, sort_order: 3, icon: 'https://scoop.sh/favicon.ico' },
];

export default function SearchBox() {
  const { user } = useAppStore();
  const [engines, setEngines] = useState<SearchEngine[]>([]);
  const [selectedEngineId, setSelectedEngineId] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [isSettingOpen, setIsSettingOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // 获取引擎列表
  useEffect(() => {
    const fetchEngines = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/search_engines');
        if (res.ok) {
          const data: any = await res.json();
          if (data.success && data.data && data.data.length > 0) {
            setEngines(data.data);
            setSelectedEngineId(data.data.find((e: any) => e.is_visible)?.id || data.data[0].id);
          } else {
            // 没有数据则使用默认
            setEngines(DEFAULT_ENGINES);
            setSelectedEngineId(DEFAULT_ENGINES[0].id);
          }
        } else {
          setEngines(DEFAULT_ENGINES);
          setSelectedEngineId(DEFAULT_ENGINES[0].id);
        }
      } catch (e) {
        console.error(e);
        setEngines(DEFAULT_ENGINES);
        setSelectedEngineId(DEFAULT_ENGINES[0].id);
      } finally {
        setLoading(false);
      }
    };
    fetchEngines();
  }, [user]); // 登录状态改变时重新拉取

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    const engine = engines.find(e => e.id === selectedEngineId);
    if (engine) {
      const url = engine.url_template.replace('%s', encodeURIComponent(keyword));
      window.open(url, '_blank');
    }
  };

  const visibleEngines = engines.filter(e => e.is_visible).sort((a, b) => a.sort_order - b.sort_order);
  const currentEngine = visibleEngines.find(e => e.id === selectedEngineId) || visibleEngines[0];

  return (
    <div className="w-full max-w-3xl mx-auto mb-10">
      <form onSubmit={handleSearch} className="relative flex items-center bg-[var(--bg-surface)] rounded-full border border-[var(--border-color)] p-2 shadow-lg transition-shadow hover:shadow-xl hover:border-[var(--text-secondary)] focus-within:border-[var(--accent-color)] focus-within:ring-2 focus-within:ring-[var(--accent-color)]/20 z-10">
        <div className="relative flex items-center justify-center w-12 h-10 shrink-0 group ml-1">
          {currentEngine?.icon ? (
            <img 
              src={currentEngine.icon} 
              alt={currentEngine.name} 
              className="w-5 h-5 transition-transform group-hover:scale-110 pointer-events-none object-contain" 
              onError={(e) => { e.currentTarget.style.display = 'none'; }} 
            />
          ) : (
            <Search className="w-5 h-5 text-[var(--accent-color)] transition-transform group-hover:scale-110 pointer-events-none" />
          )}
          <select
            value={selectedEngineId}
            onChange={(e) => setSelectedEngineId(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
            title={`当前搜索引擎: ${currentEngine?.name || '搜索'}`}
          >
            {visibleEngines.map(e => (
              <option key={e.id} value={e.id} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                {e.name}
              </option>
            ))}
          </select>
        </div>

        <div className="w-[1px] h-6 bg-[var(--border-color)] mx-2"></div>

        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索互联网..."
          className="flex-1 bg-transparent border-none outline-none px-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
        />

        {keyword && (
          <button type="button" onClick={() => setKeyword('')} className="p-1.5 text-[var(--text-secondary)] hover:bg-[var(--hover-color)] rounded-full mr-1">
            <X className="w-4 h-4" />
          </button>
        )}

        <button 
          type="submit" 
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-r from-[var(--accent-color)] to-[var(--accent-color)]/80 text-white hover:opacity-90 transition-all hover:scale-105 shadow-md active:scale-95 shrink-0"
          title="点击搜索"
        >
          <Search className="w-5 h-5" />
        </button>
        
        <button
          type="button"
          onClick={() => setIsSettingOpen(true)}
          className="ml-2 p-2 rounded-full text-[var(--text-secondary)] hover:bg-[var(--hover-color)] hover:text-[var(--text-primary)] transition-colors"
          title="搜索引擎配置"
        >
          <Settings className="w-5 h-5" />
        </button>
      </form>

      {/* 搜索设置 Modal */}
      {isSettingOpen && (
        <SearchEngineSettingsModal
          engines={engines}
          onClose={() => setIsSettingOpen(false)}
          onSave={async (newEngines) => {
            setEngines(newEngines);
            setIsSettingOpen(false);
            if (!newEngines.find(e => e.id === selectedEngineId && e.is_visible)) {
               setSelectedEngineId(newEngines.find(e => e.is_visible)?.id || '');
            }
            if (!user) {
              window.showToast?.('请登录后保存配置，数据目前仅保存在当前会话', 'error');
              return;
            }
            try {
              const res = await fetch('/api/search_engines/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ engines: newEngines })
              });
              if (!res.ok) throw new Error('保存失败');
              window.showToast?.('设置已保存', 'success');
            } catch(e) {
              console.error(e);
              window.showToast?.('保存出错', 'error');
            }
          }}
        />
      )}
    </div>
  );
}

// 设置弹窗组件
function SearchEngineSettingsModal({ engines, onClose, onSave }: { engines: SearchEngine[], onClose: () => void, onSave: (engines: SearchEngine[]) => void }) {
  const [list, setList] = useState<SearchEngine[]>(JSON.parse(JSON.stringify(engines)));
  const [editingId, setEditingId] = useState<string|null>(null);

  const moveItem = (index: number, direction: -1 | 1) => {
    if (index + direction < 0 || index + direction >= list.length) return;
    const newList = [...list];
    const temp = newList[index];
    newList[index] = newList[index + direction];
    newList[index + direction] = temp;
    // 重置 sort_order
    newList.forEach((item, i) => item.sort_order = i);
    setList(newList);
  };

  const toggleVisible = (id: string, currentVisible: boolean) => {
    setList(list.map(l => l.id === id ? { ...l, is_visible: !currentVisible } : l));
  };

  const deleteItem = (id: string) => {
    setList(list.filter(l => l.id !== id));
  };

  const updateItem = (id: string, updates: Partial<SearchEngine>) => {
    setList(list.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const addItem = () => {
    const newId = 'custom_' + Date.now().toString();
    setList([...list, {
      id: newId,
      name: '新搜索引擎',
      url_template: 'https://example.com/search?q=%s',
      is_visible: true,
      sort_order: list.length
    }]);
    setEditingId(newId);
  };

  const handleSave = () => {
    onSave(list.map((item, index) => ({ ...item, sort_order: index })));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-main)] w-full max-w-2xl max-h-[80vh] flex flex-col rounded-[24px] border border-[var(--border-color)] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
          <h2 className="text-xl font-bold">配置搜索引擎</h2>
          <button onClick={onClose} className="p-2 hover:bg-[var(--hover-color)] rounded-full text-[var(--text-secondary)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {list.sort((a,b)=>a.sort_order - b.sort_order).map((item, index) => (
            <div key={item.id} className="flex flex-col p-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)]">
              {editingId === item.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={item.name}
                    onChange={e => updateItem(item.id, { name: e.target.value })}
                    placeholder="引擎名称"
                    className="w-full bg-[var(--bg-main)] px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm"
                  />
                  <input
                    type="text"
                    value={item.url_template}
                    onChange={e => updateItem(item.id, { url_template: e.target.value })}
                    placeholder="搜索 URL (使用 %s 作为关键词占位符)"
                    className="w-full bg-[var(--bg-main)] px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm font-mono"
                  />
                  <div className="flex justify-end pt-2">
                    <button onClick={() => setEditingId(null)} className="px-4 py-1.5 bg-[var(--accent-color)] text-white rounded-lg text-sm flex items-center gap-1">
                      <Check className="w-4 h-4" /> 完成
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col text-[var(--text-secondary)]">
                    <button onClick={() => moveItem(index, -1)} disabled={index === 0} className="hover:text-[var(--text-primary)] disabled:opacity-30">▲</button>
                    <button onClick={() => moveItem(index, 1)} disabled={index === list.length - 1} className="hover:text-[var(--text-primary)] disabled:opacity-30">▼</button>
                  </div>
                  
                  {item.icon ? (
                    <img src={item.icon} className="w-5 h-5" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <div className="w-5 h-5 bg-[var(--border-color)] rounded-full flex items-center justify-center text-[10px]">{item.name[0]}</div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[var(--text-primary)]">{item.name}</div>
                    <div className="text-xs text-[var(--text-secondary)] truncate font-mono">{item.url_template}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex items-center cursor-pointer">
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={item.is_visible} onChange={() => toggleVisible(item.id, item.is_visible)} />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${item.is_visible ? 'bg-[var(--accent-color)]' : 'bg-[var(--border-color)]'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${item.is_visible ? 'translate-x-4' : ''}`}></div>
                      </div>
                      <span className="ml-2 text-xs text-[var(--text-secondary)]">{item.is_visible ? '显示' : '隐藏'}</span>
                    </label>

                    <button onClick={() => setEditingId(item.id)} className="p-1.5 text-[var(--text-secondary)] hover:bg-[var(--hover-color)] hover:text-[var(--text-primary)] rounded">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    
                    <button onClick={() => deleteItem(item.id)} className="p-1.5 text-red-500/70 hover:bg-red-500/10 hover:text-red-500 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          <button onClick={addItem} className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] hover:bg-[var(--hover-color)] transition-all rounded-xl border-dashed">
            <Plus className="w-5 h-5" />
            <span className="font-medium text-sm">添加自定义搜索引擎</span>
          </button>
        </div>

        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-surface)] flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 rounded-xl text-sm font-bold text-[var(--text-secondary)] hover:bg-[var(--hover-color)]">
            取消
          </button>
          <button onClick={handleSave} className="px-5 py-2 rounded-xl text-sm font-bold bg-[var(--accent-color)] text-white hover:brightness-110 shadow-lg shadow-[var(--accent-color)]/20">
            保存配置
          </button>
        </div>
      </div>
    </div>
  );
}
