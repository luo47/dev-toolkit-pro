import { motion } from "framer-motion";
import { Copy, Key, Loader2, RefreshCw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useAppStore } from "../../store";
import type { ShareContent } from "../../types";

interface TokenModalProps {
  share: ShareContent;
  onClose: () => void;
  onUpdate: () => void;
}

export default function TokenModal({ share, onClose, onUpdate }: TokenModalProps) {
  const { isDarkMode } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [currentToken, setCurrentToken] = useState(share.editToken);

  const copyToken = () => {
    if (!currentToken) return;
    navigator.clipboard.writeText(currentToken);
    window.showToast?.("密钥已复制到剪贴板", "success");
  };

  const regenerateToken = async () => {
    if (!confirm("重新生成密钥将导致旧密钥立即失效，确定要继续吗？")) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/shares/${share.id}/token/regenerate`, { method: "POST" });
      const data = (await response.json()) as { success: boolean; editToken?: string; error?: string };
      if (data.success && data.editToken) {
        setCurrentToken(data.editToken);
        window.showToast?.("新密钥已生成", "success");
        onUpdate();
      } else {
        window.showToast?.(data.error || "操作失败", "error");
      }
    } catch (error) {
      console.error(error);
      window.showToast?.("网络错误", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteToken = async () => {
    if (!confirm("注销密钥后，该分享将无法再通过公共接口修改。确定要注销吗？")) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/shares/${share.id}/token`, { method: "DELETE" });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (data.success) {
        setCurrentToken(undefined);
        window.showToast?.("修改密钥已注销", "success");
        onUpdate();
      } else {
        window.showToast?.(data.error || "操作失败", "error");
      }
    } catch (error) {
      console.error(error);
      window.showToast?.("网络错误", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`fixed inset-0 z-[120] flex items-center justify-center p-6 backdrop-blur-3xl ${isDarkMode ? "bg-black/90" : "bg-black/10"}`}
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-[var(--bg-surface)] border border-[var(--border-color)] w-full max-w-[500px] rounded-[40px] overflow-hidden shadow-2xl"
      >
        <div className="p-8 flex justify-between items-center border-b border-[var(--border-color)]">
          <h2 className="text-xl font-bold flex items-center gap-3">
            <Key className="text-yellow-500" size={20} />
            <span className="text-[var(--text-primary)]">管理修改密钥</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50 block">
              当前密钥 (Edit Token)
            </span>
            <div className="flex gap-2">
              <div className="flex-1 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-2xl p-4 font-mono text-sm break-all flex items-center min-h-[56px]">
                {currentToken ? (
                  <span className="text-[var(--text-primary)]">{currentToken}</span>
                ) : (
                  <span className="text-[var(--text-secondary)] italic">未启用（无法通过公共接口修改）</span>
                )}
              </div>
              {currentToken && (
                <button
                  type="button"
                  onClick={copyToken}
                  className="w-14 h-14 shrink-0 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl flex items-center justify-center text-[var(--text-secondary)] hover:text-blue-500 hover:border-blue-500 transition-all active:scale-90"
                  title="复制密钥"
                >
                  <Copy size={20} />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={regenerateToken}
              disabled={isLoading}
              className="h-14 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-500 hover:text-white transition-all active:scale-95 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
              <span>{currentToken ? "重置密钥" : "启用密钥"}</span>
            </button>

            <button
              type="button"
              onClick={deleteToken}
              disabled={isLoading || !currentToken}
              className="h-14 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all active:scale-95 disabled:opacity-50"
            >
              <Trash2 size={18} />
              <span>禁用密钥</span>
            </button>
          </div>

          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed opacity-60 bg-[var(--bg-main)] p-4 rounded-xl">
            提示：修改密钥（Edit Token）是允许通过公共 API
            匿名更新此分享内容的凭证。请勿将其泄露给他人。如果你不再需要此功能，可以点击“禁用密钥”。
          </p>

          {currentToken && (
            <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">API 调用示例</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">
                      Curl (命令行)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const code = `curl -X POST ${window.location.origin}/api/public/share/${share.id}/update \
  -H "Content-Type: application/json" \
  -d '{"editToken": "${currentToken}", "content": "新内容"}'`;
                        navigator.clipboard.writeText(code);
                        window.showToast?.("Curl 示例已复制", "success");
                      }}
                      className="text-[10px] text-blue-500 hover:underline"
                    >
                      复制
                    </button>
                  </div>
                  <pre className="bg-black/20 p-4 rounded-xl font-mono text-[11px] break-all whitespace-pre-wrap text-[var(--text-secondary)] border border-[var(--border-color)]">
                    curl -X POST {window.location.origin}/api/public/share/{share.id}/update \<br />
                    {"  "}-H "Content-Type: application/json" \<br />
                    {"  "}-d '{'{"editToken": "{currentToken}", "content": "新内容"}'}'
                  </pre>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter">
                      JavaScript (Fetch)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const code = `fetch("${window.location.origin}/api/public/share/${share.id}/update", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    editToken: "${currentToken}",
    content: "这是通过 API 更新的内容"
  })
}).then(res => res.json()).then(console.log);`;
                        navigator.clipboard.writeText(code);
                        window.showToast?.("Fetch 示例已复制", "success");
                      }}
                      className="text-[10px] text-emerald-500 hover:underline"
                    >
                      复制
                    </button>
                  </div>
                  <pre className="bg-black/20 p-4 rounded-xl font-mono text-[11px] break-all whitespace-pre-wrap text-[var(--text-secondary)] border border-[var(--border-color)]">
                    await fetch("{window.location.origin}/api/public/share/{share.id}/update", {"{"}
                    <br />
                    {"  "}method: "POST",
                    <br />
                    {"  "}headers: {"{"} "Content-Type": "application/json" {"}"},
                    <br />
                    {"  "}body: JSON.stringify({"{"}
                    <br />
                    {"    "}editToken: "{currentToken}",
                    <br />
                    {"    "}content: "新内容"
                    <br />
                    {"  "}
                    {"}"})
                    <br />
                    {"}"});
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-8 bg-[var(--bg-main)] border-t border-[var(--border-color)]">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-14 bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-2xl font-bold hover:bg-[var(--hover-color)] transition-all active:scale-95"
          >
            返回
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
