# v0.3.2

Performance-focused release.

- Stop persisting workspace documents, PDF data URLs and image data URLs into app state.
- Persist only scratch documents and lightweight UI/workspace settings.
- Remove per-keystroke full-text hashing for dirty-state checks.
- Avoid CodeMirror echo updates calling `doc.toString()` on every keystroke.
- Debounce Markdown preview rendering.
- Scope Mermaid/image post-processing to the preview component instead of querying the whole document.
- Cancel stale preview asset work when the input changes quickly.

This release intentionally focuses on editing latency before adding more features.
