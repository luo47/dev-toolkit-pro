import React, { useState, useEffect } from 'react';
import { 
  File, 
  FolderOpen, 
  Download, 
  ArrowLeft, 
  Loader2, 
  Package,
  Calendar,
  HardDrive
} from 'lucide-react';
import { motion } from 'framer-motion';

interface FileItem {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

interface ShareData {
  id: string;
  name: string;
  files: FileItem[];
  totalSize: number;
  createdAt: string;
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const SharePreview: React.FC = () => {
  // 手动从路径中获取 ID: /share-preview/:id
  const id = window.location.pathname.split('/').pop();
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('无效的分享链接');
      setLoading(false);
      return;
    }

    const fetchShareDetail = async () => {
      try {
        const res = await fetch(`/api/share/detail/${id}`);
        if (!res.ok) throw new Error('分享已失效或不存在');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchShareDetail();
  }, [id]);

  const goBack = () => {
    window.location.href = '/';
  };

  const downloadAll = () => {
    // 触发打包下载 API
    window.location.href = `/api/share/download/${id}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white/50">
        <Loader2 className="animate-spin mb-4" size={40} />
        <p>正在拉取文件列表...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6">
          <Package size={40} />
        </div>
        <h2 className="text-2xl font-bold mb-2">出错了</h2>
        <p className="text-white/50 mb-8">{error || '无法获取分享信息'}</p>
        <button 
          onClick={goBack}
          className="px-6 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
        >
          回到首页
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <button 
        onClick={goBack}
        className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors"
      >
        <ArrowLeft size={18} />
        <span>返回工具箱</span>
      </button>

      {/* 分享头信息 */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--bg-main)] border border-white/10 rounded-2xl p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
      >
        <div className="space-y-2">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FolderOpen className="text-[var(--accent-color)]" />
            {data.name || '未命名分享'}
          </h1>
          <div className="flex flex-wrap gap-4 text-sm text-white/40">
            <div className="flex items-center gap-1">
              <Calendar size={14} />
              {new Date(data.createdAt).toLocaleDateString()}
            </div>
            <div className="flex items-center gap-1">
              <HardDrive size={14} />
              {data.files.length} 个文件 / {formatSize(data.totalSize)}
            </div>
          </div>
        </div>
        <button 
          onClick={downloadAll}
          className="flex items-center gap-2 px-8 py-3 bg-[var(--accent-color)] text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[var(--accent-color)]/20"
        >
          <Download size={20} />
          下载全部
        </button>
      </motion.div>

      {/* 文件列表 */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-[var(--bg-main)] border border-white/10 rounded-2xl overflow-hidden"
      >
        <div className="grid grid-cols-1 divide-y divide-white/5">
          {data.files.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors group">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center text-white/40 group-hover:text-[var(--accent-color)] transition-colors">
                  <File size={20} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-xs text-white/30">{formatSize(file.size)}</p>
                </div>
              </div>
              <a 
                href={`/api/share/file/${data.id}/${encodeURIComponent(file.name)}`}
                className="p-2 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-lg transition-all"
                title="单文件下载"
              >
                <Download size={18} className="text-white/60" />
              </a>
            </div>
          ))}
        </div>
      </motion.div>

      <p className="text-center text-xs text-white/20">
        文件由用户分享，请注意识别风险。ID: {data.id}
      </p>
    </div>
  );
};

export default SharePreview;
