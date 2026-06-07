# v0.10.9 - 编辑器空白修复

## 修复

- 修复顶部文件 Tab 引入后，编辑栏 CSS 仍按“两行布局”计算，导致编辑器主体被挤到底部、中间出现大面积空白的问题。
- 编辑区布局改为 `Tab 栏 / 编辑工具栏 / 编辑器主体` 三行网格，主体区域固定占据剩余空间。
- 为 CodeMirror 容器补充 `height: 100%`、`min-height: 0` 和滚动约束，避免嵌套 grid/flex 布局中测量错误。
- 切换顶部 Tab 时让编辑器组件按文档 ID 重新挂载，避免复用上一个文件的滚动状态造成短文件显示在底部。

## 验证

- `npm ci`：通过。
- `npx vue-tsc --noEmit`：通过。
- `npm run test`：通过，2 个测试文件 / 2 个测试用例通过。
- `npm run build`：TypeScript 阶段通过；Vite 在 `transforming...` 阶段超过 600 秒超时，未生成最终 dist。
