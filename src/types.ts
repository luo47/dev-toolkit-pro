import type React from "react";

export type ToolId =
  | "home"
  | "qrcode"
  | "chain-processor"
  | "code-snippets"
  | "cloud-share"
  | "openai-api-tester"
  | "share-preview";

export interface FileItem {
  key: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
}

export interface ShareContent {
  id: string;
  type: "text" | "file";
  content?: string;
  files?: FileItem[];
  totalSize?: number;
  name?: string;
  sourceType?: "snippet" | null;
  sourceId?: string | null;
  editToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolMetadata {
  id: ToolId;
  name: string;
  icon: React.ElementType;
  isPremium: boolean;
  subName?: string;
}

declare global {
  interface Window {
    openLoginModal?: () => void;
    showToast?: (message: string, type?: "success" | "error") => void;
  }

  interface ImportMetaEnv {
    readonly VITE_API_URL: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
