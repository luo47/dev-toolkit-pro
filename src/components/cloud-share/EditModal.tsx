import { motion } from "framer-motion";
import { Edit3, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useAppStore } from "../../store";
import type { ShareContent } from "../../types";

interface EditModalProps {
  share: ShareContent;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditModal({ share, onClose, onSuccess }: EditModalProps) {
  const { isDarkMode } = useAppStore();
  const [content, setContent] = useState(share.content || "");
  const [isLoading, setIsLoading] = useState(false);

  const save = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/shares/${share.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = (await response.json()) as {
        success: boolean;
        data?: ShareContent;
        error?: string;
      };
      if (data.success) {
        window.showToast?.("内容已成功同步", "success");
        onSuccess();
      }
    } catch (error) {
      console.error(error);
      window.showToast?.("同步失败，请检查网络", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`fixed inset-0 z-[110] flex items-center justify-center p-6 backdrop-blur-3xl ${isDarkMode ? "bg-black/90" : "bg-black/10"}`}
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-[var(--bg-surface)] border border-[var(--border-color)] w-full max-w-[900px] rounded-[40px] overflow-hidden shadow-2xl"
      >
        <div className="p-8 flex justify-between items-center border-b border-[var(--border-color)] opacity-80">
          <h2 className="text-xl font-bold flex items-center gap-3">
            <Edit3 className="text-[var(--accent-color)]" size={20} />
            <span className="text-[var(--text-primary)]">编辑内容</span>
            <code className="text-xs font-mono ml-2 text-[var(--text-secondary)] opacity-40">
              ID: {share.id}
            </code>
          </h2>
          <button
            onClick={onClose}
            className="p-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-8">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-[450px] bg-[var(--bg-input)] border border-[var(--border-color)] rounded-2xl p-6 font-mono text-sm leading-relaxed text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/30 transition-all shadow-inner"
          />
        </div>
        <div className="p-8 bg-[var(--bg-main)] border-t border-[var(--border-color)] flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-8 py-4 text-[var(--text-secondary)] font-bold hover:text-[var(--text-primary)] transition-colors"
          >
            取消
          </button>
          <button
            onClick={save}
            disabled={isLoading}
            className="px-10 py-4 bg-[var(--accent-color)] text-white rounded-2xl font-bold shadow-lg shadow-[var(--accent-color)]/20 flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            {isLoading && <Loader2 className="animate-spin" size={18} />}
            <span>{isLoading ? "正在保存..." : "完成修改"}</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
