# v0.10.20 Implementation Report

## GitHub 用户名同步

- `applyGithubProfile()` 现在会在 token 验证成功后覆盖 GitHub workspace 的 `owner`。
- `GitPanel` 监听到 `githubLogin` 更新时会直接覆盖用户名输入框，不再因为已有 owner 而跳过。

## 统一日志栏

- 在 Pinia store 中新增 `appLog`，收集状态、错误和关键后台任务日志。
- 底部 `BottomDock` 的“日志”页显示统一日志，并在需要时回退显示最近一次构建日志。
- 已接入的日志来源包括 Git、LaTeX/PDF、Pandoc、发布、投稿包、共享审阅包和环境检查。
