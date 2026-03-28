import { motion } from "framer-motion";
import { ArrowRight, Loader2, Plus, Upload, X } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
import { useAppStore } from "../../store";
import type { ShareContent } from "../../types";
import type { SelectedFile } from "./cloudShareUtils";
import { formatSize } from "./cloudShareUtils";

interface UploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const createSelectedFiles = (files: File[]) =>
  files.map((file) => ({
    name: file.name,
    size: file.size,
    path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    raw: file,
  }));

function FileUploadArea({
  fileInputRef,
  folderInputRef,
  isDragover,
  selectedFiles,
  onClearFiles,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileInputChange,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  folderInputRef: React.RefObject<HTMLInputElement | null>;
  isDragover: boolean;
  selectedFiles: SelectedFile[];
  onClearFiles: () => void;
  onDragLeave: () => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onFileInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`min-h-[300px] border-2 border-dashed rounded-[32px] flex flex-col items-center justify-center p-8 transition-all ${isDragover ? "border-emerald-500 bg-emerald-500/5" : "border-[var(--border-color)] hover:border-emerald-500/30"}`}
    >
      {selectedFiles.length > 0 ? (
        <div className="w-full">
          <div className="flex justify-between items-end mb-6">
            <div>
              <p className="text-3xl font-black italic">
                {selectedFiles.length < 10 ? `0${selectedFiles.length}` : selectedFiles.length}
              </p>
              <p className="text-[10px] uppercase font-bold text-[var(--text-secondary)] opacity-50 tracking-widest">
                已选资产
              </p>
            </div>
            <button onClick={onClearFiles} className="text-xs font-bold text-red-500 underline">
              清除
            </button>
          </div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
            {selectedFiles.map((file) => (
              <div
                key={`${file.path}-${file.size}`}
                className="flex justify-between p-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-xs font-mono"
              >
                <span className="truncate text-[var(--text-primary)] opacity-70">{file.path}</span>
                <span className="text-[var(--text-secondary)] opacity-40 ml-4">
                  {formatSize(file.size)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <Upload className="text-[var(--text-secondary)] opacity-20 mb-4" size={48} />
          <p className="text-[var(--text-secondary)] opacity-60 text-sm mb-6">
            释放资产以进行云同步
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="h-12 px-6 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--hover-color)] transition-all"
            >
              选择文件
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              className="h-12 px-6 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--hover-color)] transition-all"
            >
              选择文件夹
            </button>
          </div>
        </>
      )}
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={onFileInputChange}
        className="hidden"
      />
      <input
        type="file"
        multiple
        ref={folderInputRef}
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        onChange={onFileInputChange}
        className="hidden"
      />
    </div>
  );
}

export default function UploadModal({ onClose, onSuccess }: UploadModalProps) {
  const { isDarkMode } = useAppStore();
  const [shareType, setShareType] = useState<"text" | "file">("text");
  const [textContent, setTextContent] = useState("");
  const [shareName, setShareName] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragover, setIsDragover] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []) as File[];
    setSelectedFiles((prev) => [...prev, ...createSelectedFiles(files)]);
    setShareType("file");
  };

  const createTextShare = async () => {
    if (!textContent.trim()) return;
    setIsUploading(true);
    try {
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: textContent }),
      });
      const data = (await response.json()) as {
        success: boolean;
        data?: ShareContent;
        error?: string;
      };
      if (data.success) {
        window.showToast?.("文本分享创建成功", "success");
        onSuccess();
      }
    } catch (error) {
      console.error(error);
      window.showToast?.("创建失败，请重试", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const createFileShare = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);

    const formData = new FormData();
    formData.append("name", shareName || selectedFiles[0].name);
    selectedFiles.forEach((file) => formData.append("files", file.raw, file.path));

    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      window.showToast?.(
        xhr.status >= 200 && xhr.status < 300 ? "资产同步完成" : "同步失败",
        xhr.status >= 200 && xhr.status < 300 ? "success" : "error",
      );
      if (xhr.status >= 200 && xhr.status < 300) {
        onSuccess();
      }
      setIsUploading(false);
    };
    xhr.onerror = () => {
      window.showToast?.("网络连接异常", "error");
      setIsUploading(false);
    };
    xhr.open("POST", "/api/files");
    xhr.send(formData);
  };

  const createShare = async () => {
    if (shareType === "text") {
      await createTextShare();
      return;
    }
    await createFileShare();
  };

  const canSubmit = shareType === "text" ? !!textContent.trim() : selectedFiles.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-xl ${isDarkMode ? "bg-black/80" : "bg-black/20"}`}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-[var(--bg-surface)] border border-[var(--border-color)] w-full max-w-[800px] rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between opacity-80">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${shareType === "text" ? "bg-blue-500/10 text-blue-500" : "bg-emerald-500/10 text-emerald-500"}`}
            >
              <Plus size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">创建新分享</h2>
              <div className="flex gap-4 mt-1">
                <button
                  onClick={() => setShareType("text")}
                  className={`text-xs font-bold uppercase transition-colors ${shareType === "text" ? "text-blue-500" : "text-[var(--text-secondary)]"}`}
                >
                  纯文本
                </button>
                <button
                  onClick={() => setShareType("file")}
                  className={`text-xs font-bold uppercase transition-colors ${shareType === "file" ? "text-emerald-500" : "text-[var(--text-secondary)]"}`}
                >
                  文件夹/文件
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-[var(--hover-color)] rounded-full transition-colors text-[var(--text-secondary)]"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
          {shareType === "text" ? (
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="粘贴您的文本或代码..."
              className="w-full h-[300px] bg-[var(--bg-input)] border border-[var(--border-color)] rounded-2xl p-6 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all resize-none shadow-inner"
            />
          ) : (
            <FileUploadArea
              fileInputRef={fileInputRef}
              folderInputRef={folderInputRef}
              isDragover={isDragover}
              selectedFiles={selectedFiles}
              onClearFiles={() => setSelectedFiles([])}
              onDragLeave={() => setIsDragover(false)}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragover(true);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragover(false);
              }}
              onFileInputChange={handleFileInputChange}
            />
          )}

          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] opacity-50 tracking-widest ml-1">
              分享名称 (可选)
            </span>
            <input
              type="text"
              placeholder="给本次分享取个名字..."
              value={shareName}
              onChange={(e) => setShareName(e.target.value)}
              className="w-full h-14 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-2xl px-5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
            />
          </div>
        </div>

        <div className="p-8 bg-[var(--bg-main)] border-t border-[var(--border-color)]">
          <button
            disabled={isUploading || !canSubmit}
            onClick={createShare}
            className={`w-full h-16 rounded-[22px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all relative overflow-hidden ${isUploading ? "bg-[var(--border-color)] text-[var(--text-secondary)]" : "bg-[var(--accent-color)] text-white hover:scale-[1.02] active:scale-95 shadow-xl shadow-blue-500/20"}`}
          >
            {isUploading ? (
              <>
                <div
                  className="absolute inset-0 bg-blue-500/20 origin-left transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
                <Loader2 className="animate-spin" size={24} />
                <span className="relative z-10">{uploadProgress}% 正在同步</span>
              </>
            ) : (
              <>
                <span>开始创建分享</span>
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
