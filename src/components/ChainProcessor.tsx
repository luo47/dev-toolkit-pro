import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  GripVertical,
  Play,
  Copy,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Settings2,
  ArrowRight,
  Save,
  Star,
  Download,
  Upload,
  History,
  FileText,
  Search,
  X
} from 'lucide-react';
import { JSONPath } from 'jsonpath-plus';
import { useAuth } from '../hooks/useAuth';

type StepType =
  | 'jsonpath'
  | 'xpath'
  | 'css'
  | 'js'
  | 'base64-encode'
  | 'base64-decode'
  | 'url-encode'
  | 'url-decode'
  | 'trim'
  | 'lowercase'
  | 'uppercase'
  | 'json-beautify'
  | 'json-compress'
  | 'xml-beautify'
  | 'xml-compress'
  | 'xml-to-json'
  | 'json-to-xml'
  | 'json-to-csv'
  | 'csv-to-json';

interface Step {
  id: string;
  type: StepType;
  value: string;
  active: boolean;
}

interface SavedChain {
  id: string;
  name: string;
  steps: Step[];
  isFavorite: boolean;
  createdAt: number;
}

const STEP_CONFIG = {
  jsonpath: { label: 'JSONPath', placeholder: '$.items[*].name', icon: 'J' },
  xpath: { label: 'XPath', placeholder: '//div[@class="title"]/text()', icon: 'X' },
  css: { label: 'CSS 选择器', placeholder: 'a.link @href 或 @outerHTML', icon: 'C' },
  js: { label: '自定义 JS', placeholder: 'return input.split("\\n").filter(Boolean).join(",");', icon: 'JS' },
  'base64-encode': { label: 'Base64 编码', placeholder: '', icon: 'B64' },
  'base64-decode': { label: 'Base64 解码', placeholder: '', icon: 'B64' },
  'url-encode': { label: 'URL 编码', placeholder: '', icon: 'URL' },
  'url-decode': { label: 'URL 解码', placeholder: '', icon: 'URL' },
  trim: { label: '去除首尾空格', placeholder: '', icon: 'T' },
  lowercase: { label: '转小写', placeholder: '', icon: 'a' },
  uppercase: { label: '转大写', placeholder: '', icon: 'A' },
  'json-beautify': { label: 'JSON 美化', placeholder: '', icon: '{ }' },
  'json-compress': { label: 'JSON 压缩', placeholder: '', icon: '{..}' },
  'xml-beautify': { label: 'XML 美化', placeholder: '', icon: '< >' },
  'xml-compress': { label: 'XML 压缩', placeholder: '', icon: '<..>' },
  'xml-to-json': { label: 'XML 转 JSON', placeholder: '', icon: 'X2J' },
  'json-to-xml': { label: 'JSON 转 XML', placeholder: 'root', icon: 'J2X' },
  'json-to-csv': { label: 'JSON 转 CSV', placeholder: '', icon: 'J2C' },
  'csv-to-json': { label: 'CSV 转 JSON', placeholder: '', icon: 'C2J' },
};

const DEFAULT_PROXY_STEPS: Step[] = [
  {
    id: 'step-1',
    type: 'jsonpath',
    value: '$.data.free_ip_list || $.data.page.list || $',
    active: true
  },
  {
    id: 'step-2',
    type: 'js',
    value: `if (!Array.isArray(input)) return "错误：输入不是有效的数组。请检查 JSONPath 提取结果。";\n\nreturn input.map(item => {\n  // 格式化：socks://base64(user:pass)@ip:port#city-ip\n  const auth = btoa(\`\${item.username}:\${item.password}\`);\n  const city = (item.city || 'Unknown').replace(/\\s+/g, '');\n  return \`socks://\${auth}@\${item.ip}:\${item.port}#\${city}-\${item.ip}\`;\n}).join('\\n');`,
    active: true
  }
];

const DEFAULT_SMB_STEPS: Step[] = [
  {
    id: 'smb-step-1',
    type: 'js',
    value: `// SMB 路径双向转换脚本
const lines = input.split('\\n').filter(line => line.trim());

return lines.map(line => {
  const clean = line.trim();
  
  // Windows -> URI (\\\\server\\share)
  if (clean.startsWith('\\\\\\\\')) {
    const parts = clean.substring(2).split('\\\\');
    return 'smb://' + parts.map(p => encodeURIComponent(p)).join('/');
  }
  
  // URI -> Windows (smb://server/share)
  if (clean.toLowerCase().startsWith('smb://')) {
    try {
      const url = new URL(clean.replace(/^smb:/i, 'http:'));
      let winPath = '\\\\\\\\' + url.hostname;
      const pathname = decodeURIComponent(url.pathname);
      if (pathname && pathname !== '/') {
        winPath += pathname.replace(/\\//g, '\\\\');
      }
      return winPath;
    } catch (e) {
      const parts = clean.substring(6).split('/');
      return '\\\\\\\\' + parts.join('\\\\');
    }
  }
  
  return clean;
}).join('\\n');`,
    active: true
  }
];

