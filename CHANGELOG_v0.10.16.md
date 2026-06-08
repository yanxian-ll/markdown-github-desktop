# v0.10.16 - P3 生态扩展基础版

## 新增

- 发布：Hugo / Jekyll profile、frontmatter 转换、本地图片资源复制、发布 manifest。
- 导出：Pandoc profile 支持 CSL、bibliography、reference-doc、resource-path、citeproc；Beamer 使用独立导出流程。
- 投稿：新增 submission package，复制源码、图片、bib、cls/sty/bst、PDF 与 README/manifest。
- 可视化：Mermaid 稳定重渲染；Plotly fenced JSON 预览；TikZ 外部编译缓存到 `.paper-notes/tikz-cache`。
- 片段：自定义 snippets 保存到 `.paper-notes/snippets.json`，支持 `${1:placeholder}` Tab 跳转。
- 协作：Git pull/push 独立按钮和冲突文件可视化；共享审阅包导出 PDF + review-items + 批注。
- 插件：新增 `docs/PLUGIN_API_DRAFT.md` 与 `src/services/pluginApi.ts`。

## 修复

- 清理多个历史重复声明，避免 `vue-tsc`/Rust 构建阶段报错。
- 导出设置栏中重复的“构建命令”标签已合并。
