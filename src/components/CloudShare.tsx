import React, { useState, useEffect } from 'react';
import { Upload, FileText, Link, Copy, Trash2, Download, Eye, Clock, Plus, X, File, Folder } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

export default function CloudShare() {
  const [activeTab, setActiveTab] = useState<'upload' | 'list'>('upload');
  const [shareType, setShareType] = useState<'text' | 'file'>('text');
  const [textContent, setTextContent] = useState('');
  const [shareName, setShareName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [shares, setShares] = useState<ShareContent[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (activeTab === 'list') {
      fetchShares();
    }
  }, [activeTab]);

  const fetchShares = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/share/list');
      const data = await res.json() as { success: boolean, data: ShareContent[] };
      if (data.success) {
        setShares(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch shares', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const createTextShare = async () => {
    if (!textContent.trim()) return;
    setUploading(true);
    try {
      const res = await fetch('/api/share/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: textContent, name: shareName }),
      });
      const data = await res.json() as { success: boolean, data: ShareContent };
      if (data.success) {
        setMessage({ type: 'success', text: `分享成功！ID: ${data.data.id}` });
        setTextContent('');
        setShareName('');
        setActiveTab('list');
      }
    } catch (e) {
      setMessage({ type: 'error', text: '分享失败' });
    } finally {
      setUploading(false);
    }
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach(file => formData.append('files', file));
      formData.append('name', shareName);

      const res = await fetch('/api/share/files', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json() as { success: boolean, data: ShareContent, error?: string };
      if (data.success) {
        setMessage({ type: 'success', text: `上传成功！ID: ${data.data.id}` });
        setSelectedFiles([]);
        setShareName('');
        setActiveTab('list');
      } else {
        setMessage({ type: 'error', text: data.error || '上传失败' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: '网络请求失败' });
    } finally {
      setUploading(false);
    }
  };

  const deleteShare = async (id: string) => {
    if (!confirm('确定删除此分享吗？')) return;
    try {
      const res = await fetch(`/api/share/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setShares(shares.filter(s => s.id !== id));
      }
    } catch (e) {
      alert('删除失败');
    }
  };

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/s/${id}`;
    navigator.clipboard.writeText(url);
    alert('链接已复制到剪贴板');
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-6 py-2 rounded-full font-medium transition-all ${activeTab === 'upload' ? 'bg-[var(--accent-color)] text-white' : 'bg-[var(--hover-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
        >
          新建分享
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`px-6 py-2 rounded-full font-medium transition-all ${activeTab === 'list' ? 'bg-[var(--accent-color)] text-white' : 'bg-[var(--hover-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
        >
          管理记录
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'upload' ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 space-y-6"
          >
            <div className="flex gap-4 p-1 bg-[var(--bg-main)] rounded-2xl w-fit">
              <button
                onClick={() => setShareType('text')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${shareType === 'text' ? 'bg-[var(--bg-surface)] text-[var(--accent-color)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
              >
                <FileText className="w-4 h-4" /> 文本分享
              </button>
              <button
                onClick={() => setShareType('file')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${shareType === 'file' ? 'bg-[var(--bg-surface)] text-[var(--accent-color)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
              >
                <Upload className="w-4 h-4" /> 文件分享
              </button>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="分享名称 (可选)"
                value={shareName}
                onChange={e => setShareName(e.target.value)}
                className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--accent-color)]/30"
              />

              {shareType === 'text' ? (
                <textarea
                  placeholder="在此输入要分享的文本内容..."
                  value={textContent}
                  onChange={e => setTextContent(e.target.value)}
                  className="w-full h-64 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-[var(--accent-color)]/30 resize-none font-mono text-sm"
                />
              ) : (
                <div 
                  className="w-full h-64 border-2 border-dashed border-[var(--border-color)] rounded-2xl flex flex-col items-center justify-center gap-4 hover:border-[var(--accent-color)] transition-colors cursor-pointer relative group"
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <input
                    id="file-input"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {selectedFiles.length > 0 ? (
                    <div className="text-center p-4 overflow-y-auto max-h-full">
                      <div className="flex flex-wrap gap-2 justify-center">
                        {selectedFiles.map((f, i) => (
                          <div key={i} className="px-3 py-1 bg-[var(--hover-color)] rounded-lg text-xs flex items-center gap-2">
                            <File className="w-3 h-3" /> {f.name}
                          </div>
                        ))}
                      </div>
                      <p className="mt-4 text-sm text-[var(--accent-color)] font-bold">
                        已选择 {selectedFiles.length} 个文件，共 {formatSize(selectedFiles.reduce((s, f) => s + f.size, 0))}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">点击重新选择</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-[var(--accent-color)]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8 text-[var(--accent-color)]" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium">点击或拖拽文件到此处</p>
                        <p className="text-sm text-[var(--text-secondary)]">支持多文件上传，总大小不超过 100MB</p>
                      </div>
                    </>
                  )}
                </div>
              )}

              <button
                disabled={uploading || (shareType === 'text' ? !textContent.trim() : selectedFiles.length === 0)}
                onClick={shareType === 'text' ? createTextShare : uploadFiles}
                className="w-full py-4 bg-[var(--accent-color)] text-white rounded-2xl font-bold shadow-lg shadow-[var(--accent-color)]/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:scale-100"
              >
                {uploading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    正在生成分享...
                  </div>
                ) : (
                  '立即生成分享链接'
                )}
              </button>

              {message && (
                <div className={`p-4 rounded-xl text-sm flex items-center gap-3 ${message.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                  {message.text}
                  <button onClick={() => setMessage(null)} className="ml-auto"><X className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1"
          >
            {loading ? (
              <div className="flex items-center justify-center p-20">
                <div className="w-10 h-10 border-4 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : shares.length === 0 ? (
              <div className="text-center py-20 bg-[var(--bg-main)] rounded-3xl border border-[var(--border-color)]">
                <Link className="w-12 h-12 text-[var(--text-secondary)] mx-auto mb-4 opacity-20" />
                <p className="text-[var(--text-secondary)]">暂无分享记录</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {shares.map(share => (
                  <div key={share.id} className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl p-5 hover:shadow-lg transition-all group">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${share.type === 'text' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'}`}>
                          {share.type === 'text' ? <FileText className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm truncate max-w-[150px]">{share.name}</h4>
                          <p className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {new Date(share.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => copyLink(share.id)}
                          className="p-2 hover:bg-[var(--accent-color)]/10 text-[var(--text-secondary)] hover:text-[var(--accent-color)] rounded-lg transition-colors"
                          title="复制链接"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => deleteShare(share.id)}
                          className="p-2 hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-500 rounded-lg transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border-color)]">
                      <div className="text-[10px] text-[var(--text-secondary)]">
                        {share.type === 'text' ? '纯文本' : `${share.files?.length || 0} 个文件 · ${formatSize(share.totalSize || 0)}`}
                      </div>
                      <a 
                        href={`/s/${share.id}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[10px] font-bold text-[var(--accent-color)] hover:underline"
                      >
                        预览查看 <Eye className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
