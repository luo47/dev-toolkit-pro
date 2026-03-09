import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  List, 
  FileText, 
  Files, 
  Copy, 
  Trash2, 
  Edit3, 
  Upload, 
  FolderIcon, 
  X,
  Loader2,
  ChevronRight,
  Download,
  File as FileIcon,
  FolderPlus,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye
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
  const [activeTab, setActiveTab] = useState<'upload' | 'list'>('upload');
  const [shareType, setShareType] = useState<'text' | 'file'>('text');
  
  // 上传状态
  const [textContent, setTextContent] = useState('');
  const [shareName, setShareName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragover, setIsDragover] = useState(false);
  
  // 列表状态
  const [shares, setShares] = useState<ShareContent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingShare, setEditingShare] = useState<ShareContent | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // 获取分享列表
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

  useEffect(() => {
    if (activeTab === 'list') {
      fetchShares();
    }
  }, [activeTab]);

  // --- 文件递归遍历逻辑 ---

  const traverseFileTree = async (entry: any, basePath: string, files: SelectedFile[]): Promise<void> => {
    const path = basePath ? `${basePath}/${entry.name}` : entry.name;
    
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file: File) => {
          files.push({
            name: file.name,
            size: file.size,
            path: path,
            raw: file
          });
          resolve();
        });
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const entries: any[] = await new Promise((resolve) => {
        dirReader.readEntries((results: any[]) => resolve(results));
      });
      for (const e of entries) {
        await traverseFileTree(e, path, files);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragover(false);
    
    if (!e.dataTransfer?.items) return;
    
    const files: SelectedFile[] = [];
    const items = e.dataTransfer.items;
    
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
            const entry = (item as any).webkitGetAsEntry?.();
            if (entry) {
                await traverseFileTree(entry, '', files);
            } else {
                const file = item.getAsFile();
                if (file) {
                    files.push({
                        name: file.name,
                        size: file.size,
                        path: file.name,
                        raw: file
                    });
                }
            }
        }
    }
    
    if (files.length > 0) {
        setSelectedFiles(prev => [...prev, ...files]);
        setShareType('file');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files: SelectedFile[] = [];
    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i];
      files.push({
        name: file.name,
        size: file.size,
        path: (file as any).webkitRelativePath || file.name,
        raw: file
      });
    }
    setSelectedFiles(prev => [...prev, ...files]);
    setShareType('file');
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setSelectedFiles([]);
  };

  // --- 创建分享 ---

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
            if (data.success) {
                resetUpload();
            }
        } catch (err) {
            console.error('上传失败:', err);
        } finally {
            setIsUploading(false);
        }
    } else {
        if (selectedFiles.length === 0) return;
        setIsUploading(true);
        setUploadProgress(0);

        const formData = new FormData();
        formData.append('name', shareName || selectedFiles[0].name);
        selectedFiles.forEach(file => {
            formData.append('files', file.raw, file.path);
        });

        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                setUploadProgress(Math.round((event.loaded / event.total) * 100));
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resetUpload();
            } else {
                console.error('上传失败:', xhr.responseText);
            }
            setIsUploading(false);
            setUploadProgress(0);
        };

        xhr.onerror = () => {
            console.error('网络错误');
            setIsUploading(false);
            setUploadProgress(0);
        };

        xhr.open('POST', '/api/files');
        xhr.send(formData);
    }
  };

  const resetUpload = () => {
    setTextContent('');
    setSelectedFiles([]);
    setShareName('');
    setUploadProgress(0);
    setActiveTab('list');
    fetchShares(); // 正确做法：重置后立即刷新列表
  };

  // --- 操作函数 ---

  const copyLink = (id: string) => {
    const link = `${window.location.origin}/s/${id}`;
    navigator.clipboard.writeText(link);
    // 可选：添加提示
  };

  const deleteShare = async (id: string) => {
    if (!confirm('确定要删除这个分享吗？')) return;
    try {
      const res = await fetch(`/api/shares/${id}`, { method: 'DELETE' });
      const data = await res.json() as any;
      if (data.success) fetchShares();
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  const updateTextShare = async () => {
    if (!editingShare) return;
    try {
      const res = await fetch(`/api/shares/${editingShare.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingShare.content })
      });
      const data = await res.json() as any;
      if (data.success) {
        setEditingShare(null);
        fetchShares();
      }
    } catch (err) {
      console.error('更新失败:', err);
    }
  };

  const selectedTotalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-6">
      {/* 顶部标签切换 */}
      <div className="flex bg-[var(--bg-surface)] p-1 rounded-2xl border border-[var(--border-color)] self-center w-fit mx-auto">
        <button 
          onClick={() => setActiveTab('upload')}
          className={`px-8 py-2.5 rounded-xl flex items-center gap-2 transition-all font-medium ${
            activeTab === 'upload' 
            ? 'bg-[var(--accent-color)] text-white shadow-lg' 
            : 'text-[var(--text-secondary)] hover:bg-[var(--hover-color)]'
          }`}
        >
          <Plus size={18} />
          <span>新建分享</span>
        </button>
        <button 
          onClick={() => setActiveTab('list')}
          className={`px-8 py-2.5 rounded-xl flex items-center gap-2 transition-all font-medium ${
            activeTab === 'list' 
            ? 'bg-[var(--accent-color)] text-white shadow-lg' 
            : 'text-[var(--text-secondary)] hover:bg-[var(--hover-color)]'
          }`}
        >
          <List size={18} />
          <span>分享管理</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'upload' ? (
          <motion.div 
            key="upload"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {/* 文本区域 */}
            <div className="bg-[var(--bg-surface)] p-6 rounded-[28px] border border-[var(--border-color)] flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/70 font-bold">
                    <FileText size={20} className="text-[var(--accent-color)]" />
                    <span>文本分享</span>
                </div>
                {textContent && <span className="text-[10px] text-white/30 truncate max-w-[100px]">{textContent.length} 字符</span>}
              </div>
              <textarea
                value={textContent}
                onChange={(e) => {
                  setTextContent(e.target.value);
                  setShareType('text');
                }}
                placeholder="在此粘贴代码或文本..."
                className="flex-1 w-full min-h-[300px] bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/30 transition-all text-sm font-mono leading-relaxed"
              />
            </div>

            {/* 文件区域 */}
            <div className="bg-[var(--bg-surface)] p-6 rounded-[28px] border border-[var(--border-color)] flex flex-col gap-4">
               <div className="flex items-center gap-2 text-white/70 font-bold">
                    <Files size={20} className="text-[var(--accent-color)]" />
                    <span>文件/文件夹分享</span>
                </div>
                
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragover(true); }}
                  onDragLeave={() => setIsDragover(false)}
                  onDrop={handleDrop}
                  className={`relative flex-1 min-h-[300px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 transition-all ${
                    isDragover 
                    ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5 scale-[0.99]' 
                    : 'border-[var(--border-color)] hover:border-[var(--accent-color)]/50'
                  }`}
                >
                  {selectedFiles.length > 0 ? (
                    <div className="w-full h-full flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <div className="text-left">
                                <p className="text-2xl font-bold">{selectedFiles.length} 个文件</p>
                                <p className="text-sm text-white/40">{formatSize(selectedTotalSize)}</p>
                            </div>
                            <button 
                                onClick={clearFiles}
                                className="px-4 py-1.5 bg-red-500/10 text-red-500 rounded-full text-xs font-bold hover:bg-red-500/20 transition-colors"
                            >
                                清空重选
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto max-h-[220px] pr-2 space-y-2 custom-scrollbar">
                            {selectedFiles.slice(0, 50).map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2.5 bg-[var(--bg-main)] rounded-xl border border-[var(--border-color)] text-xs group">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <FileIcon size={14} className="text-white/30 group-hover:text-[var(--accent-color)]" />
                                        <span className="truncate text-white/70 font-mono" title={file.path}>{file.path}</span>
                                    </div>
                                    <div className="flex items-center gap-3 ml-2 shrink-0">
                                        <span className="text-white/20">{formatSize(file.size)}</span>
                                        <button onClick={() => removeFile(idx)} className="text-white/20 hover:text-red-500 p-0.5">
                                            <X size={12} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {selectedFiles.length > 50 && (
                                <p className="text-center text-[10px] text-white/20 italic">还有 {selectedFiles.length - 50} 个文件未列出...</p>
                            )}
                        </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-[var(--accent-color)]/10 rounded-full flex items-center justify-center mb-4 text-[var(--accent-color)]">
                        <Upload size={32} />
                      </div>
                      <p className="text-white/60 mb-6 text-sm">拖拽文件或文件夹到此处，或者使用下方按钮</p>
                      <div className="flex gap-3">
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="px-5 py-2.5 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl hover:border-[var(--accent-color)] transition-colors text-sm flex items-center gap-2"
                        >
                          <FileIcon size={16} /> 选择文件
                        </button>
                        <button 
                          onClick={() => folderInputRef.current?.click()}
                          className="px-5 py-2.5 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl hover:border-[var(--accent-color)] transition-colors text-sm flex items-center gap-2"
                        >
                          <FolderPlus size={16} /> 选择文件夹
                        </button>
                      </div>
                    </>
                  )}
                  
                  <input type="file" multiple ref={fileInputRef} onChange={handleFileInputChange} className="hidden" />
                  <input 
                    type="file" 
                    // @ts-ignore
                    webkitdirectory="" 
                    directory="" 
                    multiple
                    ref={folderInputRef} 
                    onChange={handleFileInputChange} 
                    className="hidden" 
                  />
                </div>
            </div>

            {/* 控制栏 */}
            <div className="md:col-span-2 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <input 
                        type="text"
                        value={shareName}
                        onChange={(e) => setShareName(e.target.value)}
                        placeholder="请输入分享名称 (可选)..."
                        className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/30 transition-all shadow-sm"
                    />
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button 
                        onClick={createShare}
                        disabled={isUploading || (shareType === 'text' ? !textContent.trim() : selectedFiles.length === 0)}
                        className="flex-1 md:w-48 h-14 bg-[var(--accent-color)] text-white rounded-2xl font-bold flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg shadow-[var(--accent-color)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden"
                    >
                        {isUploading ? (
                            <>
                                <div className="absolute inset-0 bg-black/10 transition-all" style={{ width: `${uploadProgress}%` }} />
                                <Loader2 className="animate-spin" size={20} />
                                <span className="relative">{uploadProgress > 0 ? `${uploadProgress}%` : '处理中...'}</span>
                            </>
                        ) : (
                            <>
                                <span>立即创建分享</span>
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {isLoading ? (
              <div className="bg-[var(--bg-surface)] rounded-[32px] border border-[var(--border-color)] p-24 text-center">
                <Loader2 className="animate-spin mx-auto mb-4 text-[var(--accent-color)]" size={32} />
                <p className="text-[var(--text-secondary)] text-sm italic">正在同步云端数据...</p>
              </div>
            ) : !Array.isArray(shares) || shares.length === 0 ? (
              <div className="bg-[var(--bg-surface)] rounded-[32px] border border-[var(--border-color)] p-24 text-center">
                <AlertCircle className="mx-auto mb-4 text-white/10" size={48} />
                <p className="text-[var(--text-secondary)]">您的库中空空如也，快去创建一个吧</p>
              </div>
            ) : (
              shares.map((share, idx) => (
                <motion.div 
                  key={share.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group bg-[var(--bg-surface)] hover:bg-[var(--hover-color)] border border-[var(--border-color)] hover:border-[var(--accent-color)]/30 rounded-[28px] p-5 flex flex-col md:flex-row items-start md:items-center gap-6 transition-all shadow-sm hover:shadow-xl hover:shadow-[var(--accent-color)]/5 relative overflow-hidden"
                >
                  {/* 类型指示色块 (左侧装饰) */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    share.type === 'file' ? 'bg-emerald-500/30' : 'bg-blue-500/30'
                  }`} />

                  {/* ID & 类型区 */}
                  <div className="flex flex-row md:flex-col items-center md:items-start gap-3 md:gap-1.5 shrink-0">
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest whitespace-nowrap shadow-sm ${
                      share.type === 'file' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
                    }`}>
                      {share.type === 'file' ? 'Bundle' : 'Snippet'}
                    </span>
                    <code className="text-[10px] font-mono text-white/20 uppercase tracking-tighter">
                      ID: {share.id}
                    </code>
                  </div>

                  {/* 主内容区 */}
                  <div className="flex-1 flex items-center gap-5 min-w-0 w-full">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                      share.type === 'file' ? 'bg-emerald-500/5 text-emerald-500' : 'bg-blue-500/5 text-blue-500'
                    }`}>
                      {share.type === 'file' ? <Files size={24} /> : <FileText size={24} />}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-white/90 group-hover:text-white transition-colors truncate">
                        {share.type === 'file' ? (share.name || 'UNNAMED_SHARE') : 'TEXT_CONTENT_SHARE'}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 overflow-hidden">
                        {share.type === 'file' ? (
                          <span className="text-[11px] text-white/30 truncate flex items-center gap-1.5 leading-none">
                             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/20" />
                             {share.files?.length || 0} Assets · {formatSize(share.totalSize || 0)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-white/30 truncate italic font-light leading-none">
                            "{share.content?.slice(0, 100)}"
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 元数据与时间 (桌面端靠右) */}
                  <div className="hidden lg:flex flex-col items-end gap-1 shrink-0 px-4 border-l border-white/5">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-tighter flex items-center gap-1.5">
                      <History size={11} className="text-white/20" />
                      {new Date(share.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-[10px] font-mono text-white/10 uppercase italic">
                      {new Date(share.createdAt).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* 管理按钮岛 */}
                  <div className="flex items-center gap-1.5 p-1.5 bg-[var(--bg-main)]/50 rounded-2xl border border-white/5 shadow-sm self-stretch md:self-center shrink-0 transition-all group-hover:border-[var(--accent-color)]/20">
                    <button 
                      onClick={() => window.open(`/s/${share.id}`, '_blank')}
                      className="w-10 h-10 flex items-center justify-center hover:bg-emerald-500 hover:text-white rounded-xl transition-all text-white/30"
                      title="预览"
                    >
                      <Eye size={18} />
                    </button>
                    <button 
                      onClick={() => copyLink(share.id)}
                       className="w-10 h-10 flex items-center justify-center hover:bg-[var(--accent-color)] hover:text-white rounded-xl transition-all text-white/30"
                      title="复制"
                    >
                      <Copy size={18} />
                    </button>
                    {share.type === 'text' && (
                      <button 
                        onClick={() => setEditingShare(share)}
                        className="w-10 h-10 flex items-center justify-center hover:bg-blue-500 hover:text-white rounded-xl transition-all text-white/30"
                        title="编辑"
                      >
                        <Edit3 size={18} />
                      </button>
                    )}
                    <button 
                      onClick={() => deleteShare(share.id)}
                      className="w-10 h-10 flex items-center justify-center hover:bg-red-500 hover:text-white rounded-xl transition-all text-white/30"
                      title="删除"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 文本编辑弹窗 */}
      <AnimatePresence>
        {editingShare && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-4xl bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-main)]/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                        <Edit3 size={20} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold tracking-tight">编辑内容分享</h3>
                        <p className="text-[10px] text-white/20 uppercase tracking-widest font-mono">ID: {editingShare.id}</p>
                    </div>
                </div>
                <button onClick={() => setEditingShare(null)} className="p-2 hover:bg-red-500/10 rounded-full text-white/20 hover:text-red-500 transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8">
                <textarea
                  value={editingShare.content}
                  onChange={(e) => setEditingShare({...editingShare, content: e.target.value})}
                  className="w-full h-[500px] bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl p-6 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-mono text-sm leading-relaxed"
                />
              </div>
              <div className="p-8 bg-[var(--bg-main)]/30 border-t border-[var(--border-color)] flex justify-end gap-4">
                <button 
                  onClick={() => setEditingShare(null)}
                  className="px-8 py-3 text-sm font-bold text-white/40 hover:text-white transition-colors"
                >
                  放弃修改
                </button>
                <button 
                  onClick={updateTextShare}
                  className="px-10 py-3 bg-blue-500 text-white rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-500/20"
                >
                  同步至云端
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CloudShare;
