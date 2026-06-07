# v0.10.10 实现报告

本次基于 v0.10.9 修复两个交互问题。

## 1. Welcome.md 可关闭

之前 `closeDocument()` 在最后一个 Tab 被关闭后会立即 `push(defaultDocument())`，导致 `Welcome.md` 作为最后一个文档时无法真正关闭。本次改为允许 `documents` 为空，并在关闭最后一个文档时清理：

- `activeDocumentId`
- `previewVisible`
- PDF 预览路径
- BibTeX 悬浮预览状态

同时调整初始化逻辑：

- 全新启动、没有历史状态时，仍创建默认欢迎文档；
- 如果历史状态里明确保存了空文档列表，说明用户已经关闭过所有文件，不再强行恢复 `Welcome.md`。

## 2. 编辑器快捷缩放

新增编辑器字体缩放状态 `editorFontSize`，存入 `layoutSettings`。没有新增任何按钮或图标，缩放方式为：

- `Ctrl/Cmd + 鼠标滚轮`
- `Ctrl/Cmd + +` / `Ctrl/Cmd + =`
- `Ctrl/Cmd + -`
- `Ctrl/Cmd + 0`

缩放仅在焦点或事件目标位于编辑器区域时生效，避免影响图片/PDF预览和浏览器/系统全局缩放。

## 验证

- `npm ci`：通过
- `npx vue-tsc --noEmit`：通过
- `npm run test`：通过，2 个测试文件 / 2 个测试用例通过
