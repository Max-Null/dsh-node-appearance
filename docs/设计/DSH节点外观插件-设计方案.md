# DSH 节点外观插件 — 设计方案

> 日期：2026-08-17
> 状态：已决策
> 关联：`docs/决策/2026-08-17-节点外观插件-独立插件决策.md`

## 1. 目标与范围

会话面板里各类节点（工具调用、智能体调用、联网搜索、指令执行等）统一灰色、难以辨认。本插件：

1. **节点着色（可配置）**：按"类别 + 工具名"给行动类节点上色，左侧色条 + 淡色底，深/浅主题均可读；提供初始化配色，用户可在设置页修改。
2. **思考过程显示开关**：`showThinking=false` 时前端隐藏思考行（Think 行），配置项与配色同一处。
3. 不改 DSH 源码，cordis.yml 一行挂载；独立仓库 + npm 发布。

**不着色**：用户消息、普通回复、回合尾（保持原样，信息密度合理）。

## 2. 总体架构

双面插件（与 `dsh-skin` 同构）：

```
dsh-node-appearance/
├── src/
│   ├── index.ts            # Host half：Config schema + installSettingsSection（注册 node-appearance namespace）
│   └── client/
│       ├── index.ts        # Browser apply：绑定 settingsScope → 生成/注入 CSS；注册设置卡片
│       ├── palette.ts      # 类别定义、工具映射、默认配色、CSS 规则生成（纯函数，可单测）
│       └── settings-card.tsx  # 设置卡片组件（自绘，不依赖 ui-settings-plugins 内部实现）
├── cordis.patch.yml        # insert loader entry: node-appearance
└── tsdown.config.ts        # 复刻 DSH clientBundle 产物格式
```

数据流：`cordis.yml` 配置（默认色）→ Host `installSettingsSection` 注册 namespace（base 层）→ 浏览器 `settingsScope.bind` 读快照（base+user 合并）→ 快照订阅 → `buildCss()` 生成 CSS 文本 → 更新 `<style data-plugin-css="dsh-node-appearance/rules">`。用户改设置 → `scope.set()` 写 user 层 → 快照变化 → CSS 重建，即时生效。

## 3. 配置 Schema（Host half）

```ts
z.object({
  showThinking: z.boolean().default(true),          // 思考行显示开关
  colors: z.object({                                 // 类别配色（初始化配色如下）
    search:   z.string().default('#3b82f6'),        // 联网搜索：蓝
    agent:    z.string().default('#a855f7'),        // 智能体调用：紫
    execute:  z.string().default('#f59e0b'),        // 代码/指令执行：琥珀
    file:     z.string().default('#22c55e'),        // 文件操作：绿
    task:     z.string().default('#ec4899'),        // 任务/目标/计划：粉
    command:  z.string().default('#f97316'),        // 命令节点（/指令）：橙
    thinking: z.string().default('#c4b5fd'),        // 思考行：淡紫
    context:  z.string().default('#8a9bb5'),        // 上下文注入：蓝灰（信息节点）
    other:    z.string().default('#64748b'),        // 其他工具：灰蓝
  }).default(...),
  toolColors: z.record(z.string(), z.string()).default({}),  // 工具名 → 颜色覆盖
})
```

命名空间：`node-appearance`（Host 与 Browser 各自拼写同一字符串，避免跨面值依赖）。

## 4. 着色映射（palette.ts）

### 类别 → 工具名（wire name）

| 类别 | 工具名 |
|---|---|
| search | `web_search`, `web_fetch` |
| agent | `subagent`, `subagent_fork`, `send_message`, `interrupt_agent`, `list_agents`, `report`, `workflow` |
| execute | `bash`, `pwsh`, `run_code`, `terminal_open/close/list/read/send/signal`, `str_replace_editor` |
| file | `read`, `write`, `edit`, `read_image`, `glob`, `grep` |
| task | `todo_write`, `create_goal`, `get_goal`, `update_goal`, `job_kill/list/output`, `schedule_create/delete/list`, `exit_plan_mode` |
| command | 命令节点（`data-chat-flow-kind="command"`，非工具名） |
| thinking | 思考行（`data-variant="think"`） |
| other | 其余工具名（skill、ask_user_question、cordis_*、lsp、session_*、memory_* 等未列出的都归 other） |

