# v0.4.12 Markdown 同步与批注栏清理

- 将界面中的“论文批注”改为更通用的“批注”。
- 删除批注栏顶部的“AI 友好批注”说明卡片，保留后台生成 review-items.jsonl 和 review-summary.md。
- Markdown 预览区渲染时写入源码行号锚点，支持预览点击定位源码。
- Markdown 源码编辑区点击对应行时，预览区会滚动到对应段落并短暂高亮。
- 继续保留 Markdown 预览区选中文字后点击“批注”的交互。
