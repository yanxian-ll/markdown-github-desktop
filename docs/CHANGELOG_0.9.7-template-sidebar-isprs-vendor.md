# v0.9.7 Template sidebar and ISPRS vendor files

## Changes

- Embedded the public ISPRS template support files into the built-in ISPRS template:
  - `src/templates/vendor/isprs/isprs.cls`
  - `src/templates/vendor/isprs/isprs.bst`
- Updated `createIsprsFullPaperTemplate()` so projects created from the ISPRS template write `isprs.cls` and `isprs.bst` to the project root.
- Moved the template gallery from a center overlay into a docked panel beside the document tree.
- Kept the top toolbar as the main template entry point; the toolbar button now toggles the docked template panel.
- Removed the full template gallery from the startup page to avoid duplicating the template workspace.
- Added compact side-panel styling for search, tag filtering, and template cards.
- Updated README template source notes and version metadata.

## Verification

- `npm ci --no-audit --no-fund`
- `npm run build`
- `npm test`
- `cargo check` was not executed because Cargo/Rust was not available in the current environment.
