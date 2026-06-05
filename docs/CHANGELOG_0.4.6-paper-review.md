# v0.4.6-paper-review

- 升级批注数据模型：新增 `selectedText`、`sourceText`、上下文、锚点稳定性和 `needsReview` 标记。
- 保存批注时自动生成 AI 友好文件：`.paper-notes/review-items.jsonl` 与 `.paper-notes/review-summary.md`。
- 区域批注改为视觉辅助锚点；未绑定源码或可能漂移时在侧栏显示复核提示。
- 优化论文批注栏布局，移除标题旁多余的加号和隐藏按钮，新增状态/锚点/时间筛选。
- 顶部提交旁按钮负责显示/隐藏 PDF 预览；预览栏标题右侧按钮负责显示/隐藏论文批注栏。
- TeX 选中源码后按 Ctrl/Cmd + Alt + C 可创建源码选择批注，并尝试 SyncTeX 定位到 PDF。
