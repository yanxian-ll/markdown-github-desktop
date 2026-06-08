# v0.10.17 - 导出路径选择与导出目录打开

## 改进

- 投稿包导出前会弹出系统文件夹选择器，由用户选择导出位置。
- 共享审阅包导出前会弹出系统文件夹选择器，由用户选择导出位置。
- 导出结果会在选择的目录下自动创建带时间戳的子目录，避免覆盖已有导出内容。
- “最近导出”中的导出路径改为可点击路径，点击后直接打开对应文件夹。

## 技术变更

- `export_submission_package` / `export_shared_review_package` 新增可选 `outputRoot` 参数。
- 新增通用 `open_path` Tauri 命令与前端 `openLocalPath` bridge。
