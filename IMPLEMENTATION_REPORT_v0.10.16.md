# P3 实现报告

## 覆盖范围

- P3.1：发布 profile、多格式 Pandoc 导出参数、投稿包、Beamer workflow。
- P3.2：Mermaid / Plotly / TikZ 预览，自定义 snippets，插件 API 草案。
- P3.3：Git pull/push 冲突显示，共享审阅包，本地优先的同步边界。

## 关键文件

- `src/stores/appStore.ts`：P3 状态、profile 管理、导出/发布/协作 action。
- `src/components/GitPanel.vue`：发布、导出、协作、Git 同步 UI。
- `src/components/MarkdownPreview.vue`：Mermaid/Plotly/TikZ 渲染管线。
- `src/components/SnippetPanel.vue`：自定义片段管理。
- `src/services/tauriBridge.ts` 与 `src-tauri/src/lib.rs`：后端命令桥接。
- `docs/PLUGIN_API_DRAFT.md`：插件 API 草案。

## 验证

- `npm ci`：通过。
- `npx vue-tsc --noEmit`：通过。
- `npm run test`：通过，2 个测试文件 / 2 个测试。
- `npm run build`：`vue-tsc` 通过后，Vite transform 阶段在当前容器内超时，未得到最终产物。
- `cargo check`：当前容器没有 `cargo`，无法执行 Rust 编译校验。
