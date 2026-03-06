import { useState } from 'react';

export default function Base64Encoder() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');

  const encode = () => {
    setOutput(btoa(input));
  };

  const decode = () => {
    try {
      setOutput(atob(input));
    } catch (e) {
      setOutput('Invalid Base64');
    }
  };

  return (
    <div className="space-y-6">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="w-full h-64 p-5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-[24px] font-mono text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent outline-none transition-all resize-none"
        placeholder="在此输入文本或 Base64 字符串..."
      />
      <div className="flex gap-3 justify-end">
        <button
          onClick={decode}
          className="px-6 py-2.5 bg-[var(--hover-color)] text-[var(--text-primary)] rounded-full text-sm font-medium hover:opacity-80 transition-colors"
        >
          解码
        </button>
        <button
          onClick={encode}
          className="px-6 py-2.5 bg-[var(--text-primary)] text-[var(--bg-main)] rounded-full text-sm font-medium hover:opacity-90 transition-colors"
        >
          编码
        </button>
      </div>
      {output && (
        <pre className="p-5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-[24px] font-mono text-sm text-[var(--text-primary)] overflow-x-auto custom-scrollbar">
          {output}
        </pre>
      )}
    </div>
  );
}
