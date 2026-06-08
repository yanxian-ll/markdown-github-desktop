# v0.10.19

## 修复

- GitHub Token 在保存前会通过 GitHub `/user` 接口进行在线验证。
- 验证失败时不会覆盖系统凭据中的旧 token，并会在状态/错误区域显示失败原因。
- 验证成功后自动读取 GitHub `login`，并填入 GitHub 工作区的“用户名”字段。
- 已保存 token 启动后会后台验证并刷新用户名提示；token 本身仍只保存在系统凭据中。
- Token 输入框在验证成功后自动清空，避免界面继续显示敏感内容。

## 版本

- 同步更新 `package.json`、`package-lock.json`、`Cargo.toml`、`tauri.conf.json` 到 `0.10.19`。
