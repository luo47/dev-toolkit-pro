import React, { useState } from 'react';
import { Link2, Copy, Check } from 'lucide-react';

export default function ProxyConverter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  const convert = () => {
    if (!input.trim()) return;

    try {
      let user = '', pass = '', host = '', port = '', name = 'NAME';

      // Format 3: socks://base64(user:pass@host:port)?remarks=NAME
      if (input.includes('?remarks=')) {
        const parts = input.split('?remarks=');
        name = decodeURIComponent(parts[1]);
        const base64Part = parts[0].replace(/^socks5?:\/\//, '');
        const decoded = atob(base64Part);
        // decoded is user:pass@host:port
        const match = decoded.match(/^([^:]+):([^@]+)@([^:]+):(.+)$/);
        if (match) {
          [, user, pass, host, port] = match;
        }
      } 
      // Format 1: socks5://host:port:user:pass
      else if (input.match(/^socks5?:\/\/([^:]+):([^:]+):([^:]+):(.+)$/)) {
        const match = input.match(/^socks5?:\/\/([^:]+):([^:]+):([^:]+):(.+)$/);
        if (match) {
          [, host, port, user, pass] = match;
        }
      }
      // Format 2: socks5://user:pass@host:port
      else if (input.match(/^socks5?:\/\/([^:]+):([^@]+)@([^:]+):(.+)$/)) {
        const match = input.match(/^socks5?:\/\/([^:]+):([^@]+)@([^:]+):(.+)$/);
        if (match) {
          [, user, pass, host, port] = match;
        }
      }

      if (user && pass && host && port) {
        const userPassBase64 = btoa(`${user}:${pass}`);
        setOutput(`socks://${userPassBase64}@${host}:${port}#${encodeURIComponent(name)}`);
      } else {
        setOutput('Invalid format');
      }
    } catch (e) {
      setOutput('Error parsing link');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider px-1">
          输入代理链接
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full h-32 p-5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-[24px] font-mono text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent outline-none transition-all resize-none"
          placeholder="在此粘贴 socks5 链接..."
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={convert}
          className="px-6 py-2.5 bg-[var(--text-primary)] text-[var(--bg-main)] rounded-full text-sm font-medium hover:opacity-90 transition-colors flex items-center gap-2"
        >
          <Link2 className="w-4 h-4" />
          转换链接
        </button>
      </div>

      {output && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider px-1">
            转换结果
          </label>
          <div className="relative group">
            <pre className="p-5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-[24px] font-mono text-sm text-[var(--text-primary)] overflow-x-auto custom-scrollbar pr-12">
              {output}
            </pre>
            <button
              onClick={copyToClipboard}
              className="absolute top-4 right-4 p-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-full hover:bg-[var(--hover-color)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              title="复制到剪贴板"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
