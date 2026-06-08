# v0.10.20

- 修复 GitHub token 验证成功后，已有 GitHub 工作区用户名不会被新 token 对应 login 覆盖的问题。
- GitHub token 验证成功后会同步更新持久化 workspace owner、GitHub 工作区用户名输入框和默认批注作者。
- 新增统一运行日志：状态变化、Git clone/commit/pull/push、LaTeX/PDF 构建、Pandoc 导出、发布/投稿包/共享审阅包导出、环境检查和错误信息会汇总到底部“日志”栏。
- 底部“日志”栏不再只显示 LaTeX 构建日志；没有统一日志时仍会回退显示最近构建日志。
