import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Copy, Check, Trash2, Edit2, Code2, Tag as TagIcon, ArrowRight, Save, X, Eye } from 'lucide-react';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

export default function CodeSnippetsTool() {
    const [snippets, setSnippets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [languageFilter, setLanguageFilter] = useState('');
    const [languages, setLanguages] = useState<any[]>([]);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({ title: '', code: '', language: 'plaintext', tags: '', description: '' });
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const codeRefs = useRef<{ [key: string]: HTMLElement | null }>({});

    useEffect(() => {
        fetchData();
        fetchLanguages();
    }, [search, languageFilter]);

    useEffect(() => {
        // highlight code blocks after render
        snippets.forEach(snippet => {
            const block = codeRefs.current[snippet.id];
            if (block) {
                // hljs.highlightElement(block);
                // We do it manually to avoid double highlight issues in react strict mode sometimes
                try {
                    const highlighted = hljs.highlightAuto(snippet.code, snippet.language && snippet.language !== 'plaintext' ? [snippet.language.toLowerCase()] : undefined);
                    block.innerHTML = highlighted.value;
                } catch (e) {
                    block.textContent = snippet.code;
                }
            }
        });
    }, [snippets, loading]);

    const fetchLanguages = async () => {
        try {
            const res = await fetch('/api/snippets/data/languages');
            if (res.ok) {
                const data = await res.json();
                setLanguages(data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            let url = '/api/snippets?limit=50';
            if (search) url += `&search=${encodeURIComponent(search)}`;
            if (languageFilter) url += `&language=${encodeURIComponent(languageFilter)}`;

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json() as { snippets: any[] };
                setSnippets(data.snippets || []);
            }
        } catch (e) {
            console.error('Fetch snippets failed', e);
        }
        setLoading(false);
    };

    const handleCopy = async (id: string, code: string) => {
        await navigator.clipboard.writeText(code);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);

        // notify backend of copy increment
        fetch(`/api/snippets/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ copyCountsDelta: { [id]: 1 } })
        });

        setSnippets(prev => prev.map(s => s.id === id ? { ...s, copy_count: (s.copy_count || 0) + 1 } : s));
    };

    const handleDelete = async (id: string) => {
        if (!confirm('确定删除此代码片段吗？')) return;

        try {
            const res = await fetch(`/api/snippets/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setSnippets(prev => prev.filter(s => s.id !== id));
            } else {
                alert('无法删除（可能由于权限或网络问题）');
            }
        } catch (e) {
            console.error(e);
        }
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

    const cancelEdit = () => {
        setEditingId(null);
        setIsCreating(false);
    };

    const saveSnippet = async () => {
        if (!formData.title || !formData.code) {
            alert('标题和代码不能为空');
            return;
        }

        const payload = {
            ...formData,
            tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
        };

        try {
            if (isCreating) {
                const res = await fetch('/api/snippets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    const newSnippet = await res.json();
                    setSnippets([newSnippet, ...snippets]);
                    setIsCreating(false);
                } else {
                    alert('保存失败');
                }
            } else if (editingId) {
                const res = await fetch(`/api/snippets/${editingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    const updatedSnippet = await res.json();
                    setSnippets(prev => prev.map(s => s.id === editingId ? updatedSnippet : s));
                    setEditingId(null);
                } else {
                    alert('更新失败，您可能没有权限');
                }
            }
        } catch (e) {
            console.error(e);
            alert('网络错误');
        }
    };

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-[var(--bg-surface)] p-4 rounded-2xl border border-[var(--border-color)]">
                <div className="flex items-center gap-2 flex-1 w-full max-w-lg relative">
                    <Search className="absolute left-3 w-5 h-5 text-[var(--text-secondary)]" />
                    <input
                        type="text"
                        placeholder="搜索代码片段标题、代码..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all"
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <select
                        value={languageFilter}
                        onChange={(e) => setLanguageFilter(e.target.value)}
                        className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-sm outline-none w-full md:w-auto"
                    >
                        <option value="">全部语言</option>
                        {languages.map(lang => (
                            <option key={lang.language} value={lang.language}>{lang.language} ({lang.count})</option>
                        ))}
                    </select>
                    <button
                        onClick={startCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-color)] text-white rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        新建片段
                    </button>
                </div>
            </div>

            {(isCreating || editingId) && (
                <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-color)] animate-in fade-in slide-in-from-top-4 relative z-10 shadow-xl">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold">{isCreating ? '新建代码片段' : '编辑代码片段'}</h3>
                        <button onClick={cancelEdit} className="p-1 hover:bg-[var(--hover-color)] rounded-lg text-[var(--text-secondary)]">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1">标题</label>
                            <input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl px-3 py-2 outline-none" placeholder="必填" />
                        </div>
                        <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1">语言</label>
                            <input value={formData.language} onChange={e => setFormData({ ...formData, language: e.target.value })} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl px-3 py-2 outline-none" placeholder="例如 javascript, sql, html..." />
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-xs text-[var(--text-secondary)] mb-1">代码内容</label>
                        <textarea
                            value={formData.code}
                            onChange={e => setFormData({ ...formData, code: e.target.value })}
                            className="w-full h-40 font-mono text-sm bg-black/80 text-green-400 border border-[var(--border-color)] rounded-xl px-3 py-3 outline-none whitespace-pre-wrap"
                            placeholder="粘贴您的代码..."
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1">标签 (逗号分隔)</label>
                            <input value={formData.tags} onChange={e => setFormData({ ...formData, tags: e.target.value })} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl px-3 py-2 outline-none" placeholder="react, hooks, util..." />
                        </div>
                        <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1">描述 (可选)</label>
                            <input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl px-3 py-2 outline-none" placeholder="简要说明" />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button onClick={cancelEdit} className="px-5 py-2 hover:bg-[var(--hover-color)] border border-[var(--border-color)] rounded-xl text-sm font-medium">取消</button>
                        <button onClick={saveSnippet} className="px-5 py-2 flex items-center gap-2 bg-[var(--accent-color)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
                            <Save className="w-4 h-4" />
                            保存
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-4 border-[var(--border-color)] border-t-[var(--accent-color)] animate-spin"></div>
                </div>
            ) : snippets.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-secondary)] mt-10 p-8 border border-dashed border-[var(--border-color)] rounded-3xl bg-[var(--bg-surface)]">
                    <Code2 className="w-12 h-12 mb-3 opacity-20" />
                    <p>没有找到匹配的代码片段</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-y-auto pr-2 custom-scrollbar">
                    {snippets.map(snippet => (
                        <div key={snippet.id} className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl flex flex-col overflow-hidden group hover:border-[var(--text-secondary)] transition-colors">
                            <div className="flex justify-between items-center px-4 py-3 bg-[var(--bg-main)] border-b border-[var(--border-color)]">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-8 h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center shrink-0">
                                        <Code2 className="w-4 h-4 text-[var(--accent-color)]" />
                                    </div>
                                    <div className="flex flex-col overflow-hidden">
                                        <h4 className="font-semibold text-sm truncate">{snippet.title}</h4>
                                        <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">{snippet.language}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleCopy(snippet.id, snippet.code)} className="p-1.5 hover:bg-[var(--hover-color)] rounded-lg text-[var(--text-secondary)] hover:text-white" title="复制代码">
                                        {copiedId === snippet.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                    <button onClick={() => startEdit(snippet)} className="p-1.5 hover:bg-[var(--hover-color)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent-color)]" title="编辑">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(snippet.id)} className="p-1.5 hover:bg-[var(--hover-color)] rounded-lg text-[var(--text-secondary)] hover:text-red-400" title="删除">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="relative overflow-hidden bg-[#0d1117]">
                                <pre className="text-xs p-4 overflow-auto max-h-60 font-mono text-gray-300 custom-scrollbar">
                                    <code
                                        ref={el => codeRefs.current[snippet.id] = el}
                                        className={`language-${snippet.language || 'plaintext'}`}
                                    >
                                        {snippet.code}
                                    </code>
                                </pre>
                                {copiedId === snippet.id && (
                                    <div className="absolute top-2 right-2 bg-green-500/20 text-green-400 border border-green-500/50 text-[10px] px-2 py-1 rounded backdrop-blur-md hidden md:flex items-center gap-1 animate-in fade-in">
                                        <Check className="w-3 h-3" /> 已复制
                                    </div>
                                )}
                            </div>

                            <div className="px-4 py-3 flex items-center justify-between border-t border-[var(--border-color)] mt-auto">
                                <div className="flex gap-2 items-center flex-wrap">
                                    {snippet.tags && snippet.tags.length > 0 ? (
                                        snippet.tags.map((tag: string, i: number) => (
                                            <span key={i} className="flex items-center gap-1 text-[10px] px-2 py-1 bg-[var(--hover-color)] rounded-md text-[var(--text-secondary)]">
                                                <TagIcon className="w-3 h-3" />
                                                {tag}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-[10px] text-[var(--text-secondary)] opacity-50 italic">无标签</span>
                                    )}
                                </div>
                                <div className="text-[10px] text-[var(--text-secondary)] shrink-0 flex items-center gap-1">
                                    <Copy className="w-3 h-3" />
                                    {snippet.copy_count || 0}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
