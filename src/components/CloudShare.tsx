import { AnimatePresence } from "framer-motion";
import { AlertCircle, Loader2, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ShareContent } from "../types";
import EditModal from "./cloud-share/EditModal";
import ShareCard from "./cloud-share/ShareCard";
import TokenModal from "./cloud-share/TokenModal";
import UploadModal from "./cloud-share/UploadModal";

const readHighlightId = () => new URLSearchParams(window.location.search).get("highlight");

const getFilteredShares = (shares: ShareContent[], searchQuery: string) => {
  const keyword = searchQuery.toLowerCase();
  return shares.filter(
    (share) =>
      share.id.toLowerCase().includes(keyword) ||
      share.name?.toLowerCase().includes(keyword) ||
      share.content?.toLowerCase().includes(keyword),
  );
};

const ShareListState = ({
  isLoading,
  shares,
  filteredShares,
  onClearSearch,
  highlightedId,
  onCopyLink,
  onDelete,
  onEdit,
  onManageToken,
  onJump,
}: {
  isLoading: boolean;
  shares: ShareContent[];
  filteredShares: ShareContent[];
  onClearSearch: () => void;
  highlightedId: string | null;
  onCopyLink: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (share: ShareContent | null) => void;
  onManageToken: (share: ShareContent | null) => void;
  onJump: (share: ShareContent, mode: "view" | "edit") => void;
}) => {
  if (isLoading && shares.length === 0) {
    return (
      <div className="bg-[var(--bg-surface)] rounded-[32px] border border-[var(--border-color)] p-32 text-center animate-pulse">
        <Loader2 className="animate-spin mx-auto mb-4 text-blue-500" size={32} />
        <p className="text-[var(--text-secondary)] text-sm italic font-mono uppercase tracking-widest">
          正在同步数据...
        </p>
      </div>
    );
  }

  if (filteredShares.length === 0) {
    return (
      <div className="bg-[var(--bg-surface)] rounded-[32px] border border-[var(--border-color)] p-32 text-center">
        <AlertCircle className="mx-auto mb-4 text-[var(--text-secondary)] opacity-20" size={48} />
        <p className="text-[var(--text-secondary)] font-medium">未找到匹配的分享项</p>
        <button type="button" onClick={onClearSearch} className="mt-4 text-blue-500 text-sm underline">
          清除搜索
        </button>
      </div>
    );
  }

  return filteredShares.map((share, index) => (
    <ShareCard
      key={share.id}
      highlighted={highlightedId === share.id}
      index={index}
      share={share}
      onCopyLink={onCopyLink}
      onDelete={onDelete}
      onEdit={onEdit}
      onManageToken={onManageToken}
      onJump={onJump}
    />
  ));
};

const jumpToSnippet = (share: ShareContent, mode: "view" | "edit") => {
  if (!share.sourceId) return;
  const snippetId = String(share.sourceId);
  const searchParams = new URLSearchParams();
  searchParams.set("highlight", snippetId);
  if (mode === "edit") {
    searchParams.set("edit", snippetId);
  }
  const targetPath = `/code-snippets?${searchParams.toString()}`;
  window.history.pushState(null, "", targetPath);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

export default function CloudShare() {
  const [shares, setShares] = useState<ShareContent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingShare, setEditingShare] = useState<ShareContent | null>(null);
  const [managedTokenShare, setManagedTokenShare] = useState<ShareContent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const fetchShares = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/shares?_t=${Date.now()}`);
      const data = (await response.json()) as { success: boolean; data?: ShareContent[] };
      if (data.success) {
        setShares(data.data || []);
      }
    } catch (error) {
      console.error("获取分享列表失败:", error);
      window.showToast?.("同步数据失败，请检查网络", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShares();

    const highlight = readHighlightId();
    if (!highlight) return;

    setHighlightedId(highlight);
    const timer = setTimeout(() => {
      setHighlightedId(null);
      window.history.replaceState(null, "", window.location.pathname);
    }, 5000);
    return () => clearTimeout(timer);
  }, [fetchShares]);

  const copyLink = (id: string) => {
    const link = `${window.location.origin}/s/${id}`;
    navigator.clipboard.writeText(link);
    window.showToast?.("分享链接已复制到剪贴板", "success");
  };

  const deleteShare = async (id: string) => {
    if (!confirm("确定要彻底删除该分享吗？该操作不可撤销。")) return;
    try {
      const response = await fetch(`/api/shares/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (data.success) {
        window.showToast?.("分享已彻底移除", "success");
        fetchShares();
      } else {
        window.showToast?.(data.error || "删除失败", "error");
      }
    } catch (error) {
      console.error("删除失败:", error);
      window.showToast?.("删除请求失败", "error");
    }
  };

  const filteredShares = getFilteredShares(shares, searchQuery);

  return (
    <div className="w-full max-w-[1400px] mx-auto min-h-[800px] pb-24 px-4 sm:px-6 lg:px-8 space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6">
        <div className="flex flex-wrap items-center gap-4 w-full">
          <div className="relative group flex-1 md:max-w-md">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-blue-500 transition-colors"
              size={18}
            />
            <input
              type="text"
              placeholder="快速检索分享内容 or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-2xl pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-[var(--text-secondary)] shadow-sm"
            />
          </div>

          <div className="h-8 w-px bg-[var(--border-color)] hidden sm:block" />

          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            className="w-12 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold flex items-center justify-center shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
            title="创建新分享"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <ShareListState
          isLoading={isLoading}
          shares={shares}
          filteredShares={filteredShares}
          onClearSearch={() => setSearchQuery("")}
          highlightedId={highlightedId}
          onCopyLink={copyLink}
          onDelete={deleteShare}
          onEdit={setEditingShare}
          onManageToken={setManagedTokenShare}
          onJump={jumpToSnippet}
        />
      </div>

      <AnimatePresence>
        {showUploadModal && (
          <UploadModal
            onClose={() => setShowUploadModal(false)}
            onSuccess={() => {
              setShowUploadModal(false);
              fetchShares();
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingShare && (
          <EditModal
            share={editingShare}
            onClose={() => setEditingShare(null)}
            onSuccess={() => {
              setEditingShare(null);
              fetchShares();
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {managedTokenShare && (
          <TokenModal
            share={managedTokenShare}
            onClose={() => setManagedTokenShare(null)}
            onUpdate={() => {
              fetchShares();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
