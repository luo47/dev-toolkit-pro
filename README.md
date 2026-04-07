# Dev Toolkit Pro 开发者工具箱

Dev Toolkit Pro 是一款专为开发者与工程师打造的一站式在线工具合集，旨在通过浏览器快速解决日常开发、调试与数据处理中频繁遇到的格式化、编解码和协议转换需求。这不仅是一个高效直观的工作台，也是全面提升生产力的得力助手。

## 🌟 核心功能

我们为您提供了开箱即用、无缝体验的优质开发工具集成：

### 🛠️ 数据处理与编解码
*   **JSON 格式化工具**：支持快速排版、压缩、验证 JSON 字符串，并以舒适的结构化视图展示及对比数据。
*   **JSON ⇔ CSV 互转**：轻松在 JSON 结构化对象数组与标准电子表格 CSV 报表之间进行双向高效转换，便于数据提炼和二次分析。
*   **Base64 编解码器**：提供专业级纯文本到 Base64 以及 Base64 回溯解析的双向安全转换，轻松处理令牌、加密盐值等各类编码资产。

### 📡 网络协议与设备互联
*   **代理链接转换 (Proxy Converter)**：将各类复杂冗长的代理协议文本 (如 SOCKS5 订阅或直连等链接) 快速进行标准结构解析与格式化转化，极大简化代理及分流配置流程。
*   **二维码生成与解析器**：能够将各种服务 URL、配置节点或私密文本一键生成可辨识且可下载的专属二维码。同时提供图片解析功能，一键扫描并读取外部二维码的内嵌信息，连通移动端与桌面端的数据桥梁。

## 🚀 平台专属服务

Dev Toolkit Pro 不仅仅是对纯粹工具的简单罗列，为了给专业用户打造卓越的使用体验，平台亦整合了全套服务体系：

*   **极简开发者登录**：摆脱繁琐表单，支持通过 GitHub 或 LINUX DO 账号安全免密授权，一键建立云端会话空间。
*   **工具使用画像追踪**：系统会自动为您和全局匿名汇总各项工具的高频使用频次跟踪。我们依此精确掌握各项依赖的使用热度以做针对性增强和迭代。
*   **无边界卓越交互**：引入了极致流畅的微动画与现代化直觉交互逻辑，在保障核心计算迅速的同时维持舒适极客质感的操作享受。

## 本地接入 GitHub / LINUX DO 登录

1. 在仓库根目录创建或修改 `.dev.vars`，填入以下变量：

```env
FRONTEND_URL="http://localhost:3000"
OAUTH_CALLBACK_BASE_URL="http://localhost:8787"
GITHUB_CLIENT_ID="你的本地 GitHub OAuth App Client ID"
GITHUB_CLIENT_SECRET="你的 GitHub OAuth App Client Secret"
LINUX_DO_CLIENT_ID="你的 LINUX DO Connect Client ID"
LINUX_DO_CLIENT_SECRET="你的 LINUX DO Connect Client Secret"
```

2. 在仓库根目录创建或修改 `.env`：

```env
VITE_API_URL=""
```

3. 在 GitHub OAuth App 配置中，将回调地址设置为：

```text
http://localhost:8787/api/auth/github/callback
```

4. 在 LINUX DO Connect 配置中，将回调地址设置为：

```text
http://localhost:8787/api/auth/linuxdo/callback
```

5. 启动本地开发：

```bash
pnpm dev
```

说明：

* `.dev.vars` 已被 `.gitignore` 忽略，本地调试变量统一放在这里，不会进入仓库。
* `FRONTEND_URL` 表示登录完成后最终跳转的前端地址。
* `OAUTH_CALLBACK_BASE_URL` 表示 OAuth 回调地址的基础域名。本地前后端分离时，它应指向 Worker 地址。
* 本地开发时前端页面在 `http://localhost:3000`，GitHub OAuth 回调走 `http://localhost:8787/api/auth/github/callback`，LINUX DO 回调走 `http://localhost:8787/api/auth/linuxdo/callback`，登录成功后服务端会再跳回前端首页。
* 服务端会自动关闭本地 HTTP 环境下的 `Secure Cookie`，否则浏览器不会写入登录态。

## 生产环境配置建议

生产环境前后端同源部署时，建议配置为：

```env
FRONTEND_URL="https://你的生产域名"
OAUTH_CALLBACK_BASE_URL="https://你的生产域名"
```

此时 GitHub OAuth App 的回调地址应配置为：

```text
https://你的生产域名/api/auth/github/callback
```

如果启用 LINUX DO 登录，对应回调地址应配置为：

```text
https://你的生产域名/api/auth/linuxdo/callback
```
