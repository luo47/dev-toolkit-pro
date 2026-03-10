import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Save, 
  ArrowRight,
  X
} from 'lucide-react';
import { JSONPath } from 'jsonpath-plus';
import { useAppStore } from '../store';
import '../types';
import { 
  Step, 
  StepType, 
  SavedChain, 
  STEP_CONFIG, 
  DEFAULT_PROXY_STEPS, 
  DEFAULT_SMB_STEPS, 
  DEFAULT_PROXY_LINK_STEPS 
} from './ChainProcessor/ChainTypes';
import IOSection from './ChainProcessor/IOSection';
import StepItem from './ChainProcessor/StepItem';
import ChainLibrary from './ChainProcessor/ChainLibrary';

export default function ChainProcessor() {
  const { user, isDarkMode } = useAppStore();
  const [input, setInput] = useState('');
  const [steps, setSteps] = useState<Step[]>([]);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<{ stepId: string; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedChains, setSavedChains] = useState<SavedChain[]>([]);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newChainName, setNewChainName] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setInput(content);
    };
    reader.readAsText(file);
  };

  const processChain = useCallback(() => {
    setError(null);
    if (!input.trim()) {
      setOutput('');
      return;
    }
    let current = input;

    try {
      for (const step of steps) {
        if (!step.active) continue;

        try {
          switch (step.type) {
            case 'jsonpath': {
              const json = JSON.parse(current);
              const paths = step.value.split('||').map(p => p.trim());
              let result: any = undefined;
              for (const path of paths) {
                const searchResult = JSONPath({ path, json, wrap: false });
                if (searchResult !== undefined && searchResult !== null && (Array.isArray(searchResult) ? searchResult.length > 0 : true)) {
                  result = searchResult;
                  break;
                }
              }
              current = result === undefined ? 'undefined' : (typeof result === 'string' ? result : JSON.stringify(result, null, 2));
              break;
            }
            case 'xpath': {
              const parser = new DOMParser();
              const doc = parser.parseFromString(current, 'text/html');
              const result = doc.evaluate(step.value, doc, null, XPathResult.ANY_TYPE, null);
              if (result.resultType === XPathResult.STRING_TYPE) current = result.stringValue;
              else if (result.resultType === XPathResult.NUMBER_TYPE) current = result.numberValue.toString();
              else if (result.resultType === XPathResult.BOOLEAN_TYPE) current = result.booleanValue.toString();
              else {
                const nodes = [];
                let node = result.iterateNext();
                while (node) { nodes.push(node.textContent); node = result.iterateNext(); }
                current = nodes.join('\n');
              }
              break;
            }
            case 'css': {
              if (!step.value.trim()) { current = ''; break; }
              const parser = new DOMParser();
              const doc = parser.parseFromString(current, 'text/html');
              let selector = step.value;
              let attr: string | null = null;
              if (selector.includes(' @')) {
                const parts = selector.split(' @');
                attr = parts.pop()?.trim() || null;
                selector = parts.join(' @').trim();
              } else if (selector.includes('@') && !selector.includes('[') && !selector.includes('=')) {
                const lastAt = selector.lastIndexOf('@');
                attr = selector.substring(lastAt + 1).trim();
                selector = selector.substring(0, lastAt).trim();
              }
              try {
                const elements = doc.querySelectorAll(selector || '*');
                if (attr) {
                  if (attr.toLowerCase() === 'outerhtml') current = Array.from(elements).map(el => el.outerHTML).join('\n');
                  else if (attr.toLowerCase() === 'innerhtml') current = Array.from(elements).map(el => el.innerHTML).join('\n');
                  else current = Array.from(elements).map(el => el.getAttribute(attr!)).filter(val => val !== null).join('\n');
                } else current = Array.from(elements).map(el => el.textContent).join('\n');
              } catch (e) { throw new Error(`CSS 选择器错误: ${e instanceof Error ? e.message : String(e)}`); }
              break;
            }
            case 'js': {
              let inputData: any = current;
              if (typeof current === 'string' && (current.trim().startsWith('{') || current.trim().startsWith('['))) {
                try { inputData = JSON.parse(current); } catch (e) {}
              } else if (current === 'undefined') inputData = undefined;
              const fn = new Function('input', step.value);
              const result = fn(inputData);
              current = typeof result === 'object' && result !== null ? JSON.stringify(result, null, 2) : String(result);
              break;
            }
            case 'base64-encode': current = btoa(unescape(encodeURIComponent(current))); break;
            case 'base64-decode': current = decodeURIComponent(escape(atob(current))); break;
            case 'url-encode': current = encodeURIComponent(current); break;
            case 'url-decode': current = decodeURIComponent(current); break;
            case 'trim': current = current.trim(); break;
            case 'lowercase': current = current.toLowerCase(); break;
            case 'uppercase': current = current.toUpperCase(); break;
            case 'json-beautify': current = JSON.stringify(JSON.parse(current), null, 2); break;
            case 'json-compress': current = JSON.stringify(JSON.parse(current)); break;
            case 'xml-beautify': {
              const parser = new DOMParser();
              let xmlDoc: Document;
              let isHTML = false;
              xmlDoc = parser.parseFromString(current, 'application/xml');
              if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
                xmlDoc = parser.parseFromString(current, 'text/html');
                isHTML = true;
              }
              const formatNode = (node: Node, level: number = 0): string => {
                const indent = '  '.repeat(level);
                let result = '';
                if (node.nodeType === Node.ELEMENT_NODE) {
                  const element = node as Element;
                  const tagName = isHTML ? element.tagName.toLowerCase() : element.tagName;
                  result += `\n${indent}<${tagName}`;
                  for (let i = 0; i < element.attributes.length; i++) {
                    const attr = element.attributes[i];
                    result += ` ${attr.name}="${attr.value}"`;
                  }
                  const isVoid = isHTML && ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'].includes(tagName);
                  if (element.childNodes.length === 0) {
                    result += isVoid ? '>' : '/>';
                  } else {
                    result += '>';
                    let hasChildElements = false;
                    for (let i = 0; i < element.childNodes.length; i++) {
                      if (element.childNodes[i].nodeType === Node.ELEMENT_NODE) { hasChildElements = true; break; }
                    }
                    for (let i = 0; i < element.childNodes.length; i++) {
                      result += formatNode(element.childNodes[i], level + 1);
                    }
                    if (hasChildElements) result += `\n${indent}</${tagName}>`;
                    else result += `</${tagName}>`;
                  }
                } else if (node.nodeType === Node.TEXT_NODE) {
                  const text = node.textContent?.trim();
                  if (text) result += text;
                } else if (node.nodeType === Node.COMMENT_NODE) {
                  result += `\n${indent}<!--${node.textContent}-->`;
                }
                return result;
              };
              if (isHTML) {
                let output = '';
                const head = xmlDoc.head;
                const body = xmlDoc.body;
                if (head) { for (let i = 0; i < head.childNodes.length; i++) output += formatNode(head.childNodes[i], 0); }
                if (body) { for (let i = 0; i < body.childNodes.length; i++) output += formatNode(body.childNodes[i], 0); }
                current = output.trim();
              } else {
                const decMatch = current.match(/^<\?xml.*?\?>/i);
                const dec = decMatch ? decMatch[0] + '\n' : '';
                current = dec + formatNode(xmlDoc.documentElement).trim();
              }
              break;
            }
            case 'xml-compress': {
              const parser = new DOMParser();
              let xmlDoc: Document;
              let isHTML = false;
              xmlDoc = parser.parseFromString(current, 'application/xml');
              if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
                xmlDoc = parser.parseFromString(current, 'text/html');
                isHTML = true;
              }
              const serialize = (node: Node): string => {
                let result = '';
                if (node.nodeType === Node.ELEMENT_NODE) {
                  const element = node as Element;
                  const tagName = isHTML ? element.tagName.toLowerCase() : element.tagName;
                  result += `<${tagName}`;
                  for (let i = 0; i < element.attributes.length; i++) {
                    const attr = element.attributes[i];
                    result += ` ${attr.name}="${attr.value}"`;
                  }
                  const isVoid = isHTML && ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'].includes(tagName);
                  if (element.childNodes.length === 0) result += isVoid ? '>' : '/>';
                  else {
                    result += '>';
                    for (let i = 0; i < element.childNodes.length; i++) result += serialize(element.childNodes[i]);
                    result += `</${tagName}>`;
                  }
                } else if (node.nodeType === Node.TEXT_NODE) result += node.textContent?.trim() || '';
                return result;
              };
              if (isHTML) {
                let output = '';
                const head = xmlDoc.head; const body = xmlDoc.body;
                if (head) { for (let i = 0; i < head.childNodes.length; i++) output += serialize(head.childNodes[i]); }
                if (body) { for (let i = 0; i < body.childNodes.length; i++) output += serialize(body.childNodes[i]); }
                current = output;
              } else {
                const decMatch = current.match(/^<\?xml.*?\?>/i);
                const dec = decMatch ? decMatch[0] : '';
                current = dec + serialize(xmlDoc.documentElement);
              }
              break;
            }
            case 'xml-to-json': {
              const parser = new DOMParser();
              const xmlDoc = parser.parseFromString(current, 'application/xml');
              if (xmlDoc.getElementsByTagName('parsererror').length > 0) throw new Error('无效的 XML 格式');
              const nodeToJson = (node: Node): any => {
                if (node.nodeType === Node.TEXT_NODE) return node.textContent?.trim() || '';
                if (node.nodeType === Node.ELEMENT_NODE) {
                  const element = node as Element; const obj: any = {};
                  for (let i = 0; i < element.attributes.length; i++) {
                    const attr = element.attributes[i]; obj[`@${attr.name}`] = attr.value;
                  }
                  for (let i = 0; i < element.childNodes.length; i++) {
                    const child = element.childNodes[i];
                    if (child.nodeType === Node.ELEMENT_NODE) {
                      const childName = (child as Element).tagName; const childJson = nodeToJson(child);
                      if (obj[childName]) {
                        if (!Array.isArray(obj[childName])) obj[childName] = [obj[childName]];
                        obj[childName].push(childJson);
                      } else obj[childName] = childJson;
                    } else if (child.nodeType === Node.TEXT_NODE) {
                      const text = child.textContent?.trim();
                      if (text) {
                        if (Object.keys(obj).length === 0 && element.childNodes.length === 1) return text;
                        obj['#text'] = text;
                      }
                    }
                  }
                  return obj;
                }
                return null;
              };
              if (xmlDoc.documentElement) {
                const res: any = {}; res[xmlDoc.documentElement.tagName] = nodeToJson(xmlDoc.documentElement);
                current = JSON.stringify(res, null, 2);
              } else current = '{}';
              break;
            }
            case 'json-to-xml': {
              const obj = JSON.parse(current);
              let options = { root: 'root', noRoot: false, noHeader: false };
              try {
                if (step.value.startsWith('{')) {
                  const parsed = JSON.parse(step.value); options = { ...options, ...parsed };
                } else if (step.value === '__none__') options.noRoot = true;
                else if (step.value.trim()) options.root = step.value.trim();
              } catch (e) {
                if (step.value === '__none__') options.noRoot = true;
                else if (step.value.trim()) options.root = step.value.trim();
              }
              const rootName = options.noRoot ? null : (options.root.trim() || 'root');
              const xmlHeader = options.noHeader ? '' : '<?xml version="1.0" encoding="UTF-8"?>\n';
              const jsonToXml = (name: string, val: any, level: number = 0): string => {
                const indent = '  '.repeat(level);
                if (typeof val !== 'object' || val === null) return `${indent}<${name}>${val}</${name}>`;
                if (Array.isArray(val)) return val.map(item => jsonToXml(name, item, level)).join('\n');
                let attrs = ''; let children = ''; let text = '';
                for (const key in val) {
                  if (key.startsWith('@')) attrs += ` ${key.substring(1)}="${val[key]}"`;
                  else if (key === '#text') text = val[key];
                  else children += '\n' + jsonToXml(key, val[key], level + 1);
                }
                if (!children && !text) return `${indent}<${name}${attrs}/>`;
                return `${indent}<${name}${attrs}>${text}${children}${children ? '\n' + indent : ''}</${name}>`;
              };
              if (!rootName) {
                if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
                  current = xmlHeader + Object.keys(obj).map(key => jsonToXml(key, obj[key])).join('\n').trim();
                } else current = xmlHeader + jsonToXml('root', obj).trim();
              } else current = xmlHeader + jsonToXml(rootName, obj).trim();
              break;
            }
            case 'json-to-csv': {
              const data = JSON.parse(current);
              const arrayData = Array.isArray(data) ? data : [data];
              if (arrayData.length === 0) { current = ''; break; }
              const headers = Array.from(new Set(arrayData.flatMap(obj => Object.keys(obj))));
              current = [headers.join(','), ...arrayData.map(row => headers.map(h => {
                const v = row[h] ?? '';
                const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
                return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
              }).join(','))].join('\n');
              break;
            }
            case 'csv-to-json': {
              const lines = current.split(/\r?\n/).filter(line => line.trim());
              if (lines.length === 0) { current = '[]'; break; }
              const parseCSVLine = (l: string) => {
                const res = []; let cell = ''; let inQ = false;
                for (let i = 0; i < l.length; i++) {
                  if (l[i] === '"') { if (inQ && l[i+1] === '"') { cell += '"'; i++; } else inQ = !inQ; }
                  else if (l[i] === ',' && !inQ) { res.push(cell.trim()); cell = ''; } else cell += l[i];
                }
                res.push(cell.trim()); return res;
              };
              const headers = parseCSVLine(lines[0]);
              const resData = lines.slice(1).map(l => {
                const vals = parseCSVLine(l);
                const obj: any = {};
                headers.forEach((h, i) => { if (h) obj[h] = vals[i] ?? ''; });
                return obj;
              });
              current = JSON.stringify(resData, null, 2);
              break;
            }
          }
        } catch (e: any) { throw { stepId: step.id, message: e.message }; }
      }
      setOutput(current);
    } catch (e: any) {
      setError({ stepId: e.stepId || 'global', message: e.message });
      setOutput('');
    }
  }, [input, steps]);

  useEffect(() => { processChain(); }, [processChain]);

  useEffect(() => {
    const fetchChains = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${baseUrl}/api/chains`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json() as { success: boolean; data: SavedChain[] };
          if (data.success && data.data && data.data.length > 0) { setSavedChains(data.data); return; }
        }
      } catch (e) { console.error('Failed to load chains:', e); }
      setSavedChains([
        { id: 'def-proxy', name: '代理列表转换', isFavorite: true, createdAt: Date.now(), steps: DEFAULT_PROXY_STEPS },
        { id: 'def-smb', name: 'SMB 路径互转', isFavorite: true, createdAt: Date.now()+1, steps: DEFAULT_SMB_STEPS },
        { id: 'def-link', name: '代理链接转换', isFavorite: true, createdAt: Date.now()+2, steps: DEFAULT_PROXY_LINK_STEPS }
      ]);
    };
    fetchChains();
  }, [user]);

  const addStep = (type: StepType) => setSteps([...steps, { id: Math.random().toString(36).substr(2, 9), type, value: '', active: true }]);
  const removeStep = (id: string) => setSteps(steps.filter(s => s.id !== id));
  const updateStep = (id: string, updates: Partial<Step>) => setSteps(steps.map(s => s.id === id ? { ...s, ...updates } : s));
  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= steps.length) return;
    [newSteps[index], newSteps[target]] = [newSteps[target], newSteps[index]];
    setSteps(newSteps);
  };

  const handleSaveChain = async () => {
    if (!newChainName.trim() || steps.length === 0) return;
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${baseUrl}/api/chains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newChainName.trim(), steps })
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (data.success) {
          window.showToast?.('处理链已保存', 'success');
          const fetchRes = await fetch(`${baseUrl}/api/chains`, { credentials: 'include' });
          const fetchData = await fetchRes.json() as { success: boolean; data: SavedChain[] };
          if (fetchData.success) setSavedChains(fetchData.data);
      } else throw new Error(data.error);
    } catch (e: any) { window.showToast?.('保存失败: ' + e.message, 'error'); }
    setNewChainName(''); setIsSaveModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <IOSection 
        input={input} output={output} error={error} isDragging={isDragging} copied={copied}
        onInputChange={setInput} onClearInput={() => setInput('')}
        onFileUpload={handleFileUpload} onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
        onPaste={(e) => { const items = e.clipboardData.items; for (let i=0; i<items.length; i++) { if (items[i].kind === 'file') { const f = items[i].getAsFile(); if (f) handleFileUpload(f); break; } } }}
        onExportOutput={() => {
            const blob = new Blob([output], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `result-${Date.now()}.txt`; a.click(); URL.revokeObjectURL(url);
        }}
        onCopyOutput={() => { navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      />

      {/* Middle Column Override: Steps */}
      <div className="lg:grid lg:grid-cols-3 gap-6 !mt-0 relative lg:-mt-[420px]" style={{ pointerEvents: 'none' }}>
        <div className="hidden lg:block" />
        <div className="space-y-3 pointer-events-auto">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
              <ArrowRight className="w-4 h-4" /> 处理链
            </label>
            <div className="relative group">
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-color)] text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all">
                <Plus className="w-3.5 h-3.5" /> 添加步骤
              </button>
              <div className="absolute right-0 top-full pt-2 z-50 hidden group-hover:block">
                <div className="w-48 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1 max-h-80 overflow-y-auto custom-scrollbar">
                  {(Object.keys(STEP_CONFIG) as StepType[]).map(type => (
                    <button key={type} onClick={() => addStep(type)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--hover-color)] rounded-lg text-left">
                      <span className="w-8 h-8 flex items-center justify-center bg-[var(--bg-main)] rounded text-[10px] font-bold text-[var(--accent-color)]">{STEP_CONFIG[type].icon}</span>
                      <span className="text-xs text-[var(--text-primary)]">{STEP_CONFIG[type].label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={() => setIsSaveModalOpen(true)} disabled={steps.length === 0} className="p-1.5 hover:bg-[var(--hover-color)] rounded-lg text-[var(--text-secondary)] disabled:opacity-30"><Save className="w-4 h-4" /></button>
          </div>
          <div className="space-y-3 h-[calc(100vh-280px)] min-h-[400px] overflow-y-auto custom-scrollbar pr-1">
            {steps.length === 0 ? (
                <div className="h-full border-2 border-dashed border-[var(--border-color)] rounded-2xl flex flex-col items-center justify-center text-[var(--text-secondary)]">
                    <Plus className="w-8 h-8 mb-2 opacity-20" /><p className="text-sm">尚未添加处理步骤</p>
                </div>
            ) : steps.map((step, i) => <StepItem key={step.id} step={step} index={i} totalSteps={steps.length} error={error} onUpdate={updateStep} onRemove={removeStep} onMove={moveStep} />)}
          </div>
        </div>
      </div>

      <ChainLibrary 
        savedChains={savedChains} 
        onLoadChain={(c) => setSteps(JSON.parse(JSON.stringify(c.steps)))} 
        onDeleteChain={async (id) => {
            const baseUrl = import.meta.env.VITE_API_URL || '';
            await fetch(`${baseUrl}/api/chains/${id}`, { method: 'DELETE', credentials: 'include' });
            setSavedChains(savedChains.filter(c => c.id !== id));
        }}
        onToggleFavorite={async (id) => {
            const chain = savedChains.find(c => c.id === id); if (!chain) return;
            const newFav = !chain.isFavorite;
            setSavedChains(savedChains.map(c => c.id === id ? { ...c, isFavorite: newFav } : c));
            const baseUrl = import.meta.env.VITE_API_URL || '';
            await fetch(`${baseUrl}/api/chains/${id}/favorite`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ isFavorite: newFav }) });
        }}
        onExport={() => {
            const blob = new Blob([JSON.stringify(savedChains, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `chains-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
        }}
        onImport={(e) => {
            const f = e.target.files?.[0]; if (!f) return;
            const r = new FileReader(); r.onload = (ev) => { try { const imp = JSON.parse(ev.target?.result as string); if (Array.isArray(imp)) setSavedChains(p => [...imp, ...p]); } catch(err) { window.showToast?.('导入失败', 'error'); } };
            r.readAsText(f); e.target.value = '';
        }}
      />

      {isSaveModalOpen && (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm ${isDarkMode ? 'bg-black/80' : 'bg-black/20'}`}>
          <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold text-[var(--text-primary)]">保存处理链</h3><button onClick={() => setIsSaveModalOpen(false)} className="p-2 hover:bg-[var(--hover-color)] rounded-full transition-colors"><X className="w-5 h-5 text-[var(--text-secondary)]" /></button></div>
            <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-secondary)]">名称</label>
                <input autoFocus value={newChainName} onChange={(e) => setNewChainName(e.target.value)} placeholder="例如：提取代理列表..." className="w-full px-4 py-3 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all text-[var(--text-primary)]" />
            </div>
            <div className="flex gap-3 pt-2">
                <button onClick={() => setIsSaveModalOpen(false)} className="flex-1 py-3 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl font-bold text-[var(--text-secondary)] hover:bg-[var(--hover-color)] transition-all">取消</button>
                <button onClick={handleSaveChain} className="flex-1 py-3 bg-[var(--accent-color)] text-white rounded-2xl font-bold shadow-lg shadow-[var(--accent-color)]/20 hover:opacity-90 transition-all">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
