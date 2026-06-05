# v0.3.5

基于 v0.3.3 重新设计 PDF 预览，不再采用 v0.3.4 的原生 WebView PDF 方案。

- 回到 pdf.js 连续滚动预览。
- 增加 selectable text layer，PDF 中的文本可以选中和复制。
- 保留 canvas 渲染、缩放、滚轮浏览和按需渲染。
- SyncTeX 反向定位改为 `Alt/Ctrl/⌘ + 双击`，避免和正常文本选择冲突。
- 继续支持设置中的 PDF 渲染分辨率。

这个方向更接近 VS Code 中 LaTeX/PDF 插件的做法：PDF 视图由 pdf.js 控制，既保留可定制交互，又补上文本层。
