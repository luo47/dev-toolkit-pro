# GEMINI.md - 项目上下文与开发指南

## 语言
- 始终使用中文进行交流

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
- `src/`: 源代码根目录
  - `src/App.tsx`: 前端主入口，负责路由和布局
  - `src/main.tsx`: React 渲染入口
  - `src/components/`: 存放各个工具的 UI 组件
  - `src/hooks/`: 自定义 React Hooks (如 `useAuth`)
  - `src/server/`: Hono 后端代码
    - `index.ts`: API 路由定义与入口
    - `auth.ts`: 认证相关逻辑
- `migrations/`: D1 数据库迁移 SQL 文件
- `public/`: 静态资源
- `wrangler.toml`: Cloudflare Workers/D1 配置文件

## 开发与运行

### 关键命令
- **构建项目**: `pnpm build`
- **部署到 Cloudflare**: `pnpm deploy`
- **本地数据库迁移**: `pnpm db:migrate:local`
- **远程数据库迁移**: `pnpm db:migrate`
- **类型检查**: `pnpm lint` (执行 `tsc --noEmit`)

### 环境变量
本地开发需创建 `.env` 或 `.dev.vars` 文件，包含以下配置：
- `GITHUB_CLIENT_ID`: GitHub OAuth 客户端 ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth 客户端密钥

## 开发规范
1. **TypeScript**: 始终使用严格类型定义。
2. **样式**: 使用 Tailwind CSS 4。注意项目使用 CSS 变量（如 `--bg-main`, `--accent-color`）进行主题控制。
3. **API 路由**: 后端接口必须以 `/api/` 开头。
4. **数据库操作**: 使用 Cloudflare D1 的 `prepare` 和 `bind` 方法以防止 SQL 注入。
5. **组件设计**: 工具类组件应保持独立，放在 `src/components/` 下。