const DEFAULT_PROXY_LINK_STEPS: Step[] = [
  {
    id: 'proxy-link-step-1',
    type: 'js',
    value: `// 代理链接转换脚本
const line = input.trim();
if (!line) return "";

try {
  let user = '', pass = '', host = '', port = '', name = 'NAME';

  // 格式 3: socks://base64(user:pass@host:port)?remarks=NAME
  if (line.includes('?remarks=')) {
    const parts = line.split('?remarks=');
    name = decodeURIComponent(parts[1]);
    const base64Part = parts[0].replace(/^socks5?:\\/\\//, '');
    const decoded = atob(base64Part);
    const match = decoded.match(/^([^:]+):([^@]+)@([^:]+):(.+)$/);
    if (match) [, user, pass, host, port] = match;
  } 
  // 格式 1: socks5://host:port:user:pass
  else if (line.match(/^socks5?:\\/\\/([^:]+):([^:]+):([^:]+):(.+)$/)) {
    const match = line.match(/^socks5?:\\/\\/([^:]+):([^:]+):([^:]+):(.+)$/);
    if (match) [, host, port, user, pass] = match;
  }
  // 格式 2: socks5://user:pass@host:port
  else if (line.match(/^socks5?:\\/\\/([^:]+):([^@]+)@([^:]+):(.+)$/)) {
    const match = line.match(/^socks5?:\\/\\/([^:]+):([^@]+)@([^:]+):(.+)$/);
    if (match) [, user, pass, host, port] = match;
  }

  if (user && pass && host && port) {
    const userPassBase64 = btoa(\`\${user}:\${pass}\`);
    return \`socks://\${userPassBase64}@\${host}:\${port}#\${encodeURIComponent(name)}\`;
  }
  return "错误：无法识别的链接格式";
} catch (e) {
  return "错误：解析链接失败 - " + e.message;
}`,
    active: true
  }
];

