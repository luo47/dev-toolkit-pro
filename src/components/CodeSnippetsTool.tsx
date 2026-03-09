import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, Copy, Check, Trash2, Edit2, Code2, Save, X, ArrowUpDown, Tag } from 'lucide-react';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import xml from 'highlight.js/lib/languages/xml'; // html
import css from 'highlight.js/lib/languages/css';
import sql from 'highlight.js/lib/languages/sql';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import java from 'highlight.js/lib/languages/java';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import php from 'highlight.js/lib/languages/php';
import csharp from 'highlight.js/lib/languages/csharp';
import ruby from 'highlight.js/lib/languages/ruby';
import shell from 'highlight.js/lib/languages/shell';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import makefile from 'highlight.js/lib/languages/makefile';
import ini from 'highlight.js/lib/languages/ini';
import properties from 'highlight.js/lib/languages/properties';
import toml from 'highlight.js/lib/languages/ini'; // highlight.js uses ini for toml often, or has a toml-specific one. Let's try importing it.
import diff from 'highlight.js/lib/languages/diff';
// import 'highlight.js/styles/github-dark.css'; // 移除固定的暗色样式，改为使用 CSS 变量控制

// 注册常用语言
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('c', c);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('java', java);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('php', php);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('shell', shell);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('makefile', makefile);
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('properties', properties);
hljs.registerLanguage('toml', toml);
hljs.registerLanguage('diff', diff);
hljs.registerLanguage('plaintext', () => ({ name: 'plaintext', contains: [] }));

const SORT_OPTIONS = [
    { value: 'updated_at:desc', label: '最新修改' },
    { value: 'copy_count:desc', label: '复制次数' },
    { value: 'created_at:desc', label: '最新创建' },
    { value: 'title:asc', label: '标题排序' },
];

const LANGUAGE_GROUPS = [
    {
        label: '网页前端',
        options: [
            { value: 'html', label: 'html (xml)' },
            { value: 'css', label: 'css' },
            { value: 'javascript', label: 'javascript (js)' },
            { value: 'typescript', label: 'typescript (ts)' },
            { value: 'json', label: 'json' },
        ]
    },
    {
        label: '后端/通用',
        options: [
            { value: 'java', label: 'java' },
            { value: 'python', label: 'python (py)' },
            { value: 'php', label: 'php' },
            { value: 'c', label: 'c' },
            { value: 'cpp', label: 'cpp (c++)' },
            { value: 'csharp', label: 'csharp (cs)' },
            { value: 'go', label: 'go' },
            { value: 'rust', label: 'rust' },
            { value: 'ruby', label: 'ruby' },
        ]
    },
    {
        label: '脚本/运维',
        options: [
            { value: 'bash', label: 'bash (sh)' },
            { value: 'shell', label: 'shell' },
            { value: 'yaml', label: 'yaml (yml)' },
            { value: 'toml', label: 'toml' },
            { value: 'dockerfile', label: 'dockerfile' },
            { value: 'makefile', label: 'makefile' },
            { value: 'ini', label: 'ini' },
            { value: 'properties', label: 'properties' },
        ]
    },
    {
        label: '数据/文档',
        options: [
            { value: 'sql', label: 'sql' },
            { value: 'markdown', label: 'markdown (md)' },
            { value: 'diff', label: 'diff' },
            { value: 'plaintext', label: 'plaintext (text)' },
        ]
    }
];

const PRESET_LANGUAGES: Record<string, string> = {
    'javascript': 'js',
    'typescript': 'ts',
    'python': 'py',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'java': 'java',
    'php': 'php',
    'c': 'c',
    'cpp': 'cpp',
    'csharp': 'cs',
    'go': 'go',
    'rust': 'rust',
    'ruby': 'ruby',
    'bash': 'sh',
    'shell': 'sh',
    'yaml': 'yml',
    'sql': 'sql',
    'markdown': 'md',
    'dockerfile': 'docker',
    'makefile': 'make',
    'ini': 'ini',
    'properties': 'prop',
    'toml': 'toml',
    'diff': 'diff',
    'plaintext': 'txt'
};

