import React, { useState, useRef, useEffect } from 'react';
import { QrCode, Upload, Copy, Check, Trash2, Image as ImageIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import jsQR from 'jsqr';
import { useAppStore } from '../store';

export default function QRCodeTool() {
  const { isDarkMode } = useAppStore();
  const [text, setText] = useState('https://example.com');
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopy = () => {
    if (scanResult) {
      navigator.clipboard.writeText(scanResult);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const processImage = (file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          setScanResult(code.data);
          addToHistory('scan', code.data);
        } else {
          setError('未能识别二维码，请确保图片清晰且包含有效的二维码。');
          setScanResult(null);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processImage(file);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) processImage(file);
      }
    }
  };

  const [history, setHistory] = useState<{id: number, type: 'generate' | 'scan', content: string, date: string}[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('qr_history');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('qr_history', JSON.stringify(history));
  }, [history]);

  const addToHistory = (type: 'generate' | 'scan', content: string) => {
    setHistory(prev => [{id: Date.now(), type, content, date: new Date().toLocaleString()}, ...prev].slice(0, 5));
  };

  const removeFromHistory = (id: number) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearHistory = () => {
    setHistory([]);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4" onPaste={onPaste}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Generation Section */}
        <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-color)] space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <QrCode className="w-5 h-5 text-[var(--accent-color)]" />
            <h3 className="font-bold text-lg">生成二维码</h3>
          </div>
          
          <div className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl p-4 relative group">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={() => {
                if (text) addToHistory('generate', text);
              }}
              placeholder="https://example.com"
              className="w-full bg-transparent outline-none text-sm pr-10"
            />
            {text && (
              <button
                onClick={() => setText('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-[var(--hover-color)] rounded-full text-[var(--text-secondary)] hover:text-red-500 transition-all md:opacity-0 md:group-hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex justify-center p-6 bg-white rounded-2xl border border-[var(--border-color)] shadow-inner">
            {text ? (
              <QRCodeSVG 
                value={text} 
                size={200} 
                level="H" 
                includeMargin={true}
                fgColor="#000000"
                bgColor="#ffffff"
              />
            ) : (
              <div className="w-[200px] h-[200px] flex items-center justify-center text-gray-300">
                等待输入...
              </div>
            )}
          </div>
        </div>

        {/* Recognition Section */}
        <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-color)] space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <ImageIcon className="w-5 h-5 text-[var(--accent-color)]" />
            <h3 className="font-bold text-lg">识别二维码</h3>
          </div>
          
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-64 border-2 border-dashed border-[var(--border-color)] rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-[var(--hover-color)] transition-all group"
          >
            <Upload className="w-8 h-8 text-[var(--text-secondary)] group-hover:text-[var(--accent-color)] transition-colors" />
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--text-primary)]">点击或拖拽图片到此处</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">支持粘贴剪贴板图片</p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onFileChange}
              accept="image/*"
              className="hidden"
            />
          </div>

          <div className="text-center text-sm text-[var(--text-secondary)]">
            {error ? <span className="text-red-500">{error}</span> : (scanResult ? scanResult : '等待上传图片...')}
          </div>
        </div>
      </div>
      
      {/* History Section */}
      <div className="bg-[var(--bg-surface)] p-6 rounded-3xl border border-[var(--border-color)]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">历史记录</h3>
          {history.length > 0 && (
            <button onClick={() => {
              if (confirm('确定要清除所有历史记录吗？')) clearHistory();
            }} className="text-[var(--text-secondary)] hover:text-red-500">
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">暂无记录</p>
          ) : (
            history.map((item) => (
              <div key={item.id} className="flex justify-between items-center p-3 bg-[var(--bg-main)] rounded-xl text-sm">
                <span className="truncate max-w-[70%]">{item.content}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text-secondary)]">{item.date}</span>
                  <button onClick={() => removeFromHistory(item.id)} className="text-[var(--text-secondary)] hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
