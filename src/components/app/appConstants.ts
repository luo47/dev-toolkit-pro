import { Code, FileSearch, PlugZap, QrCode, Server } from "lucide-react";
import type { ToolMetadata } from "../../types";

export const BREAKPOINTS = { LG: 1024 };

export const tools: ToolMetadata[] = [
  { id: "cloud-share", name: "云分享", icon: Server, action: { type: "internal" }, isWide: true },
  { id: "code-snippets", name: "代码片段", icon: Code, action: { type: "premium" }, isWide: true },
  { id: "chain-processor", name: "链式文本处理", icon: FileSearch, action: { type: "premium" }, isWide: true },
  { id: "qrcode", name: "二维码", icon: QrCode, action: { type: "internal" }, layoutVariant: "plain" },
  {
    id: "openai-api-tester",
    name: "OPENAI-API测试",
    icon: PlugZap,
    action: { type: "external", url: "https://ai-model-tester.928496.xyz/" },
  },
];
