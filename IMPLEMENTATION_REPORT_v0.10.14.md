# v0.10.14 Implementation Report

本次按 P2.1 技术方案先实现底部 AI 对话框框架，不接入真实模型，不上传项目证据。

## 已实现

1. 底部 AI Dock
   - 通过底部边缘向上拖出。
   - 状态栏提供文字入口“AI”，便于发现和测试。
   - 支持拖动调整高度，关闭后不影响编辑区布局。

2. AI 框架页
   - AI 对话：预留 evidence_only / prefer_evidence / normal 模式。
   - 证据库：显示框架级索引统计和 Evidence Pack。
   - Diff 审批：预留 unified diff 审批区域。
   - 模型：预留 OpenAI-compatible / 本地模型接入说明。

3. P2.1 数据模型
   - EvidenceItem
   - EvidenceCitation
   - AiEvidencePack
   - AiConversationMessage
   - AiIndexStats
   - ProposedPatch

4. 框架级 store 和服务
   - `sendAiFrameworkPrompt()` 会生成用户消息、框架级 Evidence Pack 和 AI 占位回复。
   - `refreshAiFrameworkIndex()` 会根据当前打开文档、BibTeX 索引和批注生成统计。
   - `buildDocumentEvidenceSeed()` / `buildAnnotationEvidenceSeed()` 为后续 SQLite/FTS5 索引保留接口。

## 后续建议

下一步实现真正的阶段 A：SQLite + FTS5 本地索引，按文件保存增量更新，并让证据搜索结果可点击跳转来源文件和行号。

## 验证

- `npm ci`：通过。
- `npx vue-tsc --noEmit`：通过。
- `npm run test`：通过，2 个测试文件 / 2 个测试用例。
- `npm run build`：TypeScript 阶段通过，Vite 在 transforming 阶段超过 600 秒超时，未完成最终 dist。
- `cargo check`：当前容器没有安装 Cargo，未执行。
