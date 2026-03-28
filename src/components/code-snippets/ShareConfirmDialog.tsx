import { Share2 } from "lucide-react";
import type { SnippetItem } from "./helpers";

interface ShareConfirmDialogProps {
  shareConfirmData: {
    snippet: SnippetItem;
    shareId: string;
  };
  onCancel: () => void;
  onCopyLink: (shareId: string) => void;
  onUpdateShare: (snippet: SnippetItem) => void;
}

export default function ShareConfirmDialog({
  shareConfirmData,
  onCancel,
  onCopyLink,
  onUpdateShare,
}: ShareConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-[var(--bg-surface)] rounded-[24px] border border-[var(--border-color)] shadow-2xl p-6 flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-200">
        <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mb-1">
          <Share2 size={24} />
        </div>
        <div>
          <h4 className="text-base font-bold text-[var(--text-primary)] mb-1">该片段已分享过</h4>
          <p className="text-xs text-[var(--text-secondary)]">
            您可以选择更新云端内容，或者仅复制现有链接。
          </p>
        </div>
        <div className="flex flex-col w-full gap-2 mt-2">
          <button
            onClick={() => onUpdateShare(shareConfirmData.snippet)}
            className="w-full py-3 bg-[var(--accent-color)] text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"
          >
            更新内容并跳转
          </button>
          <button
            onClick={() => onCopyLink(shareConfirmData.shareId)}
            className="w-full py-3 bg-[var(--bg-main)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm font-bold rounded-xl hover:bg-[var(--hover-color)] transition-colors"
          >
            仅复制分享链接
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2 text-[var(--text-secondary)] text-xs font-medium hover:text-[var(--text-primary)] transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
