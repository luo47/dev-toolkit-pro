import React, { useState } from 'react';
import { FileText, Copy, Check, Download, ArrowLeftRight, Code } from 'lucide-react';

export default function JsonCsvConverter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<'json-to-csv' | 'csv-to-json'>('json-to-csv');

  const flattenObject = (obj: any, prefix = ''): any => {
    return Object.keys(obj).reduce((acc: any, k) => {
      const pre = prefix.length ? prefix + '.' : '';
      if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
        Object.assign(acc, flattenObject(obj[k], pre + k));
      } else {
        acc[pre + k] = obj[k];
      }
      return acc;
    }, {});
  };

  const convertToCsv = () => {
    setError('');
    setOutput('');
    if (!input.trim()) return;

    try {
      const json = JSON.parse(input);
      let data = Array.isArray(json) ? json : [json];

      if (data.length === 0) {
        setError('JSON array is empty');
        return;
      }

      // Flatten objects if they are nested
      data = data.map(item => flattenObject(item));

      const headers = Array.from(
        new Set(data.flatMap(obj => Object.keys(obj)))
      );

      const csvRows = [];
      csvRows.push(headers.join(','));

      for (const row of data) {
        const values = headers.map(header => {
          const val = row[header];
          const escaped = ('' + (val ?? '')).replace(/"/g, '""');
          return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
      }

      setOutput(csvRows.join('\n'));
    } catch (e) {
      setError('Invalid JSON format. Please provide a JSON object or an array of objects.');
    }
  };

  const convertToJson = () => {
    setError('');
    setOutput('');
    if (!input.trim()) return;

    try {
      const lines = input.trim().split('\n');
      if (lines.length < 2) {
        setError('CSV must have at least a header row and one data row.');
        return;
      }

      // Simple CSV parser (handles basic cases, not full RFC 4180)
      const parseLine = (line: string) => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              cur += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(cur.trim());
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim());
        return result;
      };

      const headers = parseLine(lines[0]);
      const jsonData = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i]);
        const obj: any = {};
        headers.forEach((header, index) => {
          let val = values[index] || '';
          // Try to parse numbers or booleans
          if (val.toLowerCase() === 'true') val = true;
          else if (val.toLowerCase() === 'false') val = false;
          else if (!isNaN(Number(val)) && val !== '') val = Number(val);
          
          obj[header] = val;
        });
        jsonData.push(obj);
      }

      setOutput(JSON.stringify(jsonData, null, 2));
    } catch (e) {
      setError('Error parsing CSV. Please check your format.');
    }
  };

  const handleConvert = () => {
    if (mode === 'json-to-csv') {
      convertToCsv();
    } else {
      convertToJson();
    }
  };

  const toggleMode = () => {
    setMode(prev => prev === 'json-to-csv' ? 'csv-to-json' : 'json-to-csv');
    setInput('');
    setOutput('');
    setError('');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadResult = () => {
    const extension = mode === 'json-to-csv' ? 'csv' : 'json';
    const mimeType = mode === 'json-to-csv' ? 'text/csv' : 'application/json';
    const blob = new Blob([output], { type: `${mimeType};charset=utf-8;` });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `converted_data.${extension}`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 p-1 bg-[var(--bg-input)] rounded-full border border-[var(--border-color)]">
          <button
            onClick={() => { setMode('json-to-csv'); setInput(''); setOutput(''); }}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              mode === 'json-to-csv' ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            JSON 转 CSV
          </button>
          <button
            onClick={() => { setMode('csv-to-json'); setInput(''); setOutput(''); }}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              mode === 'csv-to-json' ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            CSV 转 JSON
          </button>
        </div>
        
        <button 
          onClick={toggleMode}
          className="p-2 hover:bg-[var(--hover-color)] rounded-full text-[var(--text-secondary)] transition-colors"
          title="切换模式"
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2 relative group">
        <div className="flex items-center justify-between px-1">
          <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
            {mode === 'json-to-csv' ? '输入 JSON (对象或数组)' : '输入 CSV 数据'}
          </label>
          <button
            onClick={() => setInput('')}
            className="text-[10px] font-bold text-[var(--text-secondary)] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
          >
            清空输入
          </button>
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full h-64 p-5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-[24px] font-mono text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent outline-none transition-all resize-none"
          placeholder={mode === 'json-to-csv' 
            ? '{"name": "John", "age": 30, "details": {"city": "NY"}}'
            : 'name,age\nJohn,30\nJane,25'
          }
        />
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={handleConvert}
          className="px-6 py-2.5 bg-[var(--text-primary)] text-[var(--bg-main)] rounded-full text-sm font-medium hover:opacity-90 transition-colors flex items-center gap-2"
        >
          {mode === 'json-to-csv' ? <FileText className="w-4 h-4" /> : <Code className="w-4 h-4" />}
          转换为 {mode === 'json-to-csv' ? 'CSV' : 'JSON'}
        </button>
      </div>

      {error && <p className="text-[#d96570] text-sm px-2">转换出错，请检查格式</p>}

      {output && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
              {mode === 'json-to-csv' ? 'CSV 结果' : 'JSON 结果'}
            </label>
            <div className="flex gap-2">
              <button
                onClick={downloadResult}
                className="p-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-full hover:bg-[var(--hover-color)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                title={`下载 ${mode === 'json-to-csv' ? 'CSV' : 'JSON'}`}
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={copyToClipboard}
                className="p-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-full hover:bg-[var(--hover-color)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                title="复制到剪贴板"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <pre className="p-5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-[24px] font-mono text-sm text-[var(--text-primary)] overflow-x-auto custom-scrollbar">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}
