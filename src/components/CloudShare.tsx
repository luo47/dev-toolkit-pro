import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  FileText, 
  Files, 
  Copy, 
  Trash2, 
  Edit3, 
  Upload, 
  X,
  Loader2,
  Download,
  File as FileIcon,
  FolderPlus,
  ArrowRight,
  AlertCircle,
  Eye,
  History,
  FolderIcon,
  Search
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

// --- 类型定义 ---

interface FileItem {
  key: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
}

interface ShareContent {
  id: string;
  type: 'text' | 'file';
  content?: string;
  files?: FileItem[];
  totalSize?: number;
  name?: string;
  createdAt: string;
  updatedAt: string;
}

interface SelectedFile {
  name: string;
  size: number;
  path: string;
  raw: File;
}

// --- 工具函数 ---

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const CloudShare: React.FC = () => {
  const { user } = useAuth();
  const [shares, setShares] = useState<ShareContent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [editingShare, setEditingShare] = useState<ShareContent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. 获取列表 (首屏默认执行)
  useEffect(() => {
    fetchShares();
  }, [user]);

  const fetchShares = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/shares?_t=${Date.now()}`);
      const json = await res.json() as any;
      if (json.success) {
        setShares(json.data || []);
      }
    } catch (err) {
      console.error('获取分享列表失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const copyLink = (id: string) => {
    const link = `${window.location.origin}/s/${id}`;
    navigator.clipboard.writeText(link);
  };

  const deleteShare = async (id: string) => {
    if (!confirm('确定要彻底删除该分享吗？该操作不可撤销。')) return;
    try {
      const res = await fetch(`/api/shares/${id}`, { method: 'DELETE' });
      const data = await res.json() as any;
      if (data.success) fetchShares();
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  const filteredShares = shares.filter(s => 
    s.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (s.content && s.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="w-full max-w-[1400px] mx-auto min-h-[800px] pb-24 px-4 sm:px-6 lg:px-8 space-y-8">
      
      {/* 顶部工具栏 - 高度集成增删查 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter text-white/90 flex items-center gap-4">
            <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">云分享控制台</span>
          </h1>
          <p className="text-white/30 text-xs mt-2 font-mono uppercase tracking-widest">在这里高效管理您的所有云端分享资产</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* 搜索框 */}
          <div className="relative group flex-1 sm:flex-none sm:min-w-[300px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="快速检索分享内容 or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-white/10"
            />
          </div>

          <div className="h-8 w-px bg-white/5 hidden sm:block" />

          {/* 新建按钮组 */}
          <button 
            onClick={() => setShowUploadModal(true)}
            className="w-12 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold flex items-center justify-center shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
            title="创建新分享"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      {/* 主列表区域 */}
      <div className="space-y-4">
        {isLoading && shares.length === 0 ? (
          <div className="bg-white/5 rounded-[32px] border border-white/5 p-32 text-center animate-pulse">
            <Loader2 className="animate-spin mx-auto mb-4 text-blue-500" size={32} />
            <p className="text-white/20 text-sm italic font-mono uppercase tracking-widest">正在同步数据...</p>
          </div>
        ) : filteredShares.length === 0 ? (
          <div className="bg-white/5 rounded-[32px] border border-white/5 p-32 text-center">
            <AlertCircle className="mx-auto mb-4 text-white/10" size={48} />
            <p className="text-white/30 font-medium">未找到匹配的分享项</p>
            <button onClick={() => setSearchQuery('')} className="mt-4 text-blue-500 text-sm underline">清除搜索</button>
          </div>
        ) : (
          filteredShares.map((share, idx) => (
            <motion.div 
              key={share.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="group bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-blue-500/30 rounded-[28px] p-6 flex flex-col md:flex-row items-center gap-8 transition-all relative overflow-hidden"
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${share.type === 'file' ? 'bg-emerald-500/50' : 'bg-blue-500/50'}`} />

              {/* 信息概览 */}
              <div className="flex items-center gap-6 flex-1 min-w-0 w-full">
                <div className={`w-16 h-16 rounded-[22px] flex items-center justify-center shrink-0 ${share.type === 'file' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                  {share.type === 'file' ? <Files size={28} /> : <FileText size={28} />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${share.type === 'file' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                      {share.type === 'file' ? '多文件' : '纯文本'}
                    </span>
                    <code className="text-[10px] font-mono text-white/20 tracking-widest uppercase">ID: {share.id}</code>
                  </div>
                  <h3 className="text-lg font-bold text-white/90 truncate group-hover:text-white">
                    {share.type === 'file' ? (share.name || '未命名资产包') : (share.content?.slice(0, 40) || '文本片段')}
                  </h3>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-[11px] text-white/20 flex items-center gap-1.5">
                      <History size={12} />
                      {new Date(share.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {share.type === 'file' && (
                      <span className="text-[11px] text-emerald-500/40 uppercase font-black flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-emerald-500/40" />
                        {share.files?.length} 个文件 · {formatSize(share.totalSize || 0)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 操作区 */}
              <div className="flex items-center gap-2 p-1.5 bg-black/40 rounded-2xl border border-white/5 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                <button 
                  onClick={() => window.open(`/s/${share.id}`, '_blank')}
                  className="w-12 h-12 flex items-center justify-center hover:bg-emerald-500 hover:text-white rounded-xl transition-all text-white/20"
                  title="立即预览"
                >
                  <Eye size={20} />
                </button>
                <button 
                  onClick={() => copyLink(share.id)}
                  className="w-12 h-12 flex items-center justify-center hover:bg-white hover:text-black rounded-xl transition-all text-white/20"
                  title="复制链接"
                >
                  <Copy size={20} />
                </button>
                {share.type === 'text' && (
                  <button 
                    onClick={() => setEditingShare(share)}
                    className="w-12 h-12 flex items-center justify-center hover:bg-blue-500 hover:text-white rounded-xl transition-all text-white/20"
                    title="编辑"
                  >
                    <Edit3 size={20} />
                  </button>
                )}
                <div className="w-px h-6 bg-white/5 mx-1" />
                <button 
                  onClick={() => deleteShare(share.id)}
                  className="w-12 h-12 flex items-center justify-center hover:bg-red-500 hover:text-white rounded-xl transition-all text-white/20"
                  title="删除"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* 上传模态框 */}
      <AnimatePresence>
        {showUploadModal && (
          <UploadModal 
            onClose={() => setShowUploadModal(false)} 
            onSuccess={() => {
              setShowUploadModal(false);
              fetchShares();
            }}
          />
        )}
      </AnimatePresence>

      {/* 编辑模态框 */}
      <AnimatePresence>
        {editingShare && (
          <EditModal 
            share={editingShare}
            onClose={() => setEditingShare(null)}
            onSuccess={() => {
              setEditingShare(null);
              fetchShares();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- 子组件: 上传模态框 ---

const UploadModal: React.FC<{ onClose: () => void, onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const [shareType, setShareType] = useState<'text' | 'file'>('text');
  const [textContent, setTextContent] = useState('');
  const [shareName, setShareName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragover, setIsDragover] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    const mapped: SelectedFile[] = files.map(f => ({
      name: f.name,
      size: f.size,
      path: (f as any).webkitRelativePath || f.name,
      raw: f
    }));
    setSelectedFiles(prev => [...prev, ...mapped]);
    setShareType('file');
  };

  const createShare = async () => {
    if (shareType === 'text') {
      if (!textContent.trim()) return;
      setIsUploading(true);
      try {
        const res = await fetch('/api/shares', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: textContent })
        });
        const data = await res.json() as any;
        if (data.success) onSuccess();
      } catch (err) {
        console.error(err);
      } finally {
        setIsUploading(false);
      }
    } else {
      if (selectedFiles.length === 0) return;
      setIsUploading(true);
      const formData = new FormData();
      formData.append('name', shareName || selectedFiles[0].name);
      selectedFiles.forEach(file => formData.append('files', file.raw, file.path));

      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) onSuccess();
        setIsUploading(false);
      };
      xhr.open('POST', '/api/files');
      xhr.send(formData);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-[#111] border border-white/10 w-full max-w-[800px] rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${shareType === 'text' ? 'bg-blue-500/10 text-blue-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
              <Plus size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">创建新分享</h2>
              <div className="flex gap-4 mt-1">
                <button onClick={() => setShareType('text')} className={`text-xs font-bold uppercase transition-colors ${shareType === 'text' ? 'text-blue-500' : 'text-white/20'}`}>纯文本</button>
                <button onClick={() => setShareType('file')} className={`text-xs font-bold uppercase transition-colors ${shareType === 'file' ? 'text-emerald-500' : 'text-white/20'}`}>文件夹/文件</button>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-full transition-colors text-white/20"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
          {shareType === 'text' ? (
            <textarea 
              autoFocus
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="粘贴您的文本或代码..."
              className="w-full h-[300px] bg-black/40 border border-white/5 rounded-2xl p-6 text-sm font-mono focus:outline-none focus:border-blue-500/50 transition-all resize-none shadow-inner"
            />
          ) : (
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragover(true); }}
              onDragLeave={() => setIsDragover(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragover(false); /* DROP 逻辑 */ }}
              className={`min-h-[300px] border-2 border-dashed rounded-[32px] flex flex-col items-center justify-center p-8 transition-all ${isDragover ? 'border-emerald-500 bg-emerald-500/5' : 'border-white/5 hover:border-white/10'}`}
            >
              {selectedFiles.length > 0 ? (
                <div className="w-full">
                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <p className="text-3xl font-black italic">{selectedFiles.length < 10 ? `0${selectedFiles.length}` : selectedFiles.length}</p>
                      <p className="text-[10px] uppercase font-bold text-white/20 tracking-widest">已选资产</p>
                    </div>
                    <button onClick={() => setSelectedFiles([])} className="text-xs font-bold text-red-500 underline">清除</button>
                  </div>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                    {selectedFiles.map((f, i) => (
                      <div key={i} className="flex justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl text-xs font-mono">
                        <span className="truncate text-white/40">{f.path}</span>
                        <span className="text-white/10 ml-4">{formatSize(f.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="text-white/10 mb-4" size={48} />
                  <p className="text-white/20 text-sm mb-6">释放资产以进行云同步</p>
                  <div className="flex gap-4">
                    <button onClick={() => fileInputRef.current?.click()} className="h-12 px-6 bg-white/5 border border-white/5 rounded-xl text-sm font-bold hover:bg-white/10 transition-all">选择文件</button>
                    <button onClick={() => folderInputRef.current?.click()} className="h-12 px-6 bg-white/5 border border-white/5 rounded-xl text-sm font-bold hover:bg-white/10 transition-all">选择文件夹</button>
                  </div>
                </>
              )}
              <input type="file" multiple ref={fileInputRef} onChange={handleFileInputChange} className="hidden" />
              <input type="file" 
                // @ts-ignore
                webkitdirectory="" directory="" multiple ref={folderInputRef} onChange={handleFileInputChange} className="hidden" />
            </div>
          )}

          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-white/20 tracking-widest ml-1">分享名称 (可选)</span>
            <input 
              type="text"
              placeholder="给本次分享取个名字..."
              value={shareName}
              onChange={(e) => setShareName(e.target.value)}
              className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl px-5 text-sm focus:outline-none focus:border-white/20"
            />
          </div>
        </div>

        <div className="p-8 bg-white/[0.02] border-t border-white/5">
          <button 
            disabled={isUploading || (shareType === 'text' ? !textContent.trim() : selectedFiles.length === 0)}
            onClick={createShare}
            className={`w-full h-16 rounded-[22px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all relative overflow-hidden ${isUploading ? 'bg-white/10 text-white/40' : 'bg-white text-black hover:scale-[1.02] active:scale-95 shadow-xl'}`}
          >
             {isUploading ? (
               <>
                 <div className="absolute inset-0 bg-blue-500/20 origin-left transition-all" style={{ width: `${uploadProgress}%` }} />
                 <Loader2 className="animate-spin" size={24} />
                 <span className="relative z-10">{uploadProgress}% 正在同步</span>
               </>
             ) : (
               <>
                 <span>开始创建分享</span>
                 <ArrowRight size={20} />
               </>
             )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// --- 子组件: 编辑模态框 ---

const EditModal: React.FC<{ share: ShareContent, onClose: () => void, onSuccess: () => void }> = ({ share, onClose, onSuccess }) => {
  const [content, setContent] = useState(share.content || '');
  const [isLoading, setIsLoading] = useState(false);

  const save = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/shares/${share.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = await res.json() as any;
      if (data.success) onSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/90 backdrop-blur-3xl">
      <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-[#0a0a0a] border border-white/10 w-full max-w-[900px] rounded-[40px] overflow-hidden">
        <div className="p-8 flex justify-between items-center border-b border-white/5">
          <h2 className="text-xl font-bold flex items-center gap-3">
            <Edit3 className="text-blue-500" size={20} />
            <span>编辑内容</span>
            <code className="text-xs font-light text-white/20 font-mono ml-2">ID: {share.id}</code>
          </h2>
          <button onClick={onClose} className="p-3 text-white/20 hover:text-white"><X size={24} /></button>
        </div>
        <div className="p-8">
          <textarea 
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-[450px] bg-black border border-white/10 rounded-2xl p-6 font-mono text-sm leading-relaxed focus:outline-none focus:border-blue-500/40"
          />
        </div>
        <div className="p-8 bg-white/[0.02] flex justify-end gap-4">
          <button onClick={onClose} className="px-8 py-4 text-white/40 font-bold">取消</button>
          <button onClick={save} disabled={isLoading} className="px-10 py-4 bg-blue-600 rounded-2xl font-bold shadow-lg shadow-blue-600/20 flex items-center gap-2">
            {isLoading && <Loader2 className="animate-spin" size={18} />}
            <span>{isLoading ? '正在保存...' : '完成修改'}</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CloudShare;
