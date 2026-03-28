import { motion } from "framer-motion";
import { Copy, Edit3, Eye, File as FileIcon, Files, FileText, History, Trash2 } from "lucide-react";
import type React from "react";
import type { ShareContent } from "../../types";
import { formatSize } from "./cloudShareUtils";

interface ShareCardProps {
  highlighted: boolean;
  index: number;
  share: ShareContent;
  onCopyLink: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (share: ShareContent) => void;
}

const getShareTypeLabel = (share: ShareContent) => {
  if (share.type !== "file") return "纯文本";
  return share.files?.length === 1 ? "单文件" : "多文件";
};

const getShareTitle = (share: ShareContent) => {
  if (share.type === "file") {
    return share.name || (share.files?.length === 1 ? "未命名文件" : "未命名资产包");
  }
  return share.content?.slice(0, 40) || "文本片段";
};

const ShareCard: React.FC<ShareCardProps> = ({
  highlighted,
  index,
  share,
  onCopyLink,
  onDelete,
  onEdit,
}) => {
  return (
    <motion.div
      key={share.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: 1,
        y: 0,
        borderColor: highlighted ? "var(--accent-color)" : "var(--border-color)",
        boxShadow: highlighted ? "0 0 20px var(--accent-color)40" : "none",
        scale: highlighted ? 1.02 : 1,
      }}
      transition={{
        delay: index * 0.03,
        borderColor: { duration: 0.5 },
        boxShadow: { duration: 0.5 },
        scale: { duration: 0.3 },
      }}
      className={`group bg-[var(--bg-surface)] hover:bg-[var(--hover-color)] border rounded-[28px] p-6 flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8 transition-all relative overflow-hidden shadow-sm hover:shadow-md ${highlighted ? "z-10" : ""}`}
    >
      <div
        className={`absolute left-0 top-0 bottom-0 w-1.5 ${share.type === "file" ? "bg-emerald-500/50" : "bg-blue-500/50"}`}
      />

      <div className="flex items-center gap-6 flex-1 min-w-0 w-full">
        <div
          className={`w-16 h-16 rounded-[22px] flex items-center justify-center shrink-0 ${share.type === "file" ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500"}`}
        >
          {share.type === "file" ? (
            share.files?.length === 1 ? (
              <FileIcon size={28} />
            ) : (
              <Files size={28} />
            )
          ) : (
            <FileText size={28} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-1.5">
            <span
              className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${share.type === "file" ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"}`}
            >
              {getShareTypeLabel(share)}
            </span>
            <code className="text-[10px] font-mono text-[var(--text-secondary)] tracking-widest uppercase">
              ID: {share.id}
            </code>
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)] truncate group-hover:text-blue-500">
            {getShareTitle(share)}
          </h3>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1.5">
              <History size={12} />
              {new Date(share.createdAt).toLocaleString("zh-CN", {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {share.type === "file" && (
              <span className="text-[11px] text-emerald-500/40 uppercase font-black flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-emerald-500/40" />
                {share.files?.length} 个文件 · {formatSize(share.totalSize || 0)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 p-1.5 bg-[var(--bg-surface)] backdrop-blur rounded-2xl border border-[var(--border-color)] md:opacity-0 md:group-hover:opacity-100 transition-all md:scale-95 md:group-hover:scale-100 shadow-xl shadow-black/5">
        <button
          type="button"
          onClick={() => window.open(`/s/${share.id}`, "_blank")}
          className="w-12 h-12 flex items-center justify-center hover:bg-emerald-500 hover:text-white rounded-xl transition-all text-[var(--text-secondary)]"
          title="立即预览"
        >
          <Eye size={20} />
        </button>
        <button
          type="button"
          onClick={() => onCopyLink(share.id)}
          className="w-12 h-12 flex items-center justify-center hover:bg-blue-500 hover:text-white rounded-xl transition-all text-[var(--text-secondary)]"
          title="复制链接"
        >
          <Copy size={20} />
        </button>
        {share.type === "text" && (
          <button
            type="button"
            onClick={() => onEdit(share)}
            className="w-12 h-12 flex items-center justify-center hover:bg-blue-500 hover:text-white rounded-xl transition-all text-[var(--text-secondary)]"
            title="编辑"
          >
            <Edit3 size={20} />
          </button>
        )}
        <div className="w-px h-6 bg-[var(--border-color)] mx-1" />
        <button
          type="button"
          onClick={() => onDelete(share.id)}
          className="w-12 h-12 flex items-center justify-center hover:bg-red-500 hover:text-white rounded-xl transition-all text-[var(--text-secondary)]"
          title="删除"
        >
          <Trash2 size={20} />
        </button>
      </div>
    </motion.div>
  );
};

export default ShareCard;
