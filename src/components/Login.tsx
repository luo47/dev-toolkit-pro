import { Github, LogIn, X } from "lucide-react";
import { useAppStore } from "../store";
import "../types";

interface LoginProps {
  onLogin: (username: string) => void;
  onClose: () => void;
}

export default function Login({ onLogin, onClose }: LoginProps) {
  const { isDarkMode } = useAppStore();

  const handleGithubLogin = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${baseUrl}/api/auth/github/login?t=${Date.now()}`);
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        // 在重定向到 GitHub 之前，记录当前路径以便登录后返回
        localStorage.setItem("redirect_to", window.location.pathname);
        onLogin("GitHub 用户");
        window.location.href = data.url;
      } else {
        console.error("获取 GitHub 登录地址失败:", data);
      }
    } catch (error) {
      console.error("请求 GitHub 登录地址异常:", error);
    }
  };

  return (
    <div
      className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4 ${isDarkMode ? "bg-black/80" : "bg-black/20"}`}
    >
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] w-full max-w-md rounded-2xl p-8 relative shadow-2xl overflow-hidden">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-[var(--bg-main)] rounded-2xl flex items-center justify-center mb-4">
            <LogIn className="w-8 h-8 text-[var(--accent-color)]" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">欢迎回来</h2>
          <p className="text-[var(--text-secondary)] text-sm mt-2 text-center">
            使用 GitHub 登录以解锁高级开发者工具和进阶功能。
          </p>
        </div>

        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
          <button
            type="button"
            onClick={handleGithubLogin}
            className="w-full flex items-center justify-center gap-3 bg-[var(--bg-input)] border border-[var(--border-color)] hover:bg-[var(--hover-color)] text-[var(--text-primary)] py-4 rounded-xl transition-all text-base font-medium"
          >
            <Github className="w-5 h-5" />
            使用 GitHub 登录
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[var(--text-secondary)] text-[10px]">登录即表示您同意我们的服务条款和隐私政策。</p>
        </div>
      </div>
    </div>
  );
}
