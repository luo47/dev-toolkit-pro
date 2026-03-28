import hljs from "highlight.js/lib/core";

export const SORT_OPTIONS = [
  { value: "updated_at:desc", label: "最新修改" },
  { value: "copy_count:desc", label: "复制次数" },
  { value: "created_at:desc", label: "最新创建" },
  { value: "title:asc", label: "标题排序" },
];

export const LANGUAGE_GROUPS = [
  {
    label: "网页前端",
    options: [
      { value: "html", label: "html (xml)" },
      { value: "css", label: "css" },
      { value: "javascript", label: "javascript (js)" },
      { value: "typescript", label: "typescript (ts)" },
      { value: "json", label: "json" },
    ],
  },
  {
    label: "后端/通用",
    options: [
      { value: "java", label: "java" },
      { value: "python", label: "python (py)" },
      { value: "php", label: "php" },
      { value: "c", label: "c" },
      { value: "cpp", label: "cpp (c++)" },
      { value: "csharp", label: "csharp (cs)" },
      { value: "go", label: "go" },
      { value: "rust", label: "rust" },
      { value: "ruby", label: "ruby" },
    ],
  },
  {
    label: "脚本/运维",
    options: [
      { value: "bash", label: "bash (sh)" },
      { value: "shell", label: "shell" },
      { value: "yaml", label: "yaml (yml)" },
      { value: "toml", label: "toml" },
      { value: "dockerfile", label: "dockerfile" },
      { value: "makefile", label: "makefile" },
      { value: "ini", label: "ini" },
      { value: "properties", label: "properties" },
    ],
  },
  {
    label: "数据/文档",
    options: [
      { value: "sql", label: "sql" },
      { value: "markdown", label: "markdown (md)" },
      { value: "diff", label: "diff" },
      { value: "plaintext", label: "plaintext (text)" },
    ],
  },
];

export const PRESET_LANGUAGES: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  python: "py",
  html: "html",
  css: "css",
  json: "json",
  java: "java",
  php: "php",
  c: "c",
  cpp: "cpp",
  csharp: "cs",
  go: "go",
  rust: "rust",
  ruby: "ruby",
  bash: "sh",
  shell: "sh",
  yaml: "yml",
  sql: "sql",
  markdown: "md",
  dockerfile: "docker",
  makefile: "make",
  ini: "ini",
  properties: "prop",
  toml: "toml",
  diff: "diff",
  plaintext: "txt",
};

export const LS_SORT = "cs_filter_sort";

export type SnippetItem = {
  id: string;
  title: string;
  code: string;
  language?: string;
  tags?: string[];
  copy_count?: number;
  created_at?: string;
  updated_at?: string;
};

const matchesSearch = (snippet: SnippetItem, search: string) => {
  if (!search) return true;
  const keyword = search.toLowerCase();
  return (
    (snippet.title || "").toLowerCase().includes(keyword) ||
    (snippet.code || "").toLowerCase().includes(keyword)
  );
};

const compareValues = (
  left: string | number | undefined,
  right: string | number | undefined,
  order: string,
) => {
  const normalizedLeft = left ?? "";
  const normalizedRight = right ?? "";
  if (order === "desc") {
    return normalizedLeft < normalizedRight ? 1 : normalizedLeft > normalizedRight ? -1 : 0;
  }
  return normalizedLeft > normalizedRight ? 1 : normalizedLeft < normalizedRight ? -1 : 0;
};

export const getLanguageLabel = (lang: string) => PRESET_LANGUAGES[lang] || lang;

export const getFilteredGroups = (langSearch: string) =>
  LANGUAGE_GROUPS.map((group) => ({
    ...group,
    options: group.options.filter(
      (option) =>
        option.label.toLowerCase().includes(langSearch.toLowerCase()) ||
        option.value.toLowerCase().includes(langSearch.toLowerCase()),
    ),
  })).filter((group) => group.options.length > 0);

export const sortSnippets = (
  snippets: SnippetItem[],
  search: string,
  languageFilter: string,
  activeTag: string,
  sortValue: string,
) => {
  const [field, order] = sortValue.split(":") as [
    "updated_at" | "copy_count" | "created_at" | "title",
    string,
  ];
  return snippets
    .filter(
      (item) =>
        (!languageFilter || item.language === languageFilter) &&
        (!activeTag || item.tags?.includes(activeTag)) &&
        matchesSearch(item, search),
    )
    .sort((a, b) => {
      const left = field === "title" ? a[field] || "" : a[field];
      const right = field === "title" ? b[field] || "" : b[field];
      return compareValues(left, right, order);
    });
};

export const collectTags = (snippets: SnippetItem[], search: string, languageFilter: string) => {
  const counts: Record<string, number> = {};
  snippets
    .filter(
      (snippet) =>
        (!languageFilter || snippet.language === languageFilter) && matchesSearch(snippet, search),
    )
    .forEach((snippet) => {
      snippet.tags?.forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
};

export const collectLanguages = (snippets: SnippetItem[], search: string, activeTag: string) => {
  const counts: Record<string, number> = {};
  snippets
    .filter(
      (snippet) =>
        (!activeTag || snippet.tags?.includes(activeTag)) && matchesSearch(snippet, search),
    )
    .forEach((snippet) => {
      if (!snippet.language) return;
      counts[snippet.language] = (counts[snippet.language] || 0) + 1;
    });
  return Object.entries(counts)
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count);
};

export const highlightSnippetCode = (
  codeRefs: Record<string, HTMLElement | null>,
  snippets: SnippetItem[],
) => {
  snippets.forEach((snippet) => {
    const block = codeRefs[snippet.id];
    if (!block) return;
    try {
      const language =
        snippet.language && snippet.language !== "plaintext"
          ? snippet.language.toLowerCase()
          : undefined;
      const highlighted = language
        ? hljs.highlight(snippet.code, { language, ignoreIllegals: true })
        : hljs.highlightAuto(snippet.code);
      block.innerHTML = highlighted.value;
    } catch {
      block.textContent = snippet.code;
    }
  });
};

export const createSharePayload = (snippet: SnippetItem) => ({
  content: snippet.code,
  name: snippet.title || "代码片段分享",
  sourceId: snippet.id,
});

export const createUpdateSharePayload = (snippet: SnippetItem) => ({
  content: snippet.code,
  name: snippet.title || "代码片段分享",
});
