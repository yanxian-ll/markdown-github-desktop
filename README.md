# Markdown GitHub Desktop

一个基于 **Tauri 2 + Vue 3 + Vite** 的跨平台 Markdown 桌面编辑器。它从 StackEdit 的核心思路出发，只保留 Markdown 编辑、实时预览、写作辅助和 GitHub 同步，不包含发布功能。

## 技术栈

- 桌面框架：Tauri 2
- 前端框架：Vue 3
- 构建工具：Vite
- 状态管理：Pinia
- 编辑器：CodeMirror 6
- Markdown：markdown-it
- 公式：KaTeX
- 图表：Mermaid
- 代码高亮：Prism
- GitHub API：fetch 封装
- 本地状态：filesystem JSON
- Token 存储：Rust `keyring`，映射到 macOS Keychain / Windows Credential Manager / Linux Secret Service
- 测试：Vitest + Playwright
- 打包：Tauri bundler

## 运行

```bash
npm install
npm run tauri:dev
```

## 构建桌面安装包

```bash
npm run tauri:build
```

构建产物会生成在：

```txt
src-tauri/target/release/bundle/
```

## Web 预览开发

```bash
npm run dev
```

注意：Web 预览模式下无法访问本地文件系统和系统凭据，只能测试编辑器、预览和 UI。

## 测试

```bash
npm run test
npm run test:e2e
```

## GitHub token 权限建议

推荐使用 GitHub fine-grained Personal Access Token，只授予目标仓库：

- Contents: Read and write
- Metadata: Read-only

## GitHub 同步流程

1. 在右侧 GitHub 面板粘贴 token，并保存到系统凭据。
2. 输入 Owner、Repo、Branch、Path。
3. 点击“加载 Markdown 文件树”。
4. 打开 `.md` / `.markdown` / `.mdx` 文件。
5. 编辑后点击“提交 GitHub”。
6. 如果远端 `sha` 已变化，会出现冲突弹窗，可选择拉取远端或覆盖远端。

## 本地文件

当前 MVP 支持通过“打开本地文件”输入绝对路径读取 Markdown，通过“保存本地”输入绝对路径写入文件。后续可以接入 Tauri dialog 插件提供原生文件选择器。

## 目录结构

```txt
src/
  components/       Vue 组件
  services/         Markdown 渲染、GitHub API、Tauri bridge
  stores/           Pinia store
  types/            类型定义
src-tauri/
  src/lib.rs        Tauri commands：状态文件、本地文件、系统凭据
  tauri.conf.json   Tauri 2 配置
```

## 与 StackEdit 的关系

本项目是现代桌面重写，不是旧项目的原地升级。详见 `docs/MIGRATION_FROM_STACKEDIT.md`。

StackEdit 的 Apache-2.0 许可证副本位于 `third-party/stackedit/LICENSE`。
