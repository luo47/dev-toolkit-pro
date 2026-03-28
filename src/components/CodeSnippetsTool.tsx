import "./code-snippets/highlight";
import { ArrowUpDown, Code2, Plus, Search, Tag, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "../store";
import {
  collectLanguages,
  collectTags,
  createSharePayload,
  createUpdateSharePayload,
  getLanguageLabel,
  highlightSnippetCode,
  LS_SORT,
  type SnippetItem,
  SORT_OPTIONS,
  sortSnippets,
} from "./code-snippets/helpers";
import ShareConfirmDialog from "./code-snippets/ShareConfirmDialog";
import SnippetCard from "./code-snippets/SnippetCard";
import SnippetEditorModal from "./code-snippets/SnippetEditorModal";

export default function CodeSnippetsTool() {
  const { isDarkMode, showToast } = useAppStore();
  const [allSnippets, setAllSnippets] = useState<SnippetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [sortValue, setSortValue] = useState(
    () => localStorage.getItem(LS_SORT) || "updated_at:desc",
  );
  const [activeTag, setActiveTag] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    code: "",
    language: "plaintext",
    tags: "",
  });
  const [langSearch, setLangSearch] = useState("");
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [shareConfirmData, setShareConfirmData] = useState<{
    snippet: SnippetItem;
    shareId: string;
  } | null>(null);

  const langRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const codeRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/snippets?limit=2000");
      if (response.ok) {
        const data = (await response.json()) as { snippets: SnippetItem[] };
        setAllSnippets(data.snippets || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const snippets = React.useMemo(
    () => sortSnippets([...allSnippets], search, languageFilter, activeTag, sortValue),
    [activeTag, allSnippets, languageFilter, search, sortValue],
  );

  const allTags = React.useMemo(
    () => collectTags(allSnippets, search, languageFilter),
    [allSnippets, languageFilter, search],
  );

  const languages = React.useMemo(
    () => collectLanguages(allSnippets, search, activeTag),
    [activeTag, allSnippets, search],
  );

  useEffect(() => {
    highlightSnippetCode(codeRefs.current, snippets);
  }, [snippets]);

  const handleSortChange = (value: string) => {
    setSortValue(value);
    localStorage.setItem(LS_SORT, value);
  };

  const handleLanguageChange = (value: string) => {
    setLanguageFilter((prev) => (prev === value ? "" : value));
  };

  const handleTagClick = (tag: string) => {
    setActiveTag((prev) => (prev === tag ? "" : tag));
  };

  const handleCopy = async (id: string, code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    fetch(`/api/snippets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copyCountsDelta: { [id]: 1 } }),
    });
    setAllSnippets((prev) =>
      prev.map((snippet) =>
        snippet.id === id ? { ...snippet, copy_count: (snippet.copy_count || 0) + 1 } : snippet,
      ),
    );
  };

  const createShare = async (snippet: SnippetItem) => {
    const response = await fetch("/api/shares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createSharePayload(snippet)),
    });
    if (!response.ok) {
      showToast("分享失败，请重试", "error");
      return;
    }

    const data = (await response.json()) as {
      success: boolean;
      alreadyExists?: boolean;
      shareId?: string;
      data?: { id?: string };
      error?: string;
    };
    if (!data.success) {
      showToast(data.error || "分享失败", "error");
      return;
    }
    if (data.alreadyExists && data.shareId) {
      setShareConfirmData({ snippet, shareId: data.shareId });
      return;
    }

    showToast("已保存到云分享", "success");
    const shareId = data.data?.id;
    window.history.pushState(null, "", `/cloud-share${shareId ? `?highlight=${shareId}` : ""}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const updateShare = async (snippet: SnippetItem, shareId: string) => {
    const response = await fetch(`/api/shares/${shareId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createUpdateSharePayload(snippet)),
    });
    if (response.ok) {
      showToast("分享内容已更新", "success");
      window.history.pushState(null, "", `/cloud-share?highlight=${shareId}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
      return;
    }
    showToast("更新失败", "error");
  };

  const handleShare = async (snippet: SnippetItem, forceUpdate = false) => {
    if (sharingId) return;
    setSharingId(snippet.id);
    try {
      if (forceUpdate) {
        const shareId = shareConfirmData?.shareId;
        setShareConfirmData(null);
        if (!shareId) {
          showToast("无法定位原分享记录", "error");
          return;
        }
        await updateShare(snippet, shareId);
        return;
      }
      await createShare(snippet);
    } catch {
      showToast(forceUpdate ? "更新出错" : "网络错误，无法分享", "error");
    } finally {
      setSharingId(null);
    }
  };

  const copyShareLink = (shareId: string) => {
    const link = `${window.location.origin}/s/${shareId}`;
    navigator.clipboard.writeText(link).then(() => {
      showToast("分享链接已复制", "success");
      setShareConfirmData(null);
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此代码片段吗？")) return;
    const response = await fetch(`/api/snippets/${id}`, { method: "DELETE" });
    if (response.ok) {
      setAllSnippets((prev) => prev.filter((snippet) => snippet.id !== id));
      return;
    }
    alert("无法删除");
  };

  const startEdit = (snippet: SnippetItem) => {
    setEditingId(snippet.id);
    setIsCreating(false);
    setFormData({
      title: snippet.title,
      code: snippet.code,
      language: snippet.language || "plaintext",
      tags: Array.isArray(snippet.tags) ? snippet.tags.join(", ") : "",
    });
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const startCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setFormData({ title: "", code: "", language: "plaintext", tags: "" });
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
  };

  const saveSnippet = async () => {
    if (!formData.code) {
      alert("代码不能为空");
      return;
    }

    const payload = {
      ...formData,
      tags: formData.tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };

    try {
      if (isCreating) {
        const response = await fetch("/api/snippets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          const newSnippet = (await response.json()) as SnippetItem;
          setAllSnippets([newSnippet, ...allSnippets]);
          setIsCreating(false);
        } else {
          alert("保存失败");
        }
        return;
      }

      if (!editingId) return;
      const response = await fetch(`/api/snippets/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        setAllSnippets((prev) =>
          prev.map((snippet) => (snippet.id === editingId ? { ...snippet, ...payload } : snippet)),
        );
        setEditingId(null);
      } else {
        alert("更新失败");
      }
    } catch {
      alert("网络错误");
    }
  };

  return (
    <div className="flex flex-col h-full gap-1.5">
      <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] px-1.5 py-1 rounded-xl border border-[var(--border-color)]">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-4 text-[var(--text-secondary)] pointer-events-none" />
          <input
            type="text"
            placeholder="搜索片段..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-7 pr-2 py-1 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all placeholder:text-xs"
          />
        </div>
        <div className="relative shrink-0">
          <ArrowUpDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-secondary)] pointer-events-none" />
          <select
            value={sortValue}
            onChange={(e) => handleSortChange(e.target.value)}
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
          onClick={startCreate}
          className="flex items-center justify-center p-1.5 bg-[var(--accent-color)] text-white rounded-lg hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col gap-1 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-0.5 px-0.5 min-h-[26px]">
          {languageFilter ? (
            <button
              type="button"
              onClick={() => handleLanguageChange("")}
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
                  onClick={() => handleLanguageChange(option.language)}
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
                onClick={() => setActiveTag("")}
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
                  onClick={() => handleTagClick(tag.name)}
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

      {(isCreating || editingId) && (
        <SnippetEditorModal
          formData={formData}
          isCreating={isCreating}
          isDarkMode={isDarkMode}
          isLangOpen={isLangOpen}
          langRef={langRef}
          langSearch={langSearch}
          textareaRef={textareaRef}
          onCancel={cancelEdit}
          onLangOpenChange={setIsLangOpen}
          onLangSearchChange={setLangSearch}
          onSave={saveSnippet}
          onUpdateFormData={(updates) => setFormData((prev) => ({ ...prev, ...updates }))}
        />
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-[var(--border-color)] border-t-[var(--accent-color)] rounded-full animate-spin" />
        </div>
      ) : snippets.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)] p-8 border border-dashed border-[var(--border-color)] rounded-3xl bg-[var(--bg-surface)]">
          <Code2 className="w-12 h-12 opacity-20" />
          <p className="text-sm">没有找到匹配的代码片段</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 overflow-y-auto custom-scrollbar pb-1">
          {snippets.map((snippet) => (
            <SnippetCard
              key={snippet.id}
              activeTag={activeTag}
              codeRefs={codeRefs}
              copiedId={copiedId}
              sharingId={sharingId}
              snippet={snippet}
              onCopy={handleCopy}
              onDelete={handleDelete}
              onEdit={startEdit}
              onShare={handleShare}
              onTagClick={handleTagClick}
            />
          ))}
        </div>
      )}

      {shareConfirmData && (
        <ShareConfirmDialog
          shareConfirmData={shareConfirmData}
          onCancel={() => setShareConfirmData(null)}
          onCopyLink={copyShareLink}
          onUpdateShare={(snippet) => handleShare(snippet, true)}
        />
      )}
    </div>
  );
}
