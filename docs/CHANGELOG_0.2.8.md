# v0.2.8

- Added in-app PDF preview for LaTeX/PDF files using PDF.js.
- Added Ctrl/Cmd+B build shortcut in the CodeMirror editor itself.
- Added source-to-PDF SyncTeX entry: double-click a LaTeX source position to jump to the corresponding PDF page.
- Added PDF-to-source SyncTeX entry: double-click the PDF preview to try reverse navigation to the corresponding TeX source line.
- Added Tauri commands for `synctex view` and `synctex edit`.
- Changed LaTeX build behavior to render the generated PDF inside the right preview pane instead of opening the system PDF viewer by default.
