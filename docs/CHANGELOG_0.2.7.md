# v0.2.7

## UI cleanup

- GitHub side panel is now presented as a Settings panel toggled by a gear icon.
- Removed top-level New and Save buttons; creation stays in the Explorer `+`, saving stays on Ctrl/Cmd+S.
- Renamed the GitHub submit button to `提交`.
- Moved hide/show controls to compact icons near the relevant areas.

## Visual assets

- Repository tree now shows common image resources used by Markdown and LaTeX papers.
- Image files can be opened directly in the right preview area.
- Markdown preview resolves local relative image paths from the workspace and displays them as data URLs.

## LaTeX paper workflow

- Repository tree includes common journal/conference template assets: `.cls`, `.sty`, `.bst`, `.bbx`, `.cbx`, `.cfg`, `.def`, `.clo`, `.ldf`, `.ist`, `.ins`, `.dtx`.
- LaTeX build is optimized for copied paper templates:
  - Uses `latexmk -pdf -interaction=nonstopmode -synctex=1 -file-line-error` when available.
  - Falls back to `pdflatex + bibtex/biber + pdflatex x2` when `latexmk` is unavailable.
  - Supports `% !TEX root = main.tex` so subfiles can build the root paper.
  - Keeps `.bib` files editable and includes BibTeX/Biber diagnostics in build logs.
