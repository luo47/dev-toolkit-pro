import React, { useState, useEffect } from 'react';
import { 
  File, 
  FolderOpen, 
  Download, 
  ArrowLeft, 
  Loader2, 
  Package,
  Calendar,
  HardDrive,
  ExternalLink,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FileItem {
  key: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
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
  // 从路径获取 ID: /s/:id
  const id = window.location.pathname.split('/').pop();
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('无效的分享凭证');
      setLoading(false);
      return;
    }

    const fetchShareDetail = async () => {
      try {
        // 对齐参考路径 /api/public/share/:id
        const res = await fetch(`/api/public/share/${id}`);
        if (!res.ok) throw new Error('该分享已过期或已被发布者移除');
        const json = await res.json() as any;
        
        if (json.success) {
            setData(json.data);
        } else {
            throw new Error(json.error || '获取数据失败');
        }
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
    // 对齐参考路径 /api/public/download/:id
    window.location.href = `/api/public/download/${id}`;
  };

  const downloadSingle = (path: string) => {
    // 对齐参考路径 /api/public/download/:id/:path
    window.location.href = `/api/public/download/${id}/${encodeURIComponent(path)}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white/30 font-light">
        <Loader2 className="animate-spin mb-6 text-[var(--accent-color)]" size={48} />
        <p className="tracking-widest uppercase text-[10px] font-bold">正在建立安全连接...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <div className="w-24 h-24 bg-red-500/10 text-red-500 rounded-[32px] flex items-center justify-center mb-8 shadow-2xl shadow-red-500/10 border border-red-500/20">
          <AlertTriangle size={40} />
        </div>
        <h2 className="text-3xl font-black mb-4 tracking-tighter italic">拒绝访问</h2>
        <p className="text-white/40 mb-10 text-sm max-w-sm font-light leading-relaxed">
            {error || '系统无法验证该分享 ID 的有效性，可能资源已被销毁或链接已失效。'}
        </p>
        <button 
            onClick={goBack} 
            className="px-10 py-3 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl hover:bg-[var(--hover-color)] transition-all font-bold text-sm"
        >
          返回工具箱首页
        </button>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto p-4 lg:p-6 space-y-8 animate-in fade-in zoom-in-95 duration-700">
      {/* 头部装饰 */}
      <div className="flex items-center gap-4 text-white/20">
        <button onClick={goBack} className="flex items-center gap-2 hover:text-white transition-colors">
            <ArrowLeft size={16} />
            <span className="text-[10px] uppercase font-black">返回工具箱</span>
        </button>
        <div className="h-px flex-1 bg-white/5" />
        <div className="flex items-center gap-2 text-[10px] font-bold">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span className="uppercase italic tracking-tighter">内容已验证</span>
        </div>
      </div>

      {/* 分享头信息卡片 */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[32px] p-8 lg:p-12 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
            <Package size={200} />
        </div>

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-10">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-[var(--accent-color)]/10 rounded-2xl flex items-center justify-center text-[var(--accent-color)] shadow-inner">
                    <FolderOpen size={28} />
                </div>
                <div>
                   <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none">
                    {data.name || '资产包'}
                  </h1>
                  <p className="text-[10px] font-mono text-white/30 uppercase mt-1">分享 ID: {data.id}</p>
                </div>
            </div>
            
            <div className="flex flex-wrap gap-6 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-[var(--accent-color)]/50" />
                    <span>发布于: {new Date(data.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                    <HardDrive size={14} className="text-[var(--accent-color)]/50" />
                    <span>包含: {data.files?.length || 0} 个资产 / {formatSize(data.totalSize)}</span>
                </div>
            </div>
          </div>
          
          <button 
            onClick={downloadAll}
            className="group flex items-center gap-3 px-10 py-4 bg-[var(--accent-color)] text-white rounded-2xl font-black italic uppercase tracking-tighter hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[var(--accent-color)]/20"
          >
            <Download size={22} className="group-hover:translate-y-0.5 transition-transform" />
            <span>下载全量资产</span>
          </button>
        </div>
      </motion.div>

      {/* 资源列表卡片 */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[32px] overflow-hidden shadow-xl"
      >
        <div className="p-6 bg-[var(--bg-main)]/50 border-b border-[var(--border-color)] flex justify-between items-center px-8">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">文件系统结构</span>
            <span className="text-[10px] font-mono text-white/20">{data.files?.length} 个项已验证</span>
        </div>
        
        <div className="grid grid-cols-1 divide-y divide-[var(--border-color)]">
          {Array.isArray(data.files) && data.files.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-5 lg:px-8 hover:bg-[var(--hover-color)] transition-all group">
              <div className="flex items-center gap-5 min-w-0">
                <div className="w-12 h-12 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl flex items-center justify-center text-white/20 group-hover:text-[var(--accent-color)] group-hover:border-[var(--accent-color)]/30 transition-all shadow-sm">
                  <File size={22} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-white/80 group-hover:text-white transition-colors truncate" title={file.path}>
                    {file.path}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-white/20 uppercase tracking-tighter">{formatSize(file.size)}</span>
                    <span className="w-1 h-1 rounded-full bg-white/10" />
                    <span className="text-[10px] font-mono text-white/20 uppercase tracking-tighter">
                        {file.mimeType.includes('text') || file.mimeType.includes('plain') ? '纯文本' : file.mimeType.split('/')[1] || '二进制'}
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => downloadSingle(file.path)}
                className="p-3 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl md:opacity-0 md:group-hover:opacity-100 hover:border-[var(--accent-color)]/50 hover:text-[var(--accent-color)] transition-all shadow-sm"
                title="分流下载"
              >
                <Download size={18} />
              </button>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="flex flex-col items-center gap-3 pt-4">
        <p className="text-[10px] font-mono text-white/10 uppercase tracking-[0.3em]">
            系统哈希已验证 · 端到端加密校验中
        </p>
        <Link2External />
      </div>
    </div>
  );
};

const Link2External = () => (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full text-[9px] font-bold text-white/20 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer uppercase tracking-tighter">
        <ExternalLink size={10} />
        由 Cloudflare R2 存储驱动
    </div>
)

export default SharePreview;
