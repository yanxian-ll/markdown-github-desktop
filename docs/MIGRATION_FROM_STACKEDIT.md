# Migration from StackEdit

This project is a modern desktop rewrite based on the requested subset of StackEdit's product behavior.

## Kept concepts

- Markdown document editing
- Live preview
- File list/workspace mental model
- GitHub-backed synchronization idea
- Revision-safe save flow using GitHub `sha`

## Removed concepts

- Publish menu and all publishing targets
- Dropbox, Google Drive, GitLab, Blogger, WordPress, Zendesk providers
- Chrome app and extension packaging
- Helm/Kubernetes deployment
- Legacy Vue 2, Vuex and Webpack build
- Sponsorship/PDF/Pandoc export workflow

## New architecture

- Tauri 2 desktop shell
- Vue 3 + Vite frontend
- Pinia state
- CodeMirror 6 editor
- markdown-it rendering
- KaTeX formulas
- Mermaid diagrams
- Prism code highlighting
- GitHub REST API through a typed fetch wrapper
- App state stored as filesystem JSON through Rust commands
- GitHub token stored in the OS credential store via Rust `keyring`

## Current GitHub auth model

The MVP uses a pasted GitHub Personal Access Token. This makes the project executable without registering a GitHub OAuth app. For production, replace this with GitHub OAuth Device Flow or a first-party OAuth app.
