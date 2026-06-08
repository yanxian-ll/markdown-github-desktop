# v0.10.19 实现报告

## 需求

设置页填写 GitHub Token 时需要明确判断 token 是否有效，并且验证成功后自动更新 GitHub 工作区用户名。

## 实现

- 新增前端 GitHub API 验证函数 `validateGithubToken(token)`。
- 保存 token 前请求 `https://api.github.com/user`：
  - HTTP 200：读取 `login`，再保存 token 到系统凭据。
  - HTTP 401/403/其他错误：提示原因，不保存新 token。
- 新增 `githubLogin` 状态：
  - 用于保存最近一次验证成功的 GitHub 登录名。
  - 写入轻量 app state，token 本体仍不写入 app state。
- GitPanel 新增 `githubLogin` prop，并在验证成功后自动填充“用户名”。
- 启动时如果检测到系统凭据中已有 token，会后台验证并刷新用户名提示。

## 验证

- `npm ci --prefer-offline --no-audit --no-fund`：通过。
- `npx vue-tsc --noEmit`：通过。
- `npm run test`：通过，2 个测试文件 / 2 个测试。
- `npm run build`：`vue-tsc` 通过，Vite transform 阶段在当前容器超时，未拿到最终 dist。
- `cargo check`：当前容器没有 Cargo，无法验证 Rust 编译。