// localStorage 键名
const LS_SORT = 'cs_filter_sort';
const LS_LANG = 'cs_filter_language';

export default function CodeSnippetsTool() {
    const [allSnippets, setAllSnippets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [languageFilter, setLanguageFilter] = useState('');
    const [sortValue, setSortValue] = useState(() => localStorage.getItem(LS_SORT) || 'updated_at:desc');
    const [activeTag, setActiveTag] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({ title: '', code: '', language: 'plaintext', tags: '', description: '' });
    const [langSearch, setLangSearch] = useState('');
    const [isLangOpen, setIsLangOpen] = useState(false);
    const langRef = useRef<HTMLDivElement>(null);
    const codeRefs = useRef<{ [key: string]: HTMLElement | null }>({});
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // 点击外部关闭语言选择器
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (langRef.current && !langRef.current.contains(e.target as Node)) {
                setIsLangOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 过滤后的语言分组
    const filteredGroups = LANGUAGE_GROUPS.map(group => ({
        ...group,
        options: group.options.filter(opt => 
            opt.label.toLowerCase().includes(langSearch.toLowerCase()) || 
            opt.value.toLowerCase().includes(langSearch.toLowerCase())
        )
    })).filter(group => group.options.length > 0);

    // 获取当前已有的缩写
    const getLanguageLabel = (lang: string) => {
        return PRESET_LANGUAGES[lang] || lang;
    };

    // 获取全量数据
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // 获取较多数据以供本地筛选，这里增加 limit 到 1000 或更高
            const res = await fetch('/api/snippets?limit=2000');
            if (res.ok) {
                const data = await res.json() as { snippets: any[] };
                setAllSnippets(data.snippets || []);
            }
        } catch { }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // 本地计算筛选和排序结果
    const snippets = React.useMemo(() => {
        let result = [...allSnippets];

        // 搜索过滤
        if (search) {
            const s = search.toLowerCase();
            result = result.filter(item => 
                (item.title || '').toLowerCase().includes(s) || 
                (item.code || '').toLowerCase().includes(s) || 
                (item.description || '').toLowerCase().includes(s)
            );
        }

        // 语言过滤
        if (languageFilter) {
            result = result.filter(item => item.language === languageFilter);
        }

        // 标签过滤
        if (activeTag) {
            result = result.filter(item => item.tags && item.tags.includes(activeTag));
        }

        // 排序
        const [field, order] = sortValue.split(':');
        result.sort((a, b) => {
            let v1 = a[field];
            let v2 = b[field];

            if (field === 'title') {
                v1 = v1 || '';
                v2 = v2 || '';
            }

            if (order === 'desc') {
                return v1 < v2 ? 1 : v1 > v2 ? -1 : 0;
            } else {
                return v1 > v2 ? 1 : v1 < v2 ? -1 : 0;
            }
        });

        return result;
    }, [allSnippets, search, languageFilter, activeTag, sortValue]);

    // 本地计算标签统计 (联动：受语言和搜索影响)
    const allTags = React.useMemo(() => {
        const counts: Record<string, number> = {};
        const sFilter = search.toLowerCase();
        allSnippets.forEach(s => {
            // 语言联动
            if (languageFilter && s.language !== languageFilter) return;
            // 搜索联动
            if (search && !(
                (s.title || '').toLowerCase().includes(sFilter) || 
                (s.code || '').toLowerCase().includes(sFilter) || 
                (s.description || '').toLowerCase().includes(sFilter)
            )) return;

            if (Array.isArray(s.tags)) {
                s.tags.forEach(tag => {
                    counts[tag] = (counts[tag] || 0) + 1;
                });
            }
        });
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [allSnippets, languageFilter, search]);

    // 本地计算语言统计 (联动：受标签和搜索影响)
    const languages = React.useMemo(() => {
        const counts: Record<string, number> = {};
        const sFilter = search.toLowerCase();
        allSnippets.forEach(s => {
            // 标签联动
            if (activeTag && !(Array.isArray(s.tags) && s.tags.includes(activeTag))) return;
            // 搜索联动
            if (search && !(
                (s.title || '').toLowerCase().includes(sFilter) || 
                (s.code || '').toLowerCase().includes(sFilter) || 
                (s.description || '').toLowerCase().includes(sFilter)
            )) return;

            if (s.language) {
                counts[s.language] = (counts[s.language] || 0) + 1;
            }
        });
        return Object.entries(counts)
            .map(([language, count]) => ({ language, count }))
            .sort((a, b) => b.count - a.count);
    }, [allSnippets, activeTag, search]);

    // 高亮代码
    useEffect(() => {
        snippets.forEach(snippet => {
            const block = codeRefs.current[snippet.id];
            if (block) {
                try {
                    const lang = snippet.language && snippet.language !== 'plaintext' ? snippet.language.toLowerCase() : undefined;
                    const highlighted = lang ? hljs.highlight(snippet.code, { language: lang, ignoreIllegals: true }) : hljs.highlightAuto(snippet.code);
                    block.innerHTML = highlighted.value;
                } catch {
                    if (block) block.textContent = snippet.code;
                }
            }
        });
    }, [snippets]);

    // 持久化排序和语言
    const handleSortChange = (val: string) => {
        setSortValue(val);
        localStorage.setItem(LS_SORT, val);
    };
    const handleLanguageChange = (val: string) => {
        setLanguageFilter(prev => prev === val ? '' : val);
    };

    const handleTagClick = (tag: string) => {
        setActiveTag(prev => prev === tag ? '' : tag);
    };

    const handleCopy = async (id: string, code: string) => {
        await navigator.clipboard.writeText(code);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
        fetch(`/api/snippets/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ copyCountsDelta: { [id]: 1 } })
        });
        setAllSnippets(prev => prev.map(s => s.id === id ? { ...s, copy_count: (s.copy_count || 0) + 1 } : s));
    };

    const handleDelete = async (id: string) => {
        if (!confirm('确定删除此代码片段吗？')) return;
        const res = await fetch(`/api/snippets/${id}`, { method: 'DELETE' });
        if (res.ok) {
            setAllSnippets(prev => prev.filter(s => s.id !== id));
        } else alert('无法删除（可能由于权限问题）');
    };

    const startEdit = (snippet: any) => {
        setEditingId(snippet.id);
        setIsCreating(false);
        setFormData({
            title: snippet.title,
            code: snippet.code,
            language: snippet.language || 'plaintext',
            description: snippet.description || '',
            tags: Array.isArray(snippet.tags) ? snippet.tags.join(', ') : ''
        });
        setTimeout(() => textareaRef.current?.focus(), 100);
    };

    const startCreate = () => {
        setIsCreating(true);
        setEditingId(null);
        setFormData({ title: '', code: '', language: 'plaintext', description: '', tags: '' });
        setTimeout(() => textareaRef.current?.focus(), 100);
    };

    const cancelEdit = () => { setEditingId(null); setIsCreating(false); };

    const saveSnippet = async () => {
        if (!formData.code) { alert('代码不能为空'); return; }
        const payload = { ...formData, tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean) };
        try {
            if (isCreating) {
                const res = await fetch('/api/snippets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (res.ok) { 
                    const newSnippet = await res.json();
                    setAllSnippets([newSnippet, ...allSnippets]); 
                    setIsCreating(false); 
                }
                else alert('保存失败');
            } else if (editingId) {
                const res = await fetch(`/api/snippets/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (res.ok) { 
                    setAllSnippets(prev => prev.map(s => s.id === editingId ? { ...s, ...payload } : s)); 
                    setEditingId(null); 
                }
                else alert('更新失败，您可能没有权限');
            }
        } catch { alert('网络错误'); }
    };

    return (
        <div className="flex flex-col h-full gap-1.5">

            {/* ── 工具栏 ── */}
            <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] px-1.5 py-1 rounded-xl border border-[var(--border-color)]">
                {/* 搜索框 */}
                <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-4 text-[var(--text-secondary)] pointer-events-none" />
                    <input
                        type="text"
                        placeholder="搜索片段..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-7 pr-2 py-1 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all placeholder:text-xs"
                    />
                </div>

                {/* 排序 */}
                <div className="relative shrink-0">
                    <ArrowUpDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-secondary)] pointer-events-none" />
                    <select
                        value={sortValue}
                        onChange={e => handleSortChange(e.target.value)}
                        className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg pl-6 pr-2 py-1 text-xs outline-none cursor-pointer hover:border-[var(--text-secondary)] transition-colors min-w-[90px]"
                    >
                        {SORT_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </div>

                {/* 新建按钮 */}
                <button
                    onClick={startCreate}
                    className="flex items-center justify-center p-1.5 bg-[var(--accent-color)] text-white rounded-lg hover:opacity-90 transition-opacity shrink-0"
                    title="新建片段"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            {/* ── 语言筛选标签栏 ── */}
            <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-0.5 shrink-0 px-0.5 min-h-[26px]">
                {languageFilter ? (
                    <button
                        onClick={() => handleLanguageChange('')}
                        className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border bg-[var(--accent-color)] border-[var(--accent-color)] text-white font-medium shadow-sm transition-all whitespace-nowrap flex items-center gap-1"
                    >
                        <X className="w-2.5 h-2.5" />
                        {getLanguageLabel(languageFilter)}
                        <span className="ml-1 opacity-60">
                            {languages.find(l => l.language === languageFilter)?.count || 0}
                        </span>
                    </button>
                ) : (
                    languages
                        .filter(opt => opt.language !== '')
                        .map(opt => (
                            <button
                                key={opt.language}
                                onClick={() => handleLanguageChange(opt.language)}
                                className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)] transition-all whitespace-nowrap"
                            >
                                {getLanguageLabel(opt.language)}
                                <span className="ml-1 opacity-60">{opt.count}</span>
                            </button>
                        ))
                )}
            </div>

            {/* ── 标签导航栏 ── */}
            {allTags.length > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-0.5 shrink-0 min-h-[26px]">
                    <Tag className="w-3 h-3 text-[var(--text-secondary)] shrink-0 ml-0.5" />
                    {activeTag ? (
                        <button
                            onClick={() => setActiveTag('')}
                            className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border bg-[var(--accent-color)] border-[var(--accent-color)] text-white font-medium shadow-sm transition-all whitespace-nowrap flex items-center gap-1"
                        >
                            <X className="w-2.5 h-2.5" />
                            {activeTag}
                            <span className="ml-1 opacity-60">
                                {allTags.find(t => t.name === activeTag)?.count || 0}
                            </span>
                        </button>
                    ) : (
                        allTags.map(tag => (
                            <button
                                key={tag.name}
                                onClick={() => handleTagClick(tag.name)}
                                className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)] transition-all whitespace-nowrap"
                            >
                                {tag.name}
                                <span className="ml-1 opacity-60">{tag.count}</span>
                            </button>
                        ))
                    )}
                </div>
            )}

            {/* ── 编辑/新建表单 ── */}
            {(isCreating || editingId) && (
                <div className="bg-[var(--bg-surface)] p-4 rounded-2xl border border-[var(--border-color)] animate-in fade-in slide-in-from-top-4 z-10 shadow-xl">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-base font-bold">{isCreating ? '新建代码片段' : '编辑代码片段'}</h3>
                        <button onClick={cancelEdit} className="p-1 hover:bg-[var(--hover-color)] rounded-lg text-[var(--text-secondary)]"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1">标题</label>
                            <input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-sm outline-none" placeholder="片段标题" />
                        </div>
                        <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1">语言</label>
                            <div className="relative" ref={langRef}>
                                <div
                                    onClick={() => setIsLangOpen(!isLangOpen)}
                                    className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-sm outline-none cursor-pointer flex justify-between items-center hover:border-[var(--text-secondary)] transition-colors"
                                >
                                    <span className="truncate">{formData.language}</span>
                                    <ArrowUpDown className="w-3 h-3 opacity-50" />
                                </div>

                                {isLangOpen && (
                                    <div className="absolute top-full left-0 w-full mt-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                        <div className="p-2 border-b border-[var(--border-color)] bg-[var(--bg-main)]">
                                            <div className="relative">
                                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-50" />
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    placeholder="搜索语言..."
                                                    value={langSearch}
                                                    onChange={e => setLangSearch(e.target.value)}
                                                    className="w-full pl-7 pr-2 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg text-xs outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                                                />
                                            </div>
                                        </div>
                                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                                            {filteredGroups.length === 0 ? (
                                                <div className="py-8 text-center text-xs text-[var(--text-secondary)]">未找到匹配项</div>
                                            ) : (
                                                filteredGroups.map(group => (
                                                    <div key={group.label} className="mb-2 last:mb-0">
                                                        <div className="px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{group.label}</div>
                                                        {group.options.map(opt => (
                                                            <div
                                                                key={opt.value}
                                                                onClick={() => {
                                                                    setFormData({ ...formData, language: opt.value });
                                                                    setIsLangOpen(false);
                                                                    setLangSearch('');
                                                                }}
                                                                className={`px-2.5 py-1.5 text-xs rounded-lg cursor-pointer transition-colors ${formData.language === opt.value
                                                                        ? 'bg-[var(--accent-color)] text-white'
                                                                        : 'hover:bg-[var(--hover-color)]'
                                                                    }`}
                                                            >
                                                                {opt.label}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="mb-3">
                        <label className="block text-xs text-[var(--text-secondary)] mb-1">代码内容 <span className="text-red-400">*</span></label>
                        <textarea
                            ref={textareaRef}
                            value={formData.code}
                            onChange={e => setFormData({ ...formData, code: e.target.value })}
                            className="w-full h-36 font-mono text-sm bg-[var(--code-bg)] text-[var(--code-text)] border border-[var(--border-color)] rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--accent-color)]/20 transition-all resize-vertical custom-scrollbar-thin"
                            placeholder="粘贴您的代码..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1">标签 (逗号分隔)</label>
                            <input value={formData.tags} onChange={e => setFormData({ ...formData, tags: e.target.value })} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-sm outline-none" placeholder="react, hooks..." />
                        </div>
                        <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1">描述</label>
                            <input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-sm outline-none" placeholder="可选" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={cancelEdit} className="px-4 py-1.5 border border-[var(--border-color)] rounded-lg text-sm hover:bg-[var(--hover-color)]">取消</button>
                        <button onClick={saveSnippet} className="px-4 py-1.5 flex items-center gap-1.5 bg-[var(--accent-color)] text-white rounded-lg text-sm font-medium hover:opacity-90">
                            <Save className="w-4 h-4" />保存
                        </button>
                    </div>
                </div>
            )}

            {/* ── 列表 ── */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-4 border-[var(--border-color)] border-t-[var(--accent-color)] animate-spin" />
                </div>
            ) : snippets.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)] p-8 border border-dashed border-[var(--border-color)] rounded-3xl bg-[var(--bg-surface)]">
                    <Code2 className="w-12 h-12 opacity-20" />
                    <p className="text-sm">没有找到匹配的代码片段</p>
                    {activeTag && (
                        <button onClick={() => setActiveTag('')} className="text-xs text-[var(--accent-color)] hover:underline">
                            清除标签筛选「{activeTag}」
                        </button>
                    )}
                </div>
            ) : (
                /* 移动端单列，≥sm 两列，≥xl 三列 */
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 overflow-y-auto custom-scrollbar pb-1">
                    {snippets.map(snippet => (
                        <div key={snippet.id} className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl flex flex-col overflow-hidden hover:border-[var(--text-secondary)] transition-colors group">

                            {/* 卡片头部 */}
                            <div className="flex items-center justify-between px-2.5 py-1.5 bg-[var(--bg-main)] border-b border-[var(--border-color)]">
                                <div className="flex items-center gap-2 overflow-hidden min-w-0">
                                    <Code2 className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0" />
                                    <div className="overflow-hidden">
                                        <div className="text-xs font-medium truncate leading-tight">
                                            {snippet.title || ""}
                                        </div>
                                        {snippet.language && (
                                            <div className="flex items-center mt-0.5">
                                                <span className="text-[9px] px-1.5 py-0 bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20 rounded-full font-medium uppercase tracking-wider leading-tight">
                                                    {snippet.language}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {/* 操作按钮：copy_count + 操作图标 */}
                                <div className="flex items-center gap-0.5 shrink-0">
                                    <span className="text-[9px] text-[var(--text-secondary)] mr-1">{snippet.copy_count || 0}</span>
                                    <button onClick={() => handleCopy(snippet.id, snippet.code)} className="p-1.5 hover:bg-[var(--hover-color)] rounded-md text-[var(--text-secondary)]" title="复制">
                                        {copiedId === snippet.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>
                                    <button onClick={() => startEdit(snippet)} className="p-1.5 hover:bg-[var(--hover-color)] rounded-md text-[var(--text-secondary)]" title="编辑">
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => handleDelete(snippet.id)} className="p-1.5 hover:bg-[var(--hover-color)] rounded-md text-[var(--text-secondary)] hover:text-red-400" title="删除">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* 代码区 */}
                            <div className="relative bg-[var(--code-bg)] flex-1 overflow-hidden min-h-[60px] flex flex-col">
                                <pre className="text-xs p-3 pb-5 overflow-auto max-h-32 font-mono text-[var(--code-text)] custom-scrollbar-thin leading-tight flex-1">
                                    <code ref={el => { codeRefs.current[snippet.id] = el; }} className={`language-${snippet.language || 'plaintext'}`}>
                                        {snippet.code}
                                    </code>
                                </pre>
                                {copiedId === snippet.id && (
                                    <div className="absolute top-1.5 right-1.5 bg-green-500/20 text-green-400 border border-green-500/50 text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 animate-in fade-in">
                                        <Check className="w-2.5 h-2.5" /> 已复制
                                    </div>
                                )}
                            </div>

                            {/* 标签区 */}
                            <div className={`px-2.5 py-1 flex items-center gap-1 flex-wrap border-t border-[var(--border-color)] ${!snippet.tags || snippet.tags.length === 0 ? 'h-0 py-0 border-none' : ''}`}>
                                {snippet.tags && snippet.tags.length > 0 && 
                                    snippet.tags.slice(0, 4).map((tag: string, i: number) => (
                                        <button
                                            key={i}
                                            onClick={() => handleTagClick(tag)}
                                            className={`text-[9px] px-1.5 py-0.5 rounded transition-colors cursor-pointer ${activeTag === tag
                                                    ? 'bg-[var(--accent-color)]/20 text-[var(--accent-color)] border border-[var(--accent-color)]/40'
                                                    : 'bg-[var(--hover-color)] text-[var(--text-secondary)] hover:text-[var(--accent-color)]'
                                                }`}
                                        >
                                            {tag}
                                        </button>
                                    ))
                                }
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