### 着色钩子（DOM data 属性，稳定）

- 工具行根：`[data-chat-flow-kind="tool-call"] [data-tool="<name>"]`（ToolRow 根节点，`data-tool` 为 wire 名；子调用天然命中后代选择器）
- 命令节点：`[data-chat-flow-kind="command"]`（ChatNodeSeat 包装 div）
- 思考行：`[data-variant="think"]`（ReasoningRow 根）

### 渲染规则（写一次，全部命中元素共用）

```css
/* 每个目标元素先赋值 --ncolor-accent（类别色或 toolColors 覆盖色） */
[data-chat-flow-kind="tool-call"] [data-tool],
[data-chat-flow-kind="command"],
[data-variant="think"] {
  --ncolor-accent: var(--ncolor-default, transparent);   /* 兜底 */
}
/* 渲染：左侧 3px 色条（inset 不占布局）+ 8% 淡色底（color-mix 深/浅主题通用） */
[data-chat-flow-kind="tool-call"] [data-tool],
[data-chat-flow-kind="command"],
[data-variant="think"] {
  box-shadow: inset 3px 0 0 var(--ncolor-accent);
  background-color: color-mix(in srgb, var(--ncolor-accent) 8%, transparent);
}
```

### 思考隐藏

```css
[data-variant="think"] { display: none; }
```

`showThinking=false` 时追加到 CSS 文本。

## 5. Browser half 行为

1. `apply(ctx)`：
   - `ctx.settingsScope.bind({ namespace: 'node-appearance' })`（inject: `slots`, `connection`, `remote`, `settingsScope`）。
   - 立即用快照当前值（或默认配色）生成并注入 `<style data-plugin-css>`；订阅快照变化重建 CSS。
   - `ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({ name, key: 'node-appearance', locale }, NodeAppearanceCard))`。
2. 设置卡片（自绘）：
   - 8 个类别各一行：中文标签 + `<input type="color">`。
   - 工具覆盖列表：工具名 + 颜色，可增删。
   - `showThinking` 开关（checkbox）。
   - 每次变更 `scope.set(field, value)` 即时写回（单字段写，整对象合并后写回）。
   - 快照未就绪（loading/unavailable）时渲染禁用态或默认值，不白屏。
3. 无可用 settings 服务（未挂 ui-settings 等极端组合）时退化为默认配色 + 隐藏卡片。

## 6. 构建与打包

- `tsdown.config.ts` 导出两个配置：
  - `lib`：ESM node half（`src/index.ts` → `lib/index.js`）。
  - `client`：CJS browser bundle（`src/client/index.ts` → `lib/client.js`），`window.__ModuleLoader__.load({ id, factory })` banner/footer，external = 平台模块清单（react、react/jsx-runtime、@deepseek-ai/cordis、ui-slots、ui-primitives、web-react、ui-attachment、schema-form、`dsh-client-runtime/client`），CSS Modules 经 lightningcss 编译为自注入 `<style data-plugin-css>`。
- 类型：`tsc -p tsconfig.build.json` → `lib/types`。
- 发布：`files: [lib, cordis.patch.yml, README.md]`，`dsh.bundle.patch` + `dsh.client` 声明。

## 7. 测试与验证

1. vitest 单测：
   - `buildCss()`：默认配色生成（每个类别/工具名选择器存在、颜色正确）；`toolColors` 覆盖优先级；`showThinking=false` 追加 display:none；非法输入回退默认。
   - Config schema：默认值解析（`z.parse({})` 得到完整默认配色）。
2. 手动验证（本地 dsh web）：
   - 挂载插件 → 新会话产生工具调用/思考 → 检查色条与淡底；
   - 设置页改色 → 即时生效，刷新后保持；
   - 关闭 showThinking → 思考行消失，再开恢复。

## 8. 已知限制与后续

- v0.1 不做运行态动画、节点折叠、命令名级配色（命令节点只有类别色）。
- `toolColors` 按工具名精确匹配；工具名变更时用户覆盖条目静默失效（可接受，设置面板可见）。
- color-mix 需要现代浏览器（DSH Web 目标浏览器均支持）。
