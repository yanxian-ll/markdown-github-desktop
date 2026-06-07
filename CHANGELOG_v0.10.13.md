# v0.10.13

## GitHub repository hygiene

- Added a root `.gitignore` for the Vue/Vite/Tauri/Rust project.
- Ignored local dependency directories, frontend build output, Rust/Tauri targets, test artifacts, logs, local environment files, OS/editor files, temporary files, LaTeX auxiliary files, and locally generated installer/archive artifacts.
- Kept source files, lockfiles, built-in templates, and vendor LaTeX files such as `isprs.cls` / `isprs.bst` trackable.
