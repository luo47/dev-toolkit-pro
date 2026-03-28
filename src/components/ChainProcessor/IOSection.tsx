import { AlertCircle, Check, Copy, Download, Play, Settings2, Trash2, Upload } from "lucide-react";
import type React from "react";

interface IOSectionProps {
  input: string;
  output: string;
  error: { stepId: string; message: string } | null;
  isDragging: boolean;
  copied: boolean;
  onInputChange: (val: string) => void;
  onClearInput: () => void;
  onFileUpload: (file: File) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onExportOutput: () => void;
  onCopyOutput: () => void;
  children?: React.ReactNode;
}

export default function IOSection({
  input,
  output,
  error,
  isDragging,
  copied,
  onInputChange,
  onClearInput,
  onFileUpload,
  onDrop,
  onDragOver,
  onDragLeave,
  onPaste,
  onExportOutput,
  onCopyOutput,
  children,
}: IOSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Column 1: Input */}
      <div className="flex flex-col gap-3 h-[calc(100vh-240px)] min-h-[450px]">
        <div className="flex items-center justify-between shrink-0">
          <label className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            原始输入
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={onClearInput}
              className="p-1.5 hover:bg-[var(--hover-color)] rounded-lg text-[var(--text-secondary)] hover:text-red-500 transition-all"
              title="清空输入"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <label
              className="p-1.5 hover:bg-[var(--hover-color)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent-color)] transition-all cursor-pointer"
              title="上传文件"
            >
              <Upload className="w-4 h-4" />
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFileUpload(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
        <div
          className={`relative group flex-1 rounded-2xl transition-all ${isDragging ? "ring-2 ring-[var(--accent-color)] ring-offset-2 ring-offset-[var(--bg-main)]" : ""}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onPaste={onPaste}
            placeholder="输入待处理的文本、JSON 或 HTML... (支持拖拽或粘贴文件)"
            className="w-full h-full p-4 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all resize-none custom-scrollbar"
          />
          {isDragging && (
            <div className="absolute inset-0 bg-[var(--accent-color)]/5 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-200">
              <Upload className="w-10 h-10 text-[var(--accent-color)] mb-2 animate-bounce" />
              <p className="text-sm font-bold text-[var(--accent-color)]">松开鼠标以上传文件</p>
            </div>
          )}
        </div>
      </div>

      {/* Column 2: Steps (Filled by parent) */}
      <div className="flex flex-col gap-3 h-[calc(100vh-240px)] min-h-[450px]">{children}</div>

      {/* Column 3: Output */}
      <div className="flex flex-col gap-3 h-[calc(100vh-240px)] min-h-[450px]">
        <div className="flex items-center justify-between shrink-0">
          <label className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
            <Play className="w-4 h-4" />
            处理结果
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={onExportOutput}
              disabled={!output}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--hover-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg text-xs font-medium transition-all disabled:opacity-50"
              title="导出为文件"
            >
              <Download className="w-3.5 h-3.5" />
              导出结果
            </button>
            <button
              onClick={onCopyOutput}
              disabled={!output}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                copied
                  ? "bg-green-500/10 text-green-500"
                  : "bg-[var(--hover-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "已复制" : "复制结果"}
            </button>
          </div>
        </div>
        <textarea
          readOnly
          value={output}
          placeholder="处理后的结果将显示在这里..."
          className="flex-1 w-full p-4 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl text-sm font-mono outline-none resize-none custom-scrollbar"
        />
        {error?.stepId === "global" && (
          <div className="shrink-0 p-3 bg-[var(--error-color)]/10 border border-[var(--error-color)]/20 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[var(--error-color)] shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--error-color)] leading-relaxed">{error.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
