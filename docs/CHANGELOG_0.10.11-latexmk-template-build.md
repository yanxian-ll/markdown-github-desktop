# v0.10.11 LaTeX 模板构建修复

- 修复内置中文 LaTeX 模板容易被 `latexmk -pdf` / pdfLaTeX 路径误构建的问题。
- LaTeX 构建会识别 `ctex`、`fontspec`、`xeCJK`、`CSUthesis` 等需要 XeLaTeX 的项目，并使用 `latexmk -xelatex`。
- `latexmk` 如果只保留“上一次失败状态”，应用会自动清理辅助文件后重试一次，避免出现 `Nothing to do` 但仍返回错误。
- “清理辅助文件”复用同一套清理逻辑，覆盖 `.fdb_latexmk`、`.fls`、`.xdv`、目录/索引/导航等常见生成文件。
- `LaTeX 基础论文` 内置模板和示例工作区补充 `latexmkrc`，默认使用 XeLaTeX。
- 欢迎文档中的手动构建命令改为先推荐 `latexmk -xelatex`，再说明纯英文 pdfLaTeX 模板使用 `latexmk -pdf`。
