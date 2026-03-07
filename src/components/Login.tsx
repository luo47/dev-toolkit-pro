import React, { useState } from 'react';
import { LogIn, X, Github, ShieldCheck, KeyRound } from 'lucide-react';

interface LoginProps {
  onLogin: (username: string) => void;
  onClose: () => void;
}

type LoginStep = 'credentials' | '2fa';

export default function Login({ onLogin, onClose }: LoginProps) {
  const [step, setStep] = useState<LoginStep>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && password.trim()) {
      setStep('2fa');
    }
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (twoFactorCode.length === 6) {
      onLogin(username);
      onClose();
    }
  };

  const handleSocialLogin = async (provider: string) => {
    if (provider === 'GitHub') {
      try {
        const baseUrl = (import.meta as any).env.VITE_API_URL || '';
        const res = await fetch(`${baseUrl}/api/auth/github/login?t=${Date.now()}`);
        const data = await res.json() as { url?: string };
        if (data.url) {
          // 在重定向到 GitHub 之前，记录当前路径以便登录后返回
          localStorage.setItem('redirect_to', window.location.pathname);
          window.location.href = data.url;
        } else {
          console.error('Failed to get GitHub login URL:', data);
        }
      } catch (err) {
        console.error('Error fetching GitHub login URL:', err);
      }
    } else {
      // Simulate social login skipping 2FA for demo
      onLogin(`${provider} 用户`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] w-full max-w-md rounded-2xl p-8 relative shadow-2xl overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-[var(--bg-main)] rounded-2xl flex items-center justify-center mb-4">
            {step === 'credentials' ? (
              <LogIn className="w-8 h-8 text-[var(--accent-color)]" />
            ) : (
              <ShieldCheck className="w-8 h-8 text-[var(--accent-color)] animate-pulse" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">
            {step === 'credentials' ? '欢迎回来' : '安全验证'}
          </h2>
          <p className="text-[var(--text-secondary)] text-sm mt-2 text-center">
            {step === 'credentials'
              ? '登录以解锁高级开发者工具和进阶功能。'
              : '请输入发送至您设备的 6 位验证码。'}
          </p>
        </div>

        {step === 'credentials' ? (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => handleSocialLogin('GitHub')}
                className="flex items-center justify-center gap-2 bg-[var(--bg-input)] border border-[var(--border-color)] hover:bg-[var(--hover-color)] text-[var(--text-primary)] py-2.5 rounded-xl transition-all text-sm font-medium"
              >
                <Github className="w-5 h-5" />
                GitHub
              </button>
              <button
                onClick={() => handleSocialLogin('Google')}
                className="flex items-center justify-center gap-2 bg-[var(--bg-input)] border border-[var(--border-color)] hover:bg-[var(--hover-color)] text-[var(--text-primary)] py-2.5 rounded-xl transition-all text-sm font-medium"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </button>
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border-color)]"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[var(--bg-surface)] px-2 text-[var(--text-secondary)]">或使用账号登录</span>
              </div>
            </div>

            <form onSubmit={handleNextStep} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                  用户名
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent outline-none transition-all"
                  placeholder="请输入用户名"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                  密码
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl pl-4 pr-10 py-3 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent outline-none transition-all"
                    placeholder="请输入密码"
                    required
                  />
                  <KeyRound className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-[var(--text-primary)] text-[var(--bg-main)] font-semibold py-3 rounded-xl hover:opacity-90 transition-all"
              >
                下一步
              </button>
            </form>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-left-4 duration-300">
            <form onSubmit={handleFinalSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-4 text-center">
                  双重身份验证 (2FA)
                </label>
                <div className="flex justify-center gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                    autoComplete="one-time-code"
                    className="w-full max-w-[200px] bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-4 text-center text-2xl font-bold tracking-[0.5em] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent outline-none transition-all"
                    placeholder="000000"
                    autoFocus
                    required
                  />
                </div>
                <p className="text-[var(--text-secondary)] text-[10px] mt-4 text-center">
                  验证码通常每 30 秒更新一次。
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('credentials')}
                  className="flex-1 bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] font-semibold py-3 rounded-xl hover:bg-[var(--hover-color)] transition-all"
                >
                  返回
                </button>
                <button
                  type="submit"
                  className="flex-[2] bg-[var(--accent-color)] text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-all shadow-lg shadow-[var(--accent-color)]/20"
                >
                  验证并登录
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-[var(--text-secondary)] text-[10px]">
            登录即表示您同意我们的服务条款和隐私政策。
          </p>
        </div>
      </div>
    </div>
  );
}
