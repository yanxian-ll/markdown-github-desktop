# v0.4.11 Markdown 预览批注与控件标准化

- Markdown 批注入口调整为预览区选中文字后点击“批注”，与 PDF 文字批注保持一致。
- 移除 TeX/Markdown 源码区 `Ctrl/Cmd+Alt+C` 批注入口，不再从源码编辑器直接创建批注。
- Markdown 预览批注写入 `.paper-notes/annotations.jsonl`、`review-items.jsonl` 和 `review-summary.md`。
- Markdown 预览批注会保存选中文本、预览高亮位置、源文件行号和上下文，便于 AI 检索和修改。
- 按文件类型继续自动切换布局：`.tex` / `.md` 显示编辑与预览；图片/PDF 只显示预览；普通文本只显示编辑。
- 统一部分顶部控件、预览区、批注空状态提示与按钮文案。
