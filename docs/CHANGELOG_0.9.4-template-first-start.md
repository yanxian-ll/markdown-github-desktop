# v0.9.4 Template-first start experience

## Added

- Added `TemplateGallery.vue` as the reusable template UI used by the startup page, toolbar template center, and project tools panel.
- Added `WelcomeStart.vue`, a first-run / empty-workspace page that puts template creation, folder opening, and scratch Markdown creation in the center of the app.
- Added a top-toolbar `模板` button that opens a global template center without requiring an active Markdown or LaTeX editor.

## Changed

- `createProjectFromTemplate()` now prepares a target workspace automatically. If no workspace is open, or the current context is a single local file, it asks the user to select a target folder first, writes the template files, refreshes the tree, and opens the template main file.
- Project Tools now delegates template rendering to `TemplateGallery.vue`, so future template integration only needs template registration and metadata rather than copying UI card logic.
- Template card text, metadata, tags, and setting-like descriptions use higher-contrast colors in both dark and light themes.

## Validation

- `npm run build` passed.
- `npm test` passed.
- `cargo check` was not run because this environment does not provide Cargo/Rust.
