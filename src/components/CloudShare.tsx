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
  Download
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

// --- 类型定义 ---

interface FileItem {
  name: string;
  size: number;
  type: string;
  lastModified: number;
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
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
      const res = await fetch('/api/share/list');
      if (res.ok) {
        const data = await res.json();
        setShares(Array.isArray(data) ? data : []);
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

  // --- 处理文件选中 ---

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...filesArray]);
      setShareType('file');
    }
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  // --- 创建分享 ---

  const createShare = async () => {
    setIsUploading(true);
    try {
      if (shareType === 'text') {
        const res = await fetch('/api/share/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: textContent, name: shareName })
        });
        if (res.ok) resetUpload();
      } else {
        const formData = new FormData();
        selectedFiles.forEach(file => formData.append('files', file));
        formData.append('name', shareName);
        
        const res = await fetch('/api/share/files', {
          method: 'POST',
          body: formData
        });
        if (res.ok) resetUpload();
      }
    } catch (err) {
      console.error('创建分享失败:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    setTextContent('');
    setSelectedFiles([]);
    setShareName('');
    setActiveTab('list');
  };

  // --- 操作函数 ---

  const copyLink = (id: string) => {
    const link = `${window.location.origin}/s/${id}`;
    navigator.clipboard.writeText(link);
    // 这里可以添加一个 Toast 提示
  };

  const deleteShare = async (id: string) => {
    if (!confirm('确定要删除这个分享吗？')) return;
    try {
      const res = await fetch(`/api/share/${id}`, { method: 'DELETE' });
      if (res.ok) fetchShares();
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  const updateTextShare = async () => {
    if (!editingShare) return;
    try {
      const res = await fetch(`/api/share/${editingShare.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: editingShare.content, 
          name: editingShare.name 
        })
      });
      if (res.ok) {
        setEditingShare(null);
        fetchShares();
      }
    } catch (err) {
      console.error('更新失败:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* 顶部导航 */}
      <div className="flex justify-center gap-4">
        <button 
          onClick={() => setActiveTab('upload')}
          className={`px-6 py-3 rounded-xl flex items-center gap-2 transition-all ${
            activeTab === 'upload' 
            ? 'bg-[var(--accent-color)] text-white shadow-lg' 
            : 'bg-[var(--bg-main)] border border-white/10 hover:border-white/20'
          }`}
        >
          <Plus size={20} />
          <span>新建分享</span>
        </button>
        <button 
          onClick={() => setActiveTab('list')}
          className={`px-6 py-3 rounded-xl flex items-center gap-2 transition-all ${
            activeTab === 'list' 
            ? 'bg-[var(--accent-color)] text-white shadow-lg' 
            : 'bg-[var(--bg-main)] border border-white/10 hover:border-white/20'
          }`}
        >
          <List size={20} />
          <span>分享管理</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'upload' ? (
          <motion.div 
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-[var(--bg-main)] p-8 rounded-2xl border border-white/10"
          >
            {/* 文本分享区 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-white/70 font-medium">
                <FileText size={18} />
                <span>文本分享</span>
              </div>
              <textarea
                value={textContent}
                onChange={(e) => {
                  setTextContent(e.target.value);
                  setShareType('text');
                }}
                placeholder="在此输入或粘贴文本内容..."
                className="w-full h-64 bg-black/20 border border-white/10 rounded-xl p-4 resize-none focus:outline-none focus:border-[var(--accent-color)] transition-colors"
              />
            </div>

            {/* 文件分享区 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-white/70 font-medium">
                <Files size={18} />
                <span>文件/文件夹分享</span>
              </div>
              <div 
                className={`w-full h-64 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-4 transition-all ${
                  selectedFiles.length > 0 
                  ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5' 
                  : 'border-white/10 hover:border-white/20'
                }`}
              >
                {selectedFiles.length > 0 ? (
                  <div className="text-center">
                    <p className="text-xl font-bold">{selectedFiles.length} 个文件</p>
                    <p className="text-sm text-white/50">{formatSize(selectedFiles.reduce((acc, f) => acc + f.size, 0))}</p>
                    <button 
                      onClick={clearFiles}
                      className="mt-4 text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded-full hover:bg-red-500/30 transition-colors"
                    >
                      清空重选
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={40} className="text-white/20" />
                    <div className="flex gap-2">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-white/5 rounded-lg hover:bg-white/10 text-sm transition-colors"
                      >
                        选择文件
                      </button>
                      <button 
                        onClick={() => folderInputRef.current?.click()}
                        className="px-4 py-2 bg-white/5 rounded-lg hover:bg-white/10 text-sm transition-colors"
                      >
                        上传文件夹
                      </button>
                    </div>
                  </>
                )}
              </div>
              <input type="file" multiple ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              <input 
                type="file" 
                // @ts-ignore
                webkitdirectory="" 
                directory="" 
                ref={folderInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
              />
            </div>

            {/*底部操作 */}
            <div className="md:col-span-2 flex flex-col md:flex-row gap-4 items-center">
              <input 
                type="text"
                value={shareName}
                onChange={(e) => setShareName(e.target.value)}
                placeholder="给分享起个名字（可选）"
                className="flex-1 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--accent-color)]"
              />
              <button 
                onClick={createShare}
                disabled={isUploading || (shareType === 'text' ? !textContent : selectedFiles.length === 0)}
                className="w-full md:w-auto px-8 py-3 bg-[var(--accent-color)] text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUploading ? <Loader2 className="animate-spin" /> : '立即分享'}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="overflow-x-auto"
          >
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-white/50 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium">ID</th>
                  <th className="px-6 py-4 font-medium">类型</th>
                  <th className="px-6 py-4 font-medium">内容预览</th>
                  <th className="px-6 py-4 font-medium">创建时间</th>
                  <th className="px-6 py-4 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-white/30">
                      <Loader2 className="animate-spin mx-auto mb-2" />
                      正在加载分享列表...
                    </td>
                  </tr>
                ) : !Array.isArray(shares) || shares.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-white/30">
                      还没有任何分享记录
                    </td>
                  </tr>
                ) : (
                  shares.map((share) => (
                    <tr key={share.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <code className="bg-black/40 px-2 py-1 rounded text-[var(--accent-color)] font-mono">
                          {share.id}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                          share.type === 'text' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {share.type === 'text' ? '文本' : '文件'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-xs truncate text-white/70">
                          {share.type === 'text' ? (
                            share.content
                          ) : (
                            <div className="flex items-center gap-2">
                              <FolderIcon size={14} />
                              <span>{share.name || `${share.files?.length} 个文件`}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-white/40">
                        {new Date(share.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => copyLink(share.id)}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
                            title="复制链接"
                          >
                            <Copy size={18} />
                          </button>
                          {share.type === 'text' && (
                            <button 
                              onClick={() => setEditingShare(share)}
                              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
                              title="编辑"
                            >
                              <Edit3 size={18} />
                            </button>
                          )}
                          <button 
                            onClick={() => deleteShare(share.id)}
                            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-500/60 hover:text-red-500"
                            title="删除"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-2xl bg-[var(--bg-main)] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <h3 className="text-xl font-bold">编辑文本分享</h3>
                <button onClick={() => setEditingShare(null)} className="text-white/40 hover:text-white">
                  <X />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <input 
                  type="text"
                  value={editingShare.name}
                  onChange={(e) => setEditingShare({...editingShare, name: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none"
                  placeholder="名称"
                />
                <textarea
                  value={editingShare.content}
                  onChange={(e) => setEditingShare({...editingShare, content: e.target.value})}
                  className="w-full h-80 bg-white/5 border border-white/10 rounded-xl p-4 resize-none focus:outline-none"
                />
              </div>
              <div className="p-6 bg-white/5 flex justify-end gap-3">
                <button 
                  onClick={() => setEditingShare(null)}
                  className="px-6 py-2 text-white/50 hover:text-white"
                >
                  取消
                </button>
                <button 
                  onClick={updateTextShare}
                  className="px-6 py-2 bg-[var(--accent-color)] text-white rounded-xl font-bold"
                >
                  保存更改
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
