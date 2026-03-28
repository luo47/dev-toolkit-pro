import { Code, FileSearch, PlugZap, QrCode, Server } from "lucide-react";
import type { ToolId, ToolMetadata } from "../../types";

export const BREAKPOINTS = { LG: 1024 };

export const tools: ToolMetadata[] = [
  { id: "cloud-share", name: "云分享", icon: Server, isPremium: false },
  { id: "code-snippets", name: "代码片段", icon: Code, isPremium: true },
  { id: "chain-processor", name: "链式文本处理", icon: FileSearch, isPremium: true },
  { id: "qrcode", name: "二维码", icon: QrCode, isPremium: false },
  { id: "openai-api-tester", name: "OPENAI-API测试", icon: PlugZap, isPremium: false },
];

export const WIDE_TOOLS = new Set<ToolId>([
  "chain-processor",
  "code-snippets",
  "cloud-share",
  "openai-api-tester",
  "share-preview",
]);
