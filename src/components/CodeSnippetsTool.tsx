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
import 'highlight.js/styles/github-dark.css';

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
hljs.registerLanguage('plaintext', () => ({ name: 'plaintext', contains: [] }));

const SORT_OPTIONS = [
    { value: 'updated_at:desc', label: '最新修改' },
    { value: 'copy_count:desc', label: '复制次数' },
    { value: 'created_at:desc', label: '最新创建' },
    { value: 'title:asc', label: '标题排序' },
];

const PRESET_LANGUAGES = [
    'plaintext', 'javascript', 'typescript', 'python', 'html', 'css',
    'sql', 'json', 'yaml', 'markdown', 'bash', 'c', 'cpp', 'java', 'go', 'rust'
];

// localStorage 键名
const LS_SORT = 'cs_filter_sort';
const LS_LANG = 'cs_filter_language';

export default function CodeSnippetsTool() {
    const [snippets, setSnippets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [languageFilter, setLanguageFilter] = useState(() => localStorage.getItem(LS_LANG) || '');
    const [sortValue, setSortValue] = useState(() => localStorage.getItem(LS_SORT) || 'updated_at:desc');
    const [activeTag, setActiveTag] = useState('');
    const [allTags, setAllTags] = useState<{ name: string; count: number }[]>([]);
    const [languages, setLanguages] = useState<any[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({ title: '', code: '', language: 'plaintext', tags: '', description: '' });
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const codeRefs = useRef<{ [key: string]: HTMLElement | null }>({});

    // 获取合并后的语言列表
    const getCombinedLanguages = () => {
        const dynamicLangs = languages.map(l => l.language).filter(Boolean);
        const combined = new Set([...PRESET_LANGUAGES, ...dynamicLangs]);
        return Array.from(combined).sort();
    };

    // 构建查询参数并拉取数据
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [sort, order] = sortValue.split(':');
            let url = `/api/snippets?limit=100&sort=${sort}&order=${order}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            if (languageFilter) url += `&language=${encodeURIComponent(languageFilter)}`;
            if (activeTag) url += `&tag=${encodeURIComponent(activeTag)}`;

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json() as { snippets: any[] };
                setSnippets(data.snippets || []);
                // 从返回的数据中提取标签统计
                const tagCounts: Record<string, number> = {};
                (data.snippets || []).forEach((s: any) => {
                    (s.tags || []).forEach((tag: string) => {
                        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                    });
                });
                const tags = Object.entries(tagCounts)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count);
                setAllTags(tags);
            }
        } catch { }
        setLoading(false);
    }, [search, languageFilter, sortValue, activeTag]);

    const fetchLanguages = async () => {
        try {
            const res = await fetch('/api/snippets/data/languages');
            if (res.ok) setLanguages(await res.json());
        } catch { }
    };

    useEffect(() => {
        fetchData();
        fetchLanguages();
    }, [fetchData]);

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
    }, [snippets, loading]);

    // 持久化排序和语言
    const handleSortChange = (val: string) => {
        setSortValue(val);
        localStorage.setItem(LS_SORT, val);
    };
    const handleLanguageChange = (val: string) => {
        setLanguageFilter(val);
        localStorage.setItem(LS_LANG, val);
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
        setSnippets(prev => prev.map(s => s.id === id ? { ...s, copy_count: (s.copy_count || 0) + 1 } : s));
    };

    const handleDelete = async (id: string) => {
        if (!confirm('确定删除此代码片段吗？')) return;
        const res = await fetch(`/api/snippets/${id}`, { method: 'DELETE' });
        if (res.ok) setSnippets(prev => prev.filter(s => s.id !== id));
        else alert('无法删除（可能由于权限问题）');
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
    };

    const startCreate = () => {
        setIsCreating(true);
        setEditingId(null);
        setFormData({ title: '', code: '', language: 'plaintext', description: '', tags: '' });
    };

    const cancelEdit = () => { setEditingId(null); setIsCreating(false); };

    const saveSnippet = async () => {
        if (!formData.code) { alert('代码不能为空'); return; }
        const payload = { ...formData, tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean) };
        try {
            if (isCreating) {
                const res = await fetch('/api/snippets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (res.ok) { setSnippets([await res.json(), ...snippets]); setIsCreating(false); }
                else alert('保存失败');
            } else if (editingId) {
                const res = await fetch(`/api/snippets/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (res.ok) { setSnippets(prev => prev.map(s => s.id === editingId ? { ...s, ...payload } : s)); setEditingId(null); }
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

                {/* 语言筛选 */}
                <select
                    value={languageFilter}
                    onChange={e => handleLanguageChange(e.target.value)}
                    className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg px-2 py-1 text-xs outline-none shrink-0 min-w-[90px] cursor-pointer hover:border-[var(--text-secondary)] transition-colors"
                >
                    <option value="">所有语言</option>
                    {getCombinedLanguages().map(lang => (
                        <option key={lang} value={lang}>{lang}</option>
                    ))}
                </select>

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
                    className="flex items-center gap-1 px-2.5 py-1 bg-[var(--accent-color)] text-white rounded-lg hover:opacity-90 transition-opacity text-xs font-medium shrink-0"
                >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">新建片段</span>
                    <span className="sm:hidden">新建</span>
                </button>
            </div>

            {/* ── 标签导航栏 ── */}
            {allTags.length > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-0.5 shrink-0">
                    <Tag className="w-3 h-3 text-[var(--text-secondary)] shrink-0 ml-0.5" />
                    {allTags.map(tag => (
                        <button
                            key={tag.name}
                            onClick={() => handleTagClick(tag.name)}
                            className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border transition-all whitespace-nowrap ${activeTag === tag.name
                                    ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white font-medium'
                                    : 'bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]'
                                }`}
                        >
                            {tag.name}
                            <span className="ml-1 opacity-60">{tag.count}</span>
                        </button>
                    ))}
                    {activeTag && (
                        <button
                            onClick={() => setActiveTag('')}
                            className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border border-dashed border-[var(--border-color)] text-[var(--text-secondary)] hover:border-red-400 hover:text-red-400 transition-all whitespace-nowrap flex items-center gap-0.5"
                        >
                            <X className="w-2.5 h-2.5" />清除
                        </button>
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
                            <select
                                value={formData.language}
                                onChange={e => setFormData({ ...formData, language: e.target.value })}
                                className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-sm outline-none cursor-pointer"
                            >
                                {getCombinedLanguages().map(lang => (
                                    <option key={lang} value={lang}>{lang}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="mb-3">
                        <label className="block text-xs text-[var(--text-secondary)] mb-1">代码内容 <span className="text-red-400">*</span></label>
                        <textarea
                            value={formData.code}
                            onChange={e => setFormData({ ...formData, code: e.target.value })}
                            className="w-full h-36 font-mono text-sm bg-black/80 text-green-400 border border-[var(--border-color)] rounded-lg px-3 py-2 outline-none resize-vertical"
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
                                            {snippet.title || <span className="text-[var(--text-secondary)] italic">无标题</span>}
                                        </div>
                                        {snippet.language && (
                                            <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider leading-tight opacity-70">{snippet.language}</div>
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
                            <div className="relative bg-[#0d1117] flex-1">
                                <pre className="text-xs p-2 overflow-auto max-h-32 font-mono text-gray-300 custom-scrollbar leading-tight">
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
                            <div className="px-2.5 py-1 flex items-center gap-1 flex-wrap border-t border-[var(--border-color)]">
                                {snippet.tags && snippet.tags.length > 0 ? (
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
                                ) : (
                                    <span className="text-[9px] text-[var(--text-secondary)] opacity-40 italic">无标签</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
