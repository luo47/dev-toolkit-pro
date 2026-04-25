import { Code, FileSearch, PlugZap, QrCode, Server } from "lucide-react";
import type { ToolMetadata } from "../../types";

export const BREAKPOINTS = { LG: 1024 };

export const tools: ToolMetadata[] = [
  {
    id: "cloud-share",
    name: "云分享",
    icon: Server,
    description: "极简且高效的云端资产同步工具，支持文本片段与多文件包分享。",
    action: { type: "internal" },
    isWide: true,
  },
  {
    id: "code-snippets",
    name: "代码片段",
    icon: Code,
    description: "代码片段管理工具，带有标签过滤和一键复制功能。",
    action: { type: "premium" },
    isWide: true,
  },
  {
    id: "chain-processor",
    name: "链式文本处理",
    icon: FileSearch,
    description: "强大的链式文本处理引擎，支持 JS、JSONPath 等多种处理步骤。",
    action: { type: "premium" },
    isWide: true,
  },
  {
    id: "qrcode",
    name: "二维码",
    icon: QrCode,
    description: "二维码生成与识别，支持实时生成及图片识别。",
    action: { type: "internal" },
    layoutVariant: "plain",
  },
  {
    id: "openai-api-tester",
    name: "OPENAI-API测试",
    icon: PlugZap,
    description: "使用外部工具检测 OpenAI 及兼容接口的可用性，支持多模型列表与对话接口诊断。",
    action: { type: "external", url: "https://ai-model-tester.928496.xyz/" },
  },
];
