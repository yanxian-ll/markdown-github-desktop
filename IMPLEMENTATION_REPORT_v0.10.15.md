# v0.10.15 实现报告：统一底部 Dock

## 背景

v0.10.14 中 AI 证据写作面板和“问题 / 输出 / 日志”面板是两个独立底部浮层，容易出现重叠、焦点抢占和高度拖动冲突。

## 本次实现

1. 新增 `src/components/BottomDock.vue`，统一承载底部所有功能标签：
   - 问题
   - 输出
   - 日志
   - AI 对话
   - 证据库
   - Diff 审批
   - 模型

2. `App.vue` 删除独立 `BuildPanel` / `AiDockPanel` 的运行入口，改为只渲染一个 `BottomDock`。

3. 底部拖动热区统一为 `.bottom-dock-reveal-grip`：
   - 面板关闭时，从底部向上拖出；
   - 默认打开 `AI 对话` 标签。

4. 状态栏入口改为统一底部 Dock 标签切换：
   - `问题 N` 打开/切换到问题标签；
   - `AI` 打开/切换到 AI 对话标签。

5. 构建错误处理：
   - 如果底部 Dock 未打开，构建失败后打开“问题”；
   - 如果底部 Dock 已打开且当前不是 AI 标签，切换到“问题”；
   - 如果用户正在 AI 标签页，不强制切走，只更新问题数量。

6. 持久化底部 Dock 状态：
   - `bottomPanelHeight`
   - `bottomDockVisible`
   - `bottomDockActiveTab`

## 验证

- `npm ci`：通过。
- `npx vue-tsc --noEmit`：通过。
- `npm run test`：通过，2 个测试文件 / 2 个测试用例。
- `npm run build`：`vue-tsc` 阶段通过，Vite 在 `transforming...` 阶段 600 秒超时，未生成最终 dist。
- `cargo check`：当前容器未安装 Cargo，未执行。
