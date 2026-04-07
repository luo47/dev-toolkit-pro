declare global {
  interface Window {
    openLoginModal?: () => void;
    showToast?: (message: string, type?: "success" | "error") => void;
  }

  interface ImportMetaEnv {
    readonly VITE_API_URL: string;
    // 可以在此添加其他环境变量
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};
