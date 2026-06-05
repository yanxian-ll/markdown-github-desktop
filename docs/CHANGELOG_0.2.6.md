# v0.2.6

- 修复左侧目录树不渲染的问题：移除运行时 `template` 字符串组件，改为 Vue render function，避免 Tauri/Vite 运行时编译器缺失导致树节点空白。
- 目录树为空时显示更明确的本地目录 / Sub path 排查提示。
