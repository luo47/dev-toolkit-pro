import { useState } from 'react';
import { Copy, Check, Minimize2, Maximize2 } from 'lucide-react';

export default function JsonFormatter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const formatJson = () => {
    try {
      if (!input.trim()) return;
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed, null, 2));
      setError('');
    } catch (e) {
      setError('Invalid JSON');
      setOutput('');
    }
  };

  const compressJson = () => {
    try {
      if (!input.trim()) return;
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed));
      setError('');
    } catch (e) {
      setError('Invalid JSON');
      setOutput('');
    }
  };

  const copyToClipboard = () => {
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-6">
      <div className="relative group">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full h-64 p-6 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-[28px] font-mono text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)]/30 outline-none transition-all resize-none shadow-inner"
          placeholder="请在此粘贴 JSON..."
        />
        {input && (
          <button 
            onClick={() => setInput('')}
            className="absolute top-4 right-4 p-2 bg-[var(--bg-surface)] hover:bg-[var(--hover-color)] border border-[var(--border-color)] rounded-full text-[var(--text-secondary)] transition-all opacity-0 group-hover:opacity-100"
          >
            清空
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 justify-end">
        <button
          onClick={compressJson}
          className="flex items-center gap-2 px-6 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-full text-sm font-medium hover:bg-[var(--hover-color)] transition-all"
        >
          <Minimize2 className="w-4 h-4" />
          压缩 JSON
        </button>
        <button
          onClick={formatJson}
          className="flex items-center gap-2 px-6 py-2.5 bg-[var(--text-primary)] text-[var(--bg-main)] rounded-full text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-black/10"
        >
          <Maximize2 className="w-4 h-4" />
          格式化 JSON
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-[#d96570] text-sm animate-in fade-in slide-in-from-top-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          无效的 JSON 格式，请检查语法
        </div>
      )}

      {output && (
        <div className="relative group animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="absolute top-4 right-4 flex gap-2 z-10">
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-surface)]/80 backdrop-blur border border-[var(--border-color)] rounded-full text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--hover-color)] transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-500" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  复制结果
                </>
              )}
            </button>
          </div>
          <pre className="p-6 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-[28px] font-mono text-sm text-[var(--text-primary)] overflow-x-auto custom-scrollbar shadow-inner max-h-[500px]">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}
