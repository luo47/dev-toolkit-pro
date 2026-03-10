interface Window {
  showToast?: (message: string, type?: 'success' | 'error') => void;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  // 可以在此添加其他环境变量
}
