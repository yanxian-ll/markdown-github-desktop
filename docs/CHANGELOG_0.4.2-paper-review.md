# v0.4.2 paper-review

- 修复 PDF 默认模式下双击无法反向定位到 TeX 的问题。
- 原因是 pdf.js text layer 位于 canvas 上方，双击事件原来只绑定在 canvas 上，会被 text layer 拦截。
- 现在双击事件绑定到整页 PDF canvas wrapper，既保留文本选择层，又能在默认定位/文字模式下触发 SyncTeX reverse。
- 批注模式下仍然不触发反向定位，避免拖拽框选批注时误跳转。
