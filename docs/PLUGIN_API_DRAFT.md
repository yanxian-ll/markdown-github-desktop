# Scholia Studio Plugin API 草案（P3.2）

该草案用于先固定扩展点边界，避免后续插件直接耦合 Vue/Tauri 内部实现。

## Manifest

```json
{
  "id": "example.preview-extension",
  "name": "Example Preview Extension",
  "version": "0.1.0",
  "scholia": ">=0.10.16",
  "contributes": {
    "fileIndex": [{ "match": "**/*.md", "kind": "evidence" }],
    "editorCommand": [{ "id": "example.insert", "title": "Insert Example" }],
    "previewExtension": [{ "language": "plotly", "renderer": "renderPlotly" }],
    "exportProfile": [{ "id": "journal-docx", "format": "docx" }]
  }
}
```

## 扩展点

- `fileIndex`：读取工作区文件树和轻量文本片段，生成索引项；插件不得直接写源文件。
- `editorCommand`：向命令面板/编辑器注册命令，所有写操作必须返回 patch/diff，由用户确认后应用。
- `previewExtension`：注册 fenced code block 或自定义 Markdown block 的预览器，例如 Mermaid、Plotly、TikZ。
- `exportProfile`：提供 Pandoc 参数、CSL、bibliography、reference-doc、资源目录等导出 profile。

## 安全约束

1. 默认本地优先；插件只能访问当前工作区。
2. 网络能力需要显式声明，并在 UI 中显示。
3. 源码修改必须走 diff 确认流程。
4. 证据驱动 AI 模式下，插件生成内容必须携带来源文件和行号。

## 当前实现状态

P3.2 已将 Mermaid、Plotly、TikZ 预览和自定义 snippets 接入主程序；插件 API 仍处于草案阶段，下一步应增加 manifest 加载、签名/权限提示和命令注册表。
