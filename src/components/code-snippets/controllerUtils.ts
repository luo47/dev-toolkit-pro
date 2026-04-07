import { useEffect, useState } from "react";
import type { SnippetItem } from "./helpers";

export const normalizeSnippetId = (id: string | number) => String(id);

export const dedupeSnippets = (snippets: SnippetItem[]) => {
  const unique = new Map<string, SnippetItem>();
  for (const snippet of snippets) {
    unique.set(normalizeSnippetId(snippet.id), snippet);
  }
  return Array.from(unique.values());
};

export const upsertSnippet = (snippets: SnippetItem[], targetSnippet: SnippetItem) =>
  dedupeSnippets([targetSnippet, ...snippets]);

export const cleanupSnippetIntentQuery = () => {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("edit") && !params.has("highlight")) return;
  params.delete("edit");
  params.delete("highlight");
  const nextSearch = params.toString();
  const nextPath = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
  window.history.replaceState(null, "", nextPath);
};

type SnippetIntent = {
  id: string;
  mode: "edit" | "focus";
} | null;

const readSnippetIntent = (search: string): SnippetIntent => {
  const params = new URLSearchParams(search);
  const editId = params.get("edit");
  if (editId) {
    return { id: editId, mode: "edit" };
  }

  const highlightId = params.get("highlight");
  if (highlightId) {
    return { id: highlightId, mode: "focus" };
  }

  return null;
};

export const useSnippetIntent = () => {
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    const syncSearch = () => setSearch(window.location.search);
    window.addEventListener("popstate", syncSearch);
    return () => window.removeEventListener("popstate", syncSearch);
  }, []);

  return readSnippetIntent(search);
};
