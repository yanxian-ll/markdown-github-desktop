# 0.2.3

- 移除“网页登录 / 创建 token”入口，GitHub 连接恢复为纯 token 模式。
- `git clone --depth=1`、`git fetch/pull`、`git push` 统一使用系统凭据中保存的 PAT。
- Git 鉴权改为 GitHub HTTPS Basic header：`x-access-token:<PAT>`，不再依赖 Git Credential Manager，也不把 token 写入 remote URL。
- 保留本地 Git 工作区交互：Ctrl+S 只保存本地，手动点击“提交并 push”才提交远端。