export default function ChainProcessor() {
  const [input, setInput] = useState('');
  const [steps, setSteps] = useState<Step[]>([]);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<{ stepId: string; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedChains, setSavedChains] = useState<SavedChain[]>([]);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newChainName, setNewChainName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [isDragging, setIsDragging] = useState(false);

  const { user } = useAuth();

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setInput(content);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) {
          handleFileUpload(file);
          break;
        }
      }
    }
  };

  const handleExportOutput = () => {
    if (!output) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `result-${timestamp}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Load saved chains from backend (or fallback to defaults)
  useEffect(() => {
    const fetchChains = async () => {
      try {
        const baseUrl = (import.meta as any).env.VITE_API_URL || '';
        const res = await fetch(`${baseUrl}/api/chains`, { credentials: 'include' });
        if (res.ok) {
          const data: any = await res.json();
          if (data.success && data.data && data.data.length > 0) {
            setSavedChains(data.data);
            return;
          }
        }
      } catch (e) {
        console.error('Failed to load chains:', e);
      }

      const defaultChain: SavedChain = {
        id: 'default-proxy-converter',
        name: '代理列表转换 (Proxy Converter)',
        isFavorite: true,
        createdAt: Date.now(),
        steps: DEFAULT_PROXY_STEPS
      };
      const smbChain: SavedChain = {
        id: 'default-smb-converter',
        name: 'SMB 路径互转 (SMB Path Converter)',
        isFavorite: true,
        createdAt: Date.now() + 1,
        steps: DEFAULT_SMB_STEPS
      };
      const proxyLinkChain: SavedChain = {
        id: 'default-proxy-link-converter',
        name: '代理链接转换 (Proxy Link Converter)',
        isFavorite: true,
        createdAt: Date.now() + 2,
        steps: DEFAULT_PROXY_LINK_STEPS
      };
      setSavedChains([defaultChain, smbChain, proxyLinkChain]);
    };
    fetchChains();
  }, [user]);

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
              // Split by || to support fallback paths
              const paths = step.value.split('||').map(p => p.trim());
              let result: any = undefined;

              for (const path of paths) {
                const searchResult = JSONPath({ path, json, wrap: false });
                if (searchResult !== undefined && searchResult !== null && (Array.isArray(searchResult) ? searchResult.length > 0 : true)) {
                  result = searchResult;
                  break;
                }
              }

              if (result === undefined) {
                current = 'undefined';
              } else {
                current = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
              }
              break;
            }
            case 'xpath': {
              const parser = new DOMParser();
              const doc = parser.parseFromString(current, 'text/html');
              const result = doc.evaluate(step.value, doc, null, XPathResult.ANY_TYPE, null);

              if (result.resultType === XPathResult.STRING_TYPE) {
                current = result.stringValue;
              } else if (result.resultType === XPathResult.NUMBER_TYPE) {
                current = result.numberValue.toString();
              } else if (result.resultType === XPathResult.BOOLEAN_TYPE) {
                current = result.booleanValue.toString();
              } else {
                const nodes = [];
                let node = result.iterateNext();
                while (node) {
                  nodes.push(node.textContent);
                  node = result.iterateNext();
                }
                current = nodes.join('\n');
              }
              break;
            }
            case 'css': {
              if (!step.value.trim()) {
                current = '';
                break;
              }
              const parser = new DOMParser();
              const doc = parser.parseFromString(current, 'text/html');

              let selector = step.value;
              let attr: string | null = null;

              // Support "selector @attr" syntax
              if (selector.includes(' @')) {
                const parts = selector.split(' @');
                attr = parts.pop()?.trim() || null;
                selector = parts.join(' @').trim();
              } else if (selector.includes('@') && !selector.includes('[') && !selector.includes('=')) {
                // Simple heuristic for "selector@attr" without breaking complex selectors like [attr@="val"]
                const lastAt = selector.lastIndexOf('@');
                attr = selector.substring(lastAt + 1).trim();
                selector = selector.substring(0, lastAt).trim();
              }

              try {
                const elements = doc.querySelectorAll(selector || '*');
                if (attr) {
                  if (attr.toLowerCase() === 'outerhtml') {
                    current = Array.from(elements).map(el => el.outerHTML).join('\n');
                  } else if (attr.toLowerCase() === 'innerhtml') {
                    current = Array.from(elements).map(el => el.innerHTML).join('\n');
                  } else {
                    current = Array.from(elements)
                      .map(el => el.getAttribute(attr!))
                      .filter(val => val !== null)
                      .join('\n');
                  }
                } else {
                  current = Array.from(elements).map(el => el.textContent).join('\n');
                }
              } catch (e) {
                throw new Error(`CSS 选择器错误: ${e instanceof Error ? e.message : String(e)}`);
              }
              break;
            }
            case 'js': {
              let inputData: any = current;
              // Try to parse current as JSON if it looks like an object or array
              if (typeof current === 'string' && (current.trim().startsWith('{') || current.trim().startsWith('['))) {
                try {
                  inputData = JSON.parse(current);
                } catch (e) {
                  // Not valid JSON, keep as string
                }
              } else if (current === 'undefined') {
                inputData = undefined;
              }

              const fn = new Function('input', step.value);
              const result = fn(inputData);
              current = typeof result === 'object' && result !== null ? JSON.stringify(result, null, 2) : String(result);
              break;
            }
            case 'base64-encode':
              current = btoa(unescape(encodeURIComponent(current)));
              break;
            case 'base64-decode':
              current = decodeURIComponent(escape(atob(current)));
              break;
            case 'url-encode':
              current = encodeURIComponent(current);
              break;
            case 'url-decode':
              current = decodeURIComponent(current);
              break;
            case 'trim':
              current = current.trim();
              break;
            case 'lowercase':
              current = current.toLowerCase();
              break;
            case 'uppercase':
              current = current.toUpperCase();
              break;
            case 'json-beautify':
              current = JSON.stringify(JSON.parse(current), null, 2);
              break;
            case 'json-compress':
              current = JSON.stringify(JSON.parse(current));
              break;
            case 'xml-beautify': {
              const parser = new DOMParser();
              let xmlDoc: Document;
              let isHTML = false;

              // Try XML first
              xmlDoc = parser.parseFromString(current, 'application/xml');
              if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
                // Fallback to HTML
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

                  // Handle void elements in HTML
                  const isVoid = isHTML && ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'].includes(tagName);

                  if (element.childNodes.length === 0) {
                    result += isVoid ? '>' : '/>';
                  } else {
                    result += '>';
                    let hasChildElements = false;
                    for (let i = 0; i < element.childNodes.length; i++) {
                      if (element.childNodes[i].nodeType === Node.ELEMENT_NODE) {
                        hasChildElements = true;
                        break;
                      }
                    }

                    for (let i = 0; i < element.childNodes.length; i++) {
                      result += formatNode(element.childNodes[i], level + 1);
                    }

                    if (hasChildElements) {
                      result += `\n${indent}</${tagName}>`;
                    } else {
                      result += `</${tagName}>`;
                    }
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
                // For HTML snippets, content might end up in head (like <link>, <meta>) or body.
                let output = '';
                const head = xmlDoc.head;
                const body = xmlDoc.body;

                if (head) {
                  for (let i = 0; i < head.childNodes.length; i++) {
                    output += formatNode(head.childNodes[i], 0);
                  }
                }
                if (body) {
                  for (let i = 0; i < body.childNodes.length; i++) {
                    output += formatNode(body.childNodes[i], 0);
                  }
                }
                current = output.trim();
              } else {
                const declarationMatch = current.match(/^<\?xml.*?\?>/i);
                const declaration = declarationMatch ? declarationMatch[0] + '\n' : '';
                current = declaration + formatNode(xmlDoc.documentElement).trim();
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

                  if (element.childNodes.length === 0) {
                    result += isVoid ? '>' : '/>';
                  } else {
                    result += '>';
                    for (let i = 0; i < element.childNodes.length; i++) {
                      result += serialize(element.childNodes[i]);
                    }
                    result += `</${tagName}>`;
                  }
                } else if (node.nodeType === Node.TEXT_NODE) {
                  result += node.textContent?.trim() || '';
                }
                return result;
              };

              if (isHTML) {
                let output = '';
                const head = xmlDoc.head;
                const body = xmlDoc.body;

                if (head) {
                  for (let i = 0; i < head.childNodes.length; i++) {
                    output += serialize(head.childNodes[i]);
                  }
                }
                if (body) {
                  for (let i = 0; i < body.childNodes.length; i++) {
                    output += serialize(body.childNodes[i]);
                  }
                }
                current = output;
              } else {
                const declarationMatch = current.match(/^<\?xml.*?\?>/i);
                const declaration = declarationMatch ? declarationMatch[0] : '';
                current = declaration + serialize(xmlDoc.documentElement);
              }
              break;
            }
            case 'xml-to-json': {
              const parser = new DOMParser();
              const xmlDoc = parser.parseFromString(current, 'application/xml');
              if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
                throw new Error('无效的 XML 格式');
              }

              const nodeToJson = (node: Node): any => {
                if (node.nodeType === Node.TEXT_NODE) {
                  return node.textContent?.trim() || '';
                }

                if (node.nodeType === Node.ELEMENT_NODE) {
                  const element = node as Element;
                  const obj: any = {};

                  // Attributes
                  for (let i = 0; i < element.attributes.length; i++) {
                    const attr = element.attributes[i];
                    obj[`@${attr.name}`] = attr.value;
                  }

                  // Children
                  for (let i = 0; i < element.childNodes.length; i++) {
                    const child = element.childNodes[i];
                    if (child.nodeType === Node.ELEMENT_NODE) {
                      const childName = (child as Element).tagName;
                      const childJson = nodeToJson(child);

                      if (obj[childName]) {
                        if (!Array.isArray(obj[childName])) {
                          obj[childName] = [obj[childName]];
                        }
                        obj[childName].push(childJson);
                      } else {
                        obj[childName] = childJson;
                      }
                    } else if (child.nodeType === Node.TEXT_NODE) {
                      const text = child.textContent?.trim();
                      if (text) {
                        if (Object.keys(obj).length === 0 && element.childNodes.length === 1) {
                          return text;
                        }
                        obj['#text'] = text;
                      }
                    }
                  }
                  return obj;
                }
                return null;
              };

              const result = {};
              if (xmlDoc.documentElement) {
                result[xmlDoc.documentElement.tagName] = nodeToJson(xmlDoc.documentElement);
                current = JSON.stringify(result, null, 2);
              } else {
                current = '{}';
              }
              break;
            }
            case 'json-to-xml': {
              const obj = JSON.parse(current);

              let options = { root: 'root', noRoot: false, noHeader: false };
              try {
                if (step.value.startsWith('{')) {
                  const parsed = JSON.parse(step.value);
                  options = { ...options, ...parsed };
                } else if (step.value === '__none__') {
                  options.noRoot = true;
                } else if (step.value.trim()) {
                  options.root = step.value.trim();
                }
              } catch (e) {
                if (step.value === '__none__') options.noRoot = true;
                else if (step.value.trim()) options.root = step.value.trim();
              }

              const rootName = options.noRoot ? null : (options.root.trim() || 'root');
              const xmlHeader = options.noHeader ? '' : '<?xml version="1.0" encoding="UTF-8"?>\n';

              const jsonToXml = (name: string, val: any, level: number = 0): string => {
                const indent = '  '.repeat(level);
                if (typeof val !== 'object' || val === null) {
                  return `${indent}<${name}>${val}</${name}>`;
                }

                if (Array.isArray(val)) {
                  return val.map(item => jsonToXml(name, item, level)).join('\n');
                }

                let attrs = '';
                let children = '';
                let text = '';

                for (const key in val) {
                  if (key.startsWith('@')) {
                    attrs += ` ${key.substring(1)}="${val[key]}"`;
                  } else if (key === '#text') {
                    text = val[key];
                  } else {
                    children += '\n' + jsonToXml(key, val[key], level + 1);
                  }
                }

                if (!children && !text) {
                  return `${indent}<${name}${attrs}/>`;
                }

                return `${indent}<${name}${attrs}>${text}${children}${children ? '\n' + indent : ''}</${name}>`;
              };

              if (!rootName) {
                // No root node: iterate over top-level keys
                if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
                  current = xmlHeader +
                    Object.keys(obj).map(key => jsonToXml(key, obj[key])).join('\n').trim();
                } else {
                  // Fallback for arrays or primitives if no root specified
                  current = xmlHeader + jsonToXml('root', obj).trim();
                }
              } else {
                current = xmlHeader + jsonToXml(rootName, obj).trim();
              }
              break;
            }
            case 'json-to-csv': {
              const data = JSON.parse(current);
              const arrayData = Array.isArray(data) ? data : [data];
              if (arrayData.length === 0) {
                current = '';
                break;
              }
              // Get all unique keys from all objects
              const headers = Array.from(new Set(arrayData.flatMap(obj => Object.keys(obj))));
              const csvRows = [
                headers.join(','),
                ...arrayData.map(row =>
                  headers.map(header => {
                    const val = row[header] ?? '';
                    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
                    // Escape quotes and wrap in quotes if contains comma or quote
                    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                      return `"${str.replace(/"/g, '""')}"`;
                    }
                    return str;
                  }).join(',')
                )
              ];
              current = csvRows.join('\n');
              break;
            }
            case 'csv-to-json': {
              const lines = current.split(/\r?\n/).filter(line => line.trim());
              if (lines.length === 0) {
                current = '[]';
                break;
              }

              const parseCSVLine = (line: string) => {
                const result = [];
                let currentCell = '';
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                  const char = line[i];
                  if (char === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                      currentCell += '"';
                      i++;
                    } else {
                      inQuotes = !inQuotes;
                    }
                  } else if (char === ',' && !inQuotes) {
                    result.push(currentCell.trim());
                    currentCell = '';
                  } else {
                    currentCell += char;
                  }
                }
                result.push(currentCell.trim());
                return result;
              };

              const headers = parseCSVLine(lines[0]);
              const result = lines.slice(1).map(line => {
                const values = parseCSVLine(line);
                const obj: any = {};
                headers.forEach((header, i) => {
                  if (header) {
                    obj[header] = values[i] ?? '';
                  }
                });
                return obj;
              });
              current = JSON.stringify(result, null, 2);
              break;
            }
          }
        } catch (e: any) {
          throw { stepId: step.id, message: e.message };
        }
      }
      setOutput(current);
    } catch (e: any) {
      setError({ stepId: e.stepId || 'global', message: e.message });
      setOutput('');
    }
  }, [input, steps]);

  useEffect(() => {
    processChain();
  }, [processChain]);

  const addStep = (type: StepType) => {
    const newStep: Step = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      value: '',
      active: true
    };
    setSteps([...steps, newStep]);
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
  };

  const updateStep = (id: string, updates: Partial<Step>) => {
    setSteps(steps.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setSteps(newSteps);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveChain = async () => {
    if (!newChainName.trim() || steps.length === 0) return;
    if (!user) {
      alert('请登录后保存云端处理链');
      return;
    }

    try {
      const baseUrl = (import.meta as any).env.VITE_API_URL || '';
      const res = await fetch(`${baseUrl}/api/chains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newChainName.trim(), steps })
      });
      const data: any = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '保存失败');

      const fetchRes = await fetch(`${baseUrl}/api/chains`, { credentials: 'include' });
      if (fetchRes.ok) {
        const fetchData: any = await fetchRes.json();
        if (fetchData.success) setSavedChains(fetchData.data);
      }
    } catch (e: any) {
      alert('保存失败: ' + e.message);
    }

    setNewChainName('');
    setIsSaveModalOpen(false);
  };

  const loadChain = (chain: SavedChain) => {
    setSteps(JSON.parse(JSON.stringify(chain.steps)));
  };

  const deleteChain = async (id: string) => {
    if (!user) return;
    try {
      const baseUrl = (import.meta as any).env.VITE_API_URL || '';
      await fetch(`${baseUrl}/api/chains/${id}`, { method: 'DELETE', credentials: 'include' });
      setSavedChains(savedChains.filter(c => c.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const toggleFavorite = async (id: string) => {
    if (!user) {
      alert('请先登录即可收藏处理链');
      return;
    }
    const chain = savedChains.find(c => c.id === id);
    if (!chain) return;
    const newFav = !chain.isFavorite;

    setSavedChains(savedChains.map(c =>
      c.id === id ? { ...c, isFavorite: newFav } : c
    ));

    try {
      const baseUrl = (import.meta as any).env.VITE_API_URL || '';
      await fetch(`${baseUrl}/api/chains/${id}/favorite`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isFavorite: newFav })
      });
    } catch (e) {
      setSavedChains(savedChains.map(c =>
        c.id === id ? { ...c, isFavorite: !newFav } : c
      ));
    }
  };

  const exportChains = () => {
    const data = JSON.stringify(savedChains, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chains-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importChains = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          // Merge and avoid duplicates by ID if needed, or just append
          setSavedChains(prev => [...imported, ...prev]);
        }
      } catch (err) {
        alert('导入失败：文件格式不正确');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const filteredChains = savedChains
    .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return b.createdAt - a.createdAt;
    });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Input */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              原始输入
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setInput('')}
                className="p-1.5 hover:bg-[var(--hover-color)] rounded-lg text-[var(--text-secondary)] hover:text-red-500 transition-all"
                title="清空输入"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <label className="p-1.5 hover:bg-[var(--hover-color)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent-color)] transition-all cursor-pointer" title="上传文件">
                <Upload className="w-4 h-4" />
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
          <div
            className={`relative group h-[calc(100vh-280px)] min-h-[400px] rounded-2xl transition-all ${isDragging ? 'ring-2 ring-[var(--accent-color)] ring-offset-2 ring-offset-[var(--bg-main)]' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              placeholder="输入待处理的文本、JSON 或 HTML... (支持拖拽或粘贴文件)"
              className="w-full h-full p-4 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all resize-none custom-scrollbar"
            />
            <div className="absolute left-4 bottom-4 flex items-center gap-2">
              <button
                onClick={() => setInput('')}
                className="text-[10px] font-bold text-[var(--text-secondary)] hover:text-red-500 transition-colors bg-[var(--bg-main)]/80 backdrop-blur px-2 py-1 rounded-md border border-[var(--border-color)]"
              >
                清空输入
              </button>
            </div>
            {isDragging && (
              <div className="absolute inset-0 bg-[var(--accent-color)]/5 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-200">
                <Upload className="w-10 h-10 text-[var(--accent-color)] mb-2 animate-bounce" />
                <p className="text-sm font-bold text-[var(--accent-color)]">松开鼠标以上传文件</p>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Steps */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
              <ArrowRight className="w-4 h-4" />
              处理链
            </label>
            <div className="relative group">
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-color)] text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-lg shadow-[var(--accent-color)]/10">
                <Plus className="w-3.5 h-3.5" />
                添加步骤
              </button>
              {/* Hover Bridge & Dropdown Container */}
              <div className="absolute right-0 top-full pt-2 z-50 hidden group-hover:block animate-in fade-in zoom-in-95 duration-200">
                <div className="w-48 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden">
                  <div className="p-1 max-h-80 overflow-y-auto custom-scrollbar">
                    {(Object.keys(STEP_CONFIG) as StepType[]).map(type => (
                      <button
                        key={type}
                        onClick={() => addStep(type)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--hover-color)] rounded-lg text-left transition-colors"
                      >
                        <span className="w-8 h-8 flex items-center justify-center bg-[var(--bg-main)] rounded text-[10px] font-bold text-[var(--accent-color)]">
                          {STEP_CONFIG[type].icon}
                        </span>
                        <span className="text-xs text-[var(--text-primary)]">{STEP_CONFIG[type].label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsSaveModalOpen(true)}
              disabled={steps.length === 0}
              className="p-1.5 hover:bg-[var(--hover-color)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent-color)] transition-all disabled:opacity-30"
              title="保存当前处理链"
            >
              <Save className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 h-[calc(100vh-280px)] min-h-[400px] overflow-y-auto custom-scrollbar pr-1">
            {steps.length === 0 ? (
              <div className="h-full border-2 border-dashed border-[var(--border-color)] rounded-2xl flex flex-col items-center justify-center text-[var(--text-secondary)]">
                <Plus className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm">尚未添加处理步骤</p>
              </div>
            ) : (
              steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`group relative bg-[var(--bg-surface)] border ${error?.stepId === step.id ? 'border-red-500/50' : 'border-[var(--border-color)]'} rounded-2xl p-4 transition-all hover:shadow-md`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveStep(index, 'up')}
                        disabled={index === 0}
                        className="p-1 hover:bg-[var(--hover-color)] rounded text-[var(--text-secondary)] disabled:opacity-30"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveStep(index, 'down')}
                        disabled={index === steps.length - 1}
                        className="p-1 hover:bg-[var(--hover-color)] rounded text-[var(--text-secondary)] disabled:opacity-30"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="w-8 h-8 flex items-center justify-center bg-[var(--accent-color)]/10 rounded-lg text-[10px] font-bold text-[var(--accent-color)]">
                      {STEP_CONFIG[step.type].icon}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-[var(--text-primary)]">{STEP_CONFIG[step.type].label}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={step.active}
                        onChange={(e) => updateStep(step.id, { active: e.target.checked })}
                        className="w-4 h-4 rounded border-[var(--border-color)] text-[var(--accent-color)] focus:ring-[var(--accent-color)]"
                      />
                      <button
                        onClick={() => removeStep(step.id)}
                        className="p-1.5 hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-500 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {['jsonpath', 'xpath', 'css', 'js'].includes(step.type) && (
                    <div className="space-y-2">
                      <textarea
                        value={step.value}
                        onChange={(e) => updateStep(step.id, { value: e.target.value })}
                        placeholder={STEP_CONFIG[step.type].placeholder}
                        className="w-full p-3 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all resize-none h-20"
                      />
                    </div>
                  )}

                  {step.type === 'json-to-xml' && (() => {
                    let options = { root: 'root', noRoot: false, noHeader: false };
                    try {
                      if (step.value.startsWith('{')) {
                        const parsed = JSON.parse(step.value);
                        options = { ...options, ...parsed };
                      } else if (step.value === '__none__') {
                        options.noRoot = true;
                        options.root = '';
                      } else if (step.value.trim()) {
                        options.root = step.value.trim();
                      }
                    } catch (e) { }

                    const updateOptions = (updates: any) => {
                      updateStep(step.id, { value: JSON.stringify({ ...options, ...updates }) });
                    };

                    return (
                      <div className="space-y-3 mt-3 pt-3 border-t border-[var(--border-color)]/30">
                        <div className="relative">
                          <input
                            type="text"
                            value={options.root}
                            disabled={options.noRoot}
                            onChange={(e) => updateOptions({ root: e.target.value })}
                            placeholder="根节点名称 (默认 root)"
                            className="w-full p-2.5 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-xs outline-none focus:ring-2 focus:ring-[var(--accent-color)]/30 transition-all disabled:opacity-30 placeholder:text-[var(--text-secondary)]/50"
                          />
                        </div>
                        <div className="flex flex-col gap-2.5">
                          <label className="flex items-center gap-2 cursor-pointer select-none group/label">
                            <div className="relative flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={options.noRoot}
                                onChange={(e) => updateOptions({ noRoot: e.target.checked })}
                                className="peer appearance-none w-4 h-4 rounded border border-[var(--border-color)] checked:bg-[var(--accent-color)] checked:border-[var(--accent-color)] transition-all cursor-pointer"
                              />
                              <Check className="absolute w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                            </div>
                            <span className="text-[11px] font-medium text-[var(--text-secondary)] group-hover/label:text-[var(--text-primary)] transition-colors whitespace-nowrap">无根节点</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer select-none group/label">
                            <div className="relative flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={options.noHeader}
                                onChange={(e) => updateOptions({ noHeader: e.target.checked })}
                                className="peer appearance-none w-4 h-4 rounded border border-[var(--border-color)] checked:bg-[var(--accent-color)] checked:border-[var(--accent-color)] transition-all cursor-pointer"
                              />
                              <Check className="absolute w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                            </div>
                            <span className="text-[11px] font-medium text-[var(--text-secondary)] group-hover/label:text-[var(--text-primary)] transition-colors whitespace-nowrap">无 XML 声明头</span>
                          </label>
                        </div>
                      </div>
                    );
                  })()}

                  {error?.stepId === step.id && (
                    <div className="mt-2 text-[10px] text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {error.message}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Output */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
              <Play className="w-4 h-4" />
              处理结果
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportOutput}
                disabled={!output}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--hover-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                title="导出为文件"
              >
                <Download className="w-3.5 h-3.5" />
                导出结果
              </button>
              <button
                onClick={handleCopy}
                disabled={!output}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${copied
                  ? 'bg-green-500/10 text-green-500'
                  : 'bg-[var(--hover-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50'
                  }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? '已复制' : '复制结果'}
              </button>
            </div>
          </div>
          <textarea
            readOnly
            value={output}
            placeholder="处理后的结果将显示在这里..."
            className="w-full h-[calc(100vh-280px)] min-h-[400px] p-4 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl text-sm font-mono outline-none resize-none custom-scrollbar"
          />
          {error?.stepId === 'global' && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-500 leading-relaxed">{error.message}</p>
            </div>
          )}
        </div>
      </div>

      {/* Saved Chains Section */}
      <div className="space-y-4 pt-6 border-t border-[var(--border-color)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[var(--accent-color)]" />
            <h3 className="text-lg font-bold text-[var(--text-primary)]">已保存的处理链</h3>
            <span className="px-2 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-full text-[10px] text-[var(--text-secondary)]">
              {savedChains.length}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索处理链..."
                className="pl-9 pr-4 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg text-xs outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 w-48 transition-all"
              />
            </div>
            <div className="h-4 w-px bg-[var(--border-color)]" />
            <button
              onClick={exportChains}
              className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-[var(--hover-color)] rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              导出
            </button>
            <label className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-[var(--hover-color)] rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer">
              <Download className="w-3.5 h-3.5" />
              导入
              <input type="file" accept=".json" onChange={importChains} className="hidden" />
            </label>
          </div>
        </div>

        {filteredChains.length === 0 ? (
          <div className="py-12 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl flex flex-col items-center justify-center text-[var(--text-secondary)]">
            <FileText className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-sm">暂无保存的处理链</p>
            {searchQuery && <p className="text-xs mt-1 opacity-60">尝试更换搜索关键词</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredChains.map(chain => (
              <div
                key={chain.id}
                className="group relative bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 hover:shadow-lg hover:border-[var(--accent-color)]/30 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">{chain.name}</h4>
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      {chain.steps.length} 个步骤 · {new Date(chain.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleFavorite(chain.id)}
                      className={`p-1.5 rounded-lg transition-colors ${chain.isFavorite ? 'text-yellow-400 hover:bg-yellow-400/10' : 'text-[var(--text-secondary)] hover:bg-[var(--hover-color)] opacity-0 group-hover:opacity-100'}`}
                    >
                      <Star className={`w-3.5 h-3.5 ${chain.isFavorite ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      onClick={() => deleteChain(chain.id)}
                      className="p-1.5 text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                  {chain.steps.slice(0, 4).map((step, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-[var(--bg-main)] rounded text-[9px] font-medium text-[var(--text-secondary)]">
                      {STEP_CONFIG[step.type].icon}
                    </span>
                  ))}
                  {chain.steps.length > 4 && (
                    <span className="px-1.5 py-0.5 bg-[var(--bg-main)] rounded text-[9px] font-medium text-[var(--text-secondary)]">
                      +{chain.steps.length - 4}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => loadChain(chain)}
                  className="w-full py-2 bg-[var(--bg-main)] hover:bg-[var(--accent-color)] hover:text-white border border-[var(--border-color)] hover:border-[var(--accent-color)] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  <Play className="w-3 h-3" />
                  加载此处理链
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">保存处理链</h3>
                <button onClick={() => setIsSaveModalOpen(false)} className="p-2 hover:bg-[var(--hover-color)] rounded-full transition-colors">
                  <X className="w-5 h-5 text-[var(--text-secondary)]" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-secondary)]">名称</label>
                <input
                  autoFocus
                  type="text"
                  value={newChainName}
                  onChange={(e) => setNewChainName(e.target.value)}
                  placeholder="例如：提取代理列表、格式化 JSON..."
                  className="w-full px-4 py-3 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveChain()}
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => setIsSaveModalOpen(false)}
                  className="flex-1 py-3 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl text-sm font-bold text-[var(--text-secondary)] hover:bg-[var(--hover-color)] transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveChain}
                  disabled={!newChainName.trim()}
                  className="flex-1 py-3 bg-[var(--accent-color)] text-white rounded-2xl text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-[var(--accent-color)]/20"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
