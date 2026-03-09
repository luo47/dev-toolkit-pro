import React, { useState, useEffect } from 'react';
import { Download, File, Folder, Clock, Shield, ArrowLeft, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';

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
}

export default function SharePreview() {
  const [id, setId] = useState<string>('');
  const [data, setData] = useState<ShareContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pathParts = window.location.pathname.split('/');
    const shareId = pathParts[pathParts.length - 1];
    if (shareId) {
      setId(shareId);
      fetchShareInfo(shareId);
    }
  }, []);

  const fetchShareInfo = async (shareId: string) => {
    try {
      const res = await fetch(`/api/public/share/${shareId}`);
      const json = await res.json() as { success: boolean, data: ShareContent, error?: string };
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || '分享不存在');
      }
    } catch (e) {
      setError('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] flex flex-col items-center justify-center p-4">
        <div className="bg-[var(--bg-surface)] p-8 rounded-[32px] border border-[var(--border-color)] text-center max-w-md w-full">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-bold mb-2">访问受阻</h2>
          <p className="text-[var(--text-secondary)] mb-6">{error || '该分享已失效或不存在'}</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full py-3 bg-[var(--accent-color)] text-white rounded-xl font-bold"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-main)] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => window.location.href = '/'}
          className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> 返回工具箱
        </button>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--bg-surface)] rounded-[32px] border border-[var(--border-color)] shadow-2xl overflow-hidden"
        >
          <div className="p-8 border-b border-[var(--border-color)] bg-gradient-to-br from-[var(--accent-color)]/5 to-transparent">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[var(--accent-color)] flex items-center justify-center text-white shadow-lg shadow-[var(--accent-color)]/20">
                  {data.type === 'file' ? <Folder className="w-8 h-8" /> : <FileText className="w-8 h-8" />}
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">{data.name || '未命名分享'}</h1>
                  <p className="text-sm text-[var(--text-secondary)] flex items-center gap-2 mt-1">
                    <Clock className="w-4 h-4" /> 分享于 {new Date(data.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              {data.type === 'file' && (
                <div className="bg-[var(--bg-main)] px-6 py-3 rounded-2xl border border-[var(--border-color)]">
                  <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider mb-1">总计大小</p>
                  <p className="text-lg font-mono font-bold text-[var(--accent-color)]">{formatSize(data.totalSize || 0)}</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-8">
            {data.type === 'text' ? (
              <div className="bg-[var(--bg-main)] rounded-2xl p-6 border border-[var(--border-color)]">
                <pre className="font-mono text-sm whitespace-pre-wrap break-all">{data.content}</pre>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[var(--text-secondary)] px-2 mb-4">包含的文件 ({data.files?.length || 0})</h3>
                {data.files?.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-[var(--bg-main)] hover:bg-[var(--hover-color)] rounded-2xl border border-[var(--border-color)] transition-all group">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[var(--accent-color)] transition-colors">
                        <File className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{file.name}</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">{formatSize(file.size)}</p>
                      </div>
                    </div>
                    <a 
                      href={`/api/public/download/${data.id}/${encodeURIComponent(file.path)}`}
                      className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface)] hover:bg-[var(--accent-color)] hover:text-white border border-[var(--border-color)] rounded-xl text-xs font-bold transition-all shadow-sm"
                    >
                      下载 <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-8 py-6 bg-[var(--bg-main)] border-t border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] text-xs">
            <Shield className="w-3 h-3 mr-2" /> 这是一个通过浮云工具箱生成的公开分享链接，请勿传输违法内容。
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function FileText(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
    </svg>
  );
}
