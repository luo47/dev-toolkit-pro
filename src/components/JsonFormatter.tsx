import { useState } from 'react';

export default function JsonFormatter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const formatJson = () => {
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed, null, 2));
      setError('');
    } catch (e) {
      setError('Invalid JSON');
      setOutput('');
    }
  };

  return (
    <div className="space-y-6">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="w-full h-64 p-5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-[24px] font-mono text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent outline-none transition-all resize-none"
        placeholder="请在此粘贴 JSON..."
      />
      <div className="flex justify-end">
        <button
          onClick={formatJson}
          className="px-6 py-2.5 bg-[var(--text-primary)] text-[var(--bg-main)] rounded-full text-sm font-medium hover:opacity-90 transition-all"
        >
          格式化 JSON
        </button>
      </div>
      {error && <p className="text-[#d96570] text-sm px-2">无效的 JSON 格式</p>}
      {output && (
        <pre className="p-5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-[24px] font-mono text-sm text-[var(--text-primary)] overflow-x-auto custom-scrollbar">
          {output}
        </pre>
      )}
    </div>
  );
}
