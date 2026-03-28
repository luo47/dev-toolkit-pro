import { Check, Code2, Copy, Edit2, Share2, Trash2 } from "lucide-react";
import type React from "react";
import type { MutableRefObject } from "react";
import type { SnippetItem } from "./helpers";

interface SnippetCardProps {
  activeTag: string;
  codeRefs: MutableRefObject<Record<string, HTMLElement | null>>;
  copiedId: string | null;
  sharingId: string | null;
  snippet: SnippetItem;
  onCopy: (id: string, code: string) => void;
  onDelete: (id: string) => void;
  onEdit: (snippet: SnippetItem) => void;
  onShare: (snippet: SnippetItem) => void;
  onTagClick: (tag: string) => void;
}

const SnippetCard: React.FC<SnippetCardProps> = ({
  activeTag,
  codeRefs,
  copiedId,
  sharingId,
  snippet,
  onCopy,
  onDelete,
  onEdit,
  onShare,
  onTagClick,
}) => {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl flex flex-col overflow-hidden hover:border-[var(--text-secondary)] transition-colors group">
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-[var(--bg-main)] border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2 overflow-hidden min-w-0">
          <Code2 className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0" />
          <div className="overflow-hidden">
            <div className="text-xs font-medium truncate leading-tight">{snippet.title || ""}</div>
            {snippet.language && (
              <span className="text-[9px] px-1.5 py-0 bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20 rounded-full font-medium uppercase tracking-wider">
                {snippet.language}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <span className="text-[9px] text-[var(--text-secondary)] mr-1">
            {snippet.copy_count || 0}
          </span>
          <button
            onClick={() => onCopy(snippet.id, snippet.code)}
            className="p-1.5 hover:bg-[var(--hover-color)] rounded-md text-[var(--text-secondary)]"
            title="复制"
          >
            {copiedId === snippet.id ? (
              <Check size={14} className="text-green-400" />
            ) : (
              <Copy size={14} />
            )}
          </button>
          <button
            onClick={() => onShare(snippet)}
            disabled={sharingId === snippet.id}
            className={`p-1.5 rounded-md text-[var(--text-secondary)] ${sharingId === snippet.id ? "opacity-50 cursor-not-allowed" : "hover:bg-[var(--hover-color)] hover:text-blue-500"}`}
            title="分享到云端"
          >
            <Share2 size={14} className={sharingId === snippet.id ? "animate-pulse" : ""} />
          </button>
          <button
            onClick={() => onEdit(snippet)}
            className="p-1.5 hover:bg-[var(--hover-color)] rounded-md text-[var(--text-secondary)]"
            title="编辑"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => onDelete(snippet.id)}
            className="p-1.5 hover:bg-[var(--hover-color)] rounded-md hover:text-red-400 text-[var(--text-secondary)]"
            title="删除"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="bg-[var(--code-bg)] flex-1 overflow-hidden flex flex-col min-h-[60px]">
        <div className="flex-1 overflow-auto custom-scrollbar-thin max-h-40">
          <pre className="text-xs p-3 font-mono text-[var(--code-text)]">
            <code
              ref={(element) => {
                codeRefs.current[snippet.id] = element;
              }}
              className={`language-${snippet.language || "plaintext"}`}
            >
              {snippet.code}
            </code>
          </pre>
        </div>
      </div>
      {snippet.tags && snippet.tags.length > 0 && (
        <div className="px-2.5 py-1.5 flex items-center gap-1 flex-wrap border-t border-[var(--border-color)] bg-[var(--bg-main)]">
          {snippet.tags.map((tag) => (
            <button
              key={`${snippet.id}-${tag}`}
              onClick={() => onTagClick(tag)}
              className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${activeTag === tag ? "bg-[var(--accent-color)] text-white shadow-sm" : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:border-[var(--text-secondary)]"}`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SnippetCard;
