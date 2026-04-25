# GEMINI.md - 项目上下文与开发指南

## 语言与交互规范
- **全流程中文**: 始终使用中文进行交流。这包括但不限于：
  - **思考过程 (Thinking Process)**: 模型内部推理应尽可能使用中文。
  - **工具调用说明**: 在执行 shell 命令、文件操作等工具前的描述必须是中文。
  - **交互回复**: 所有对用户的反馈、分析和建议均使用中文。
  - **代码规范**:
    - **注释**: 源代码中的所有文档注释、函数说明和逻辑解释必须使用中文。
    - **日志**: 代码中的日志输出（如 `console.log`、调试信息等）必须使用中文描述。
    - **提交信息**: Git 提交信息 (Commit Messages) 必须使用中文。

## 完成标准
- `pnpm run deploy` 成功

## 项目概况
`dev-toolkit-pro` 是一个功能丰富的开发者工具箱应用，旨在提供一系列日常开发中常用的工具（如 JSON 格式化、Base64 编解码、代理协议转换、数据格式转换等）。

### 技术栈
- **前端**: React 19, Vite, Tailwind CSS v4, Lucide React (图标), Motion (动画)
- **后端**: Hono (运行在 Cloudflare Workers 上)
- **数据库**: Cloudflare D1 (SQLite)
- **身份验证**: GitHub OAuth
- **部署/工具**: Cloudflare Wrangler, pnpm

## 目录结构
- `src/`: 前端源代码根目录
  - `src/App.tsx`: 前端主入口，负责路由和全局布局
  - `src/main.tsx`: React 渲染入口
  - `src/store.ts`: 基于 Zustand 的全局状态管理
  - `src/components/`: 核心业务与 UI 组件库
    - `Home.tsx`: 首页工具导航
    - `Login.tsx`: GitHub OAuth 登录页面
    - `SearchBox.tsx`: 全局工具智能搜索与跳转
    - `ChainProcessor/`: 链式数据处理工具及核心算子
    - `CloudShare.tsx` & `cloud-share/`: 云端大文件分享与提取功能
    - `CodeSnippetsTool.tsx` & `code-snippets/`: 代码片段云端管理与多端同步
    - `OpenAIConnectivityTool.tsx`: (已移除，功能改为外部跳转)
    - `JsonCsvConverter.tsx`: 格式转换（JSON/CSV/TSV）工具
    - `QRCodeTool.tsx`: 灵活的二维码生成与扫描器
    - `app/`: 全局通用 UI 框架组件（Header, Sidebar, Toast 等）
  - `src/hooks/`: 逻辑解耦的 TypeScript Hooks (如 `useAuth`, `useDevice`)
  - `src/types.ts`: 核心领域模型定义
- `server/`: 运行在 Cloudflare Workers 上的 Hono 后端
  - `server/index.ts`: API 接口、路由定义与中间件
  - `server/auth.ts`: GitHub OAuth 认证逻辑与 Session 处理
- `migrations/`: 基于 D1 的 SQLite 数据库迁移脚本
- `wrangler.toml`: Cloudflare 生态 (Workers, D1, KV, R2) 的整体配置文件
- `vite.config.ts`: 基于 Vite 8 & Tailwind 4 的高性能构建配置
- `GEMINI.md`: 项目上下文、架构演进与开发规范指南

## 开发与运行

### 关键命令
- **构建项目**: `pnpm build`
- **部署到 Cloudflare**: `pnpm deploy`
- **远程数据库迁移**: `pnpm db:migrate`
- **类型检查**: `pnpm lint` (执行 `tsc --noEmit`)

## 开发规范
1. **TypeScript**: 始终使用严格类型定义。
2. **样式**: 使用 Tailwind CSS 4。注意项目使用 CSS 变量（如 `--bg-main`, `--accent-color`）进行主题控制。
3. **API 路由**: 后端接口必须以 `/api/` 开头。
4. **数据库操作**: 使用 Cloudflare D1 的 `prepare` 和 `bind` 方法以防止 SQL 注入。
5. **组件设计**: 工具类组件应保持独立，放在 `src/components/` 下。
