# v0.10.18

## Fixed

- 修复投稿包导出会复制整个工作区的问题。
- 投稿包现在以当前打开的 `.tex` 文件为入口；若当前不是 TeX，则回退到项目设置里的主 TeX。
- 后端按 LaTeX 依赖图收集文件：`\\input`、`\\include`、`\\subfile`、`\\includegraphics`、`\\graphicspath`、`\\bibliography`、`\\addbibresource`、本地 `cls/sty/bst` 等。
- 只复制实际存在并被当前 TeX 依赖引用的源码、图片、BibTeX、样式文件和可选编译辅助文件，不再全量导出项目目录。
- manifest 中会列出缺失的显式引用文件，便于用户补齐资源。

## Validation

- `npx vue-tsc --noEmit` passed.
- `npm run test` passed: 2 test files / 2 tests.
- `npm run build` reached Vite transform stage but timed out in this container.
- `cargo check` was not run because Rust/Cargo is not installed in this container.
