# v0.4.0-paper-review

这一版把 v0.3.4 从“LaTeX 编辑器 + PDF 预览”推进为“论文源码 / PDF / 批注 / 任务”的一体化工作区。

## 新增

- 新增 `PaperAnnotation` 双锚点数据模型：同时保存 PDF 页内归一化矩形与 TeX 源码位置。
- 新增 `.paper-notes/annotations.jsonl` sidecar 批注文件，便于进入 Git 版本管理。
- 新增 PDF 批注模式：在 PDF 页面中拖拽框选区域，输入评论后生成批注。
- 新增 SyncTeX 辅助锚定：PDF 区域批注创建时尝试反向定位到 TeX 源码行。
- 新增源码行批注：在 TeX 编辑器中按 `Ctrl/Cmd + Alt + C` 给当前行添加批注。
- 新增 CodeMirror 批注 gutter：有批注的源码行会显示批注标记，点击可跳转。
- 新增右侧论文批注面板：支持未处理 / 已解决 / 忽略 / 全部过滤，以及状态切换和删除。
- 新增 PDF overlay：批注区域以透明框显示，点击批注可同步到批注面板和源码。
- 新增 Rust/Tauri 批注读写命令：`read_workspace_annotations`、`write_workspace_annotations`。

## 验证

- 已通过 `npm run build`。
- 当前执行环境没有 Rust/Cargo，因此未能运行 `cargo check`。请在本机安装 Rust 后运行：

```bash
cd src-tauri
cargo check
```

## 使用方式

1. 打开工作区内的 `.tex` 文件。
2. 按 `Ctrl/Cmd+B` 编译 PDF。
3. 在 PDF 预览区切换到“批注”模式。
4. 拖拽框选区域并输入评论。
5. 在源码中按 `Ctrl/Cmd + Alt + C` 添加源码行批注。
6. 批注会写入 `.paper-notes/annotations.jsonl`，可随 Git 提交。
