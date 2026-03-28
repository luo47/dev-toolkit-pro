import { ArrowUpDown, Code2, Plus, Search, Tag, X } from "lucide-react";
import type React from "react";
import { getLanguageLabel, type SnippetItem, SORT_OPTIONS } from "./helpers";
import SnippetCard from "./SnippetCard";

type SnippetToolbarProps = {
  search: string;
  sortValue: string;
  onSearchChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onCreate: () => void;
};

export const SnippetToolbar = ({ search, sortValue, onSearchChange, onSortChange, onCreate }: SnippetToolbarProps) => (
  <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] px-1.5 py-1 rounded-xl border border-[var(--border-color)]">
    <div className="relative flex-1 min-w-0">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-4 text-[var(--text-secondary)] pointer-events-none" />
      <input
        type="text"
        placeholder="搜索片段..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full pl-7 pr-2 py-1 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all placeholder:text-xs"
      />
    </div>
    <div className="relative shrink-0">
      <ArrowUpDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-secondary)] pointer-events-none" />
      <select
        value={sortValue}
        onChange={(e) => onSortChange(e.target.value)}
        className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg pl-6 pr-2 py-1 text-xs outline-none cursor-pointer hover:border-[var(--text-secondary)] transition-colors min-w-[90px]"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
    <button
      type="button"
      onClick={onCreate}
      className="flex items-center justify-center p-1.5 bg-[var(--accent-color)] text-white rounded-lg hover:opacity-90 transition-opacity shrink-0"
    >
      <Plus className="w-4 h-4" />
    </button>
  </div>
);

type SnippetFilterBarProps = {
  allTags: Array<{ name: string; count: number }>;
  activeTag: string;
  languageFilter: string;
  languages: Array<{ language: string; count: number }>;
  onLanguageChange: (value: string) => void;
  onTagClick: (tag: string) => void;
  onClearTag: () => void;
};

export const SnippetFilterBar = ({
  allTags,
  activeTag,
  languageFilter,
  languages,
  onLanguageChange,
  onTagClick,
  onClearTag,
}: SnippetFilterBarProps) => (
  <div className="flex flex-col gap-1 shrink-0">
    <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-0.5 px-0.5 min-h-[26px]">
      {languageFilter ? (
        <button
          type="button"
          onClick={() => onLanguageChange("")}
          className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border bg-[var(--accent-color)] border-[var(--accent-color)] text-white font-medium shadow-sm transition-all flex items-center gap-1"
        >
          <X className="w-2.5 h-2.5" />
          {getLanguageLabel(languageFilter)}
        </button>
      ) : (
        languages
          .filter((option) => option.language !== "")
          .map((option) => (
            <button
              type="button"
              key={option.language}
              onClick={() => onLanguageChange(option.language)}
              className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)] transition-all"
            >
              {getLanguageLabel(option.language)}
              <span className="ml-1 opacity-60">{option.count}</span>
            </button>
          ))
      )}
    </div>
    {allTags.length > 0 && (
      <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-0.5 min-h-[26px]">
        <Tag className="w-3 h-3 text-[var(--text-secondary)] shrink-0 ml-0.5" />
        {activeTag ? (
          <button
            type="button"
            onClick={onClearTag}
            className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border bg-[var(--accent-color)] border-[var(--accent-color)] text-white font-medium shadow-sm transition-all flex items-center gap-1"
          >
            <X className="w-2.5 h-2.5" />
            {activeTag}
          </button>
        ) : (
          allTags.map((tag) => (
            <button
              type="button"
              key={tag.name}
              onClick={() => onTagClick(tag.name)}
              className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)] transition-all"
            >
              {tag.name}
              <span className="ml-1 opacity-60">{tag.count}</span>
            </button>
          ))
        )}
      </div>
    )}
  </div>
);

type SnippetGridProps = {
  loading: boolean;
  snippets: SnippetItem[];
  activeTag: string;
  copiedId: string | null;
  sharingId: string | null;
  codeRefs: React.RefObject<Record<string, HTMLElement | null>>;
  onCopy: (id: string, code: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (snippet: SnippetItem) => void;
  onShare: (snippet: SnippetItem, forceUpdate?: boolean) => Promise<void>;
  onTagClick: (tag: string) => void;
};

export const SnippetGrid = ({
  loading,
  snippets,
  activeTag,
  copiedId,
  sharingId,
  codeRefs,
  onCopy,
  onDelete,
  onEdit,
  onShare,
  onTagClick,
}: SnippetGridProps) => {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--border-color)] border-t-[var(--accent-color)] rounded-full animate-spin" />
      </div>
    );
  }

  if (snippets.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)] p-8 border border-dashed border-[var(--border-color)] rounded-3xl bg-[var(--bg-surface)]">
        <Code2 className="w-12 h-12 opacity-20" />
        <p className="text-sm">没有找到匹配的代码片段</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 overflow-y-auto custom-scrollbar pb-1">
      {snippets.map((snippet) => (
        <SnippetCard
          key={snippet.id}
          activeTag={activeTag}
          codeRefs={codeRefs}
          copiedId={copiedId}
          sharingId={sharingId}
          snippet={snippet}
          onCopy={onCopy}
          onDelete={onDelete}
          onEdit={onEdit}
          onShare={onShare}
          onTagClick={onTagClick}
        />
      ))}
    </div>
  );
};
