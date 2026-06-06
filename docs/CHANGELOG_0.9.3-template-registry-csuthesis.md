# v0.9.3：内置 LaTeX 模板库与 CSUthesis 集成

## 已完成

- 重构模板模块为 `src/templates/`：
  - `types.ts`：模板、文件、来源、许可证、提供者等类型。
  - `catalog.ts`：内置模板注册表。
  - `builtin/*`：每个模板独立成模板工厂，避免把模板内容写死在 UI 或 store 中。
  - `src/services/templates.ts` 继续作为兼容出口，保留原有导入路径。
- 新增 `CSUthesis 中南大学研究生学位论文` 模板：
  - 主文件：`csuthesis_main.tex`。
  - 内容目录：`content/info.tex`、中英文摘要、正文、符号说明、附录、成果与致谢。
  - 内置 `CSUthesis.cls` 轻量兼容类文件，便于直接创建和后续替换为上游完整类文件。
  - 内置 `latexmkrc` 和 `Makefile`，默认使用 XeLaTeX。
  - 内置 `.latex-template.json`，记录模板来源、引擎与后续 vendor 替换说明。
- 改进 LaTeX 构建引擎选择：
  - 读取 `% !TEX program = xelatex` / `% !TEX program = lualatex` / `% !TEX program = pdflatex`。
  - 对 `\documentclass{CSUthesis}` 自动优先使用 XeLaTeX。
  - `latexmk` 不可用时，fallback 也会使用对应引擎，而不是固定 pdflatex。
- 项目工具模板卡片新增来源和 tag 展示。
- 修复 Vitest 配置，避免把 Playwright e2e 测试误纳入单元测试；同步放宽 Markdown 渲染测试以适配带源码行号属性的标题输出。

## 架构约定

后续新增模板时，推荐只做三件事：

1. 在 `src/templates/builtin/<templateName>.ts` 新增 `createXxxTemplate()`。
2. 把模板文件清单写入该工厂，或后续迁移为 raw/vendor 文件导入。
3. 在 `src/templates/catalog.ts` 注册 `{ id, factory }`。

UI 和 `appStore` 不应感知具体模板实现。

## 后续 TODO

- 将完整上游模板作为 versioned vendor 包接入，例如 `src/templates/builtin/csuthesis/vendor/<upstream-version>/`。
- 增加模板变量 schema 和创建向导，支持博士/硕士、学术型/专业型、盲审模式、学院、导师等字段。
- 增加模板校验测试：文件路径合法性、主文件存在、root/program 指令存在、manifest 存在。
