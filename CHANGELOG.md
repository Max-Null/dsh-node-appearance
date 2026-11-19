# 更新日志

## [0.11.0] - 2026-11-20

### 修复

- **上下文注入行重复显示**：上游 0.2.2 起 `isVisibleChatNode()` 只排除 `system-prompt`，官方 `ContextInjectionRow` 把注入行画了回来，与本插件当初的补位节点并排成两份。插件撤掉自有 kind `context-injection` 的 Definition 与渲染器，配色与「显示上下文注入」开关改为直接命中官方 kind（`[data-chat-flow-kind="context"]`）。系统提示词卡仍在补位——官方仍然不显示 `system-prompt`。

### 新增

- **上下文压缩标记着色**：新增 `compaction` 类别（默认 `#4338ca`，比其余类别深一级），命中 `[data-chat-flow-kind="compaction"]` 与 `[data-chat-flow-kind="manual-compaction"]`——自动压缩与 `/compact` 画的是同一个官方折叠行，两个 kind 都接才不漏。设置卡片的色板因此多一行「上下文压缩」。

### 变更

- 删除 `context-injection.ts` / `context-injection-card.tsx` / `context-injection-model.ts`（连同其测试）；原先与注入行共用的样式表更名为 `system-prompt-card.module.css`，现在只由系统提示词卡使用。
- 「显示上下文注入」开关的语义随之改变：不再决定「要不要把行画回来」，而是隐藏官方渲染的那些行。
