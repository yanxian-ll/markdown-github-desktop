# 0.2 变更说明

修复/新增：

1. 新文件提交问题：不再使用 GitHub Contents API，改为本地 Git 工作区，`git add -A` 可提交新增、删除、重命名、修改。
2. 左侧文档栏和右侧 GitHub 栏支持隐藏/显示。
3. GitHub 连接增加网页登录 / 创建 token 按钮。
4. Welcome.md 扩展为完整 Markdown 测试文档。
5. 左侧支持文件夹树结构。
6. 交互逻辑改为本地目录 + `git clone --depth=1`。
7. `Ctrl+S` 保存本地，不提交 GitHub。
8. 手动点击提交 GitHub 才执行 `git add -A && git commit && git push`。
9. 文档支持重命名。
10. 增加 LaTeX 文件识别、语法高亮、PDF 构建、日志显示和辅助文件清理。
