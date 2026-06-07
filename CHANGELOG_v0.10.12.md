# v0.10.12

## 修复 LaTeX 构建路径与 ISPRS vendor 文件

- 构建命令改为默认构建当前打开的 `.tex` 文件，不再无条件使用项目设置中的 `mainTexFile`。这样当 `main.tex` 位于子目录时，latexmk 会在该子目录执行，避免误编译工作区根目录的 `main.tex`。
- 保留 LaTeX 的 `% !TEX root = ...` 支持：打开章节文件构建时，后端仍会根据 root 指令定位真正主文件。
- ISPRS 模板构建前会检查当前主文件所在目录是否缺少 `isprs.cls` / `isprs.bst`；如果是旧项目或旧模板创建导致缺失，会自动补齐内置 vendor 文件。
- 构建诊断中的 `main.tex:line` 现在会映射为相对工作区路径，例如 `paper/isprs/main.tex:6`，点击问题列表不会再跳到工作区根目录的错误文件。

## 验证

- `npm ci` 通过。
- `npx vue-tsc --noEmit` 通过。
- `npm run test` 通过，2 个测试文件 / 2 个测试用例。
- `npm run build` 通过。
