export type StepType =
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

export interface Step {
  id: string;
  type: StepType;
  value: string;
  active: boolean;
}

export interface SavedChain {
  id: string;
  name: string;
  steps: Step[];
  isFavorite: boolean;
  createdAt: number;
}

export const STEP_CONFIG: Record<StepType, { label: string; placeholder: string; icon: string }> = {
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

export const DEFAULT_PROXY_STEPS: Step[] = [
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

export const DEFAULT_SMB_STEPS: Step[] = [
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

export const DEFAULT_PROXY_LINK_STEPS: Step[] = [
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
