import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collectLanguages,
  collectTags,
  createSharePayload,
  createUpdateSharePayload,
  highlightSnippetCode,
  LS_SORT,
  type SnippetItem,
  sortSnippets,
} from "./helpers";

type ShareConfirmData = {
  snippet: SnippetItem;
  shareId: string;
} | null;

const buildSnippetPayload = (formData: { title: string; code: string; language: string; tags: string }) => ({
  ...formData,
  tags: formData.tags
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
});

const useSnippetEditorState = () => {
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
  const langRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  return {
    cancelEdit,
    editingId,
    formData,
    isCreating,
    isLangOpen,
    langRef,
    langSearch,
    setEditingId,
    setFormData,
    setIsCreating,
    setIsLangOpen,
    setLangSearch,
    startCreate,
    startEdit,
    textareaRef,
  };
};

const useSnippetCollections = (
  allSnippets: SnippetItem[],
  search: string,
  languageFilter: string,
  activeTag: string,
  sortValue: string,
  codeRefs: React.RefObject<Record<string, HTMLElement | null>>,
) => {
  const snippets = useMemo(
    () => sortSnippets([...allSnippets], search, languageFilter, activeTag, sortValue),
    [activeTag, allSnippets, languageFilter, search, sortValue],
  );
  const allTags = useMemo(
    () => collectTags(allSnippets, search, languageFilter),
    [allSnippets, languageFilter, search],
  );
  const languages = useMemo(() => collectLanguages(allSnippets, search, activeTag), [activeTag, allSnippets, search]);

  useEffect(() => {
    const refs = codeRefs.current;
    highlightSnippetCode(refs, snippets);
  }, [codeRefs, snippets]);

  return { snippets, allTags, languages };
};

const useSnippetShareActions = ({
  shareConfirmData,
  setShareConfirmData,
  sharingId,
  setSharingId,
  showToast,
}: {
  shareConfirmData: ShareConfirmData;
  setShareConfirmData: React.Dispatch<React.SetStateAction<ShareConfirmData>>;
  sharingId: string | null;
  setSharingId: React.Dispatch<React.SetStateAction<string | null>>;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}) => {
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

  return { copyShareLink, handleShare };
};

export const useCodeSnippetsToolController = (
  showToast: (message: string, type?: "success" | "error" | "info") => void,
) => {
  const [allSnippets, setAllSnippets] = useState<SnippetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [sortValue, setSortValue] = useState(() => localStorage.getItem(LS_SORT) || "updated_at:desc");
  const [activeTag, setActiveTag] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [shareConfirmData, setShareConfirmData] = useState<ShareConfirmData>(null);
  const codeRefs = useRef<Record<string, HTMLElement | null>>({});
  const {
    cancelEdit,
    editingId,
    formData,
    isCreating,
    isLangOpen,
    langRef,
    langSearch,
    setEditingId,
    setFormData,
    setIsCreating,
    setIsLangOpen,
    setLangSearch,
    startCreate,
    startEdit,
    textareaRef,
  } = useSnippetEditorState();
  const { copyShareLink, handleShare } = useSnippetShareActions({
    shareConfirmData,
    setShareConfirmData,
    sharingId,
    setSharingId,
    showToast,
  });

  useEffect(() => {
    const currentLangRef = langRef.current;
    const handleClickOutside = (event: MouseEvent) => {
      if (currentLangRef && !currentLangRef.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [langRef, setIsLangOpen]);

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

  const { snippets, allTags, languages } = useSnippetCollections(
    allSnippets,
    search,
    languageFilter,
    activeTag,
    sortValue,
    codeRefs,
  );

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
      prev.map((snippet) => (snippet.id === id ? { ...snippet, copy_count: (snippet.copy_count || 0) + 1 } : snippet)),
    );
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

  const saveSnippet = async () => {
    if (!formData.code) {
      alert("代码不能为空");
      return;
    }

    const payload = buildSnippetPayload(formData);

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

  return {
    activeTag,
    allTags,
    cancelEdit,
    codeRefs,
    copiedId,
    copyShareLink,
    editingId,
    formData,
    handleCopy,
    handleDelete,
    handleLanguageChange,
    handleShare,
    handleSortChange,
    handleTagClick,
    isCreating,
    isLangOpen,
    langRef,
    langSearch,
    languageFilter,
    languages,
    loading,
    search,
    setActiveTag,
    setFormData,
    setIsLangOpen,
    setLangSearch,
    setSearch,
    shareConfirmData,
    setShareConfirmData,
    sharingId,
    snippets,
    sortValue,
    startCreate,
    startEdit,
    textareaRef,
    saveSnippet,
  };
};
