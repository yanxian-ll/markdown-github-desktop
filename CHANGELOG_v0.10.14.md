# v0.10.14

- 新增底部 AI 证据写作 Dock 框架，可从底部边缘向上拖出，也可从状态栏文字入口打开。
- AI Dock 内置四个框架页：AI 对话、证据库、Diff 审批、模型。
- 预留 P2.1 证据驱动 AI 写作数据结构：EvidenceItem、Evidence Pack、Citation、Grounding Mode、Proposed Patch。
- 新增框架级 AI store 状态：证据模式、消息列表、索引统计、当前 Evidence Pack、待审批 patch。
- 新增本地索引服务骨架，先根据当前打开文档和批注生成 seed evidence，后续可替换为 SQLite/FTS5 索引。
- AI 源码修改入口先落到 Diff 审批页，后续实现“生成 diff → 用户确认 → 应用”。
