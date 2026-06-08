# v0.10.18 Implementation Report

## Scope

This patch fixes submission package export granularity. The previous implementation used `collect_package_files` and copied all supported files under the workspace. That behavior was too broad for journal/conference submission packages.

## Implementation

### Frontend

- `exportSubmissionPackageAction` now uses the active TeX document first.
- If the active document is not TeX, it falls back to `projectSettings.mainTexFile`.
- Markdown fallback is only used when no TeX entry is available.
- Active local edits are saved before package export.

### Tauri backend

Added dependency-driven collectors:

- `collect_latex_dependency_files(root, main_tex)`
- `collect_markdown_submission_files(root, main_markdown)`

The LaTeX collector recursively scans local files referenced by:

- `\\input`, `\\include`, `\\subfile`
- `\\import`, `\\subimport`, `\\inputfrom`
- `\\includegraphics`, `\\includesvg`, `\\graphicspath`
- `\\bibliography`, `\\addbibresource`, `\\bibliographystyle`
- local `\\documentclass`, `\\usepackage`, `\\RequirePackage`, `\\LoadClass`
- `\\lstinputlisting`, `\\inputminted`

System packages are treated as optional and are not reported as missing. Explicit source/image/bibliography inputs are reported in the package manifest when missing.

## Validation

- `npx vue-tsc --noEmit`: passed.
- `npm run test`: passed.
- `npm run build`: Vite transform timed out in this container after TypeScript checking passed.
- Rust compile validation could not be performed because `cargo` is unavailable in this environment.
