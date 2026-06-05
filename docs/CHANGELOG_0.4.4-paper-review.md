# v0.4.4 Paper Review

修复 PDF 渲染竞态：在自动适宽、窗口拖拽、滚轮缩放和可见页按需渲染同时触发时，pdf.js 可能会在同一个 canvas 上启动多个 render task，导致 `Cannot use the same canvas during multiple render() operations`。

本版为每个 PDF 页面增加串行渲染保护，并在取消旧任务后等待其释放 canvas，再执行新的渲染。
