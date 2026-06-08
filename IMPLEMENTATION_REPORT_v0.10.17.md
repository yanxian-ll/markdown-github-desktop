# v0.10.17 实现报告

本次修复围绕协作与共享审阅包导出体验：

1. 导出投稿包、共享审阅包时，先调用系统文件夹选择器，让用户明确选择输出位置。
2. 后端在用户选择的目录下创建 `submission-package-<timestamp>` 或 `shared-review-package-<timestamp>` 子目录。
3. UI 中“最近导出”的路径改为按钮样式链接，点击调用 Tauri `open_path` 打开对应导出文件夹。
4. 保留后端默认 `.paper-notes` 导出路径作为 API 兼容兜底，但前端按钮始终要求用户选择路径。

验证：

- `npm ci --prefer-offline --no-audit --no-fund`：通过。
- `npx vue-tsc --noEmit`：通过。
- `npm run test`：通过，2 个测试文件 / 2 个测试。
- `npm run build`：`vue-tsc` 通过，Vite transform 阶段在当前容器中超时，未拿到最终 dist。
- `cargo check`：当前容器没有 `cargo`，无法执行 Rust 编译验证。
