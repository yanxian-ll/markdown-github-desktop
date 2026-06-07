# v0.10.9 实现报告

本次修复用户反馈的“编辑器中间大量空白，内容被挤到底部”的问题。

## 根因

v0.10.7/v0.10.8 新增顶部文件 Tab 后，`.editor-column` 仍然保留旧的两行 grid：

```css
grid-template-rows: 38px minmax(0, 1fr);
```

实际 DOM 已经变成三段：

1. 顶部文件 Tab；
2. 编辑工具栏；
3. CodeMirror 编辑器主体。

旧 grid 让第二行占据剩余空间，第三个子节点被放入隐式行，最终编辑器主体被推到底部，因此视觉上出现大面积空白。

## 修改

- 将 `.editor-column` 改为三行布局：`auto 38px minmax(0, 1fr)`。
- 为 `.editor-layout`、`.editor-column`、`.editor-body-layout`、`.editor-code-pane`、`.editor-host` 补齐 `height: 100%` / `min-height: 0` / `overflow: hidden`。
- 为 `.editor-host .cm-editor` 和 `.editor-host .cm-scroller` 设置 `height: 100%`。
- 给 `MarkdownEditor` 增加基于 `primaryDocument.id` 的 `key`，切换文件时重新挂载编辑器，防止滚动状态从上一个文件遗留到短文件。

## 验证

- `npm ci`：通过。
- `npx vue-tsc --noEmit`：通过。
- `npm run test`：通过。
- `npm run build`：Vite 转换阶段 600 秒超时；未观察到 TypeScript 或测试错误。
