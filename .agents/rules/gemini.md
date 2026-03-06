---
trigger: always_on
---

# Dev Toolkit Pro - 项目指南

## 1. 系统简介
Dev Toolkit Pro 是一个面向开发者的全栈工具箱 Web 应用。它提供了多种常用的开发辅助工具（如 JSON 格式化、JSON/CSV 转换、Base64 编码/解码、代理链接转换、二维码生成与识别等）。项目采用了最新的前后端协同的无服务器架构 (Serverless)，集成了 GitHub OAuth 登录机制以及工具使用情况的统计分析功能。

## 2. 技术栈

### 前端 (Frontend)
*   **核心框架**: React 19, Vite 6
*   **样式方案**: TailwindCSS v4
*   **组件与动画**: lucide-react (图标), motion (动画)
*   **工具库**: jsqr (二维码解析), qrcode.react (二维码生成)

### 后端 / Serverless
*   **服务框架**: Hono
*   **运行环境**: Cloudflare Workers
*   **数据库**: Cloudflare D1 (用于存储用户数据、OAuth 会话状态及工具使用频次统计)
*   **认证系统**: GitHub OAuth

### 开发规范与工具
*   **语言**: TypeScript 5.8
*   **包管理器**: pnpm (根据全局规则要求，严格采用 pnpm 工具链)
*   **部署工具**: Wrangler

## 3. 项目结构
```text
dev-toolkit-pro/
├── dist/               # 前端打包输出目录
├── migrations/         # Cloudflare D1 数据库的 SQL 迁移脚本
├── public/             # 静态资源文件
├── server/             # Hono 后端 API 服务代码 (包括 auth和核心业务 index.ts)
├── src/                # 源代码目录
│   ├── components/     # React 界面组件 (包含所有的工具 UI 和页面如 Home, Login 等)
│   ├── hooks/          # 自定义 React Hooks
│   ├── App.tsx         # 前端主入口应用组件
│   ├── main.tsx        # 前端渲染挂载点
│   └── index.css       # Tailwind 引入和全局样式文件
├── package.json        # 项目依赖、脚本配置
├── tsconfig.json       # TypeScript 编译配置
├── vite.config.ts      # Vite 构建配置和前端开发服务器设定
└── wrangler.toml       # Cloudflare 本地及远端运行配置 (数据库绑定配置等)
```

## 4. 常用命令
> **重要规则**: 总是使用白名单命令（例如：`pnpm`, `busybox`, `pnpx`）。严禁使用复合命令 (如 `cd && pwd`)。

*   **安装依赖**:
    `pnpm install`
*   **启动全栈本地开发环境** (Wrangler 环境整合前端):
    `pnpm run dev`
*   **单独启动前端开发服务器**:
    `pnpm run dev:frontend`
*   **执行项目构建**:
    `pnpm run build`
*   **预览生产环境构建效果**:
    `pnpm run preview`
*   **清理构建输出文件 (纯天然 busybox 命令实现)**:
    `pnpm run clean`
*   **执行 TypeScript 静态类型检查**:
    `pnpm run lint`
*   **一键统筹部署到 Cloudflare 服务**:
    `pnpm run deploy`
*   **在本地测试环境中执行数据库迁移**:
    `pnpm run db:migrate:local`
*   **在线上生产环境中应用数据库迁移**:
    `pnpm run db:migrate`
---
## 完成标准
- pnpm run deploy成功
- `git push`成功