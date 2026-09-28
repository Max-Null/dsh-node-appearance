# dsh-node-appearance

本插件属于 **`@max-null/*` 插件系列**——这一系列共同构成 **[SSID（思灵 · Seek Soul in Darkness）](https://github.com/Max-Null/seek-soul-in-darkness)** 桌面体验。SSID 是整合它们的盒：`dsh-capture` · `dsh-chat-rail` · `dsh-chinese-thinking` · `dsh-draft-polish` · `dsh-guardian` · `dsh-habit` · `dsh-memory` · `dsh-node-appearance` · `dsh-plugin-center` · `dsh-quick-toolbar` · `dsh-skill-mcp-center` · `dsh-ssid-panels` · `dsh-ssid-zh-ui` · `dsh-achievements`。

This plugin belongs to the **`@max-null/*` family** — a set of plugins that together form the **[SSID (思灵 · Seek Soul in Darkness)](https://github.com/Max-Null/seek-soul-in-darkness)** desktop experience.

会话节点外观插件：给 DeepSeek Harness Web GUI 的会话面板**着色与重塑**——节点 / 工具分类配色（可配置）、折叠摘要条按类别取色、接管触发通知卡（目标轮次字段化展示）、提问卡展示全部选项、交付文件行展开成清单、目标条详情折叠条。纯前端渲染增强，不改 DSH 源码，`cordis.yml` 一行挂载。

## 功能

- **节点着色**：工具调用、联网搜索、智能体调用、代码 / 指令执行、文件操作、交付文件、任务 / 目标、指令节点（`/command`）、思考行（Think）——每种类别一个可配置颜色，左侧 3px 色条 + 淡色底，深 / 浅主题均可读。
- **过程组组头着色**：内核把一串工具调用折成一行摘要时（「已读取文件并执行了命令」「已搜索代码」），组头按内核排在第一位的活动类别取色，与展开后各成员行的颜色同一色系——收起态也能一眼看出这一组在干什么。取色不解析标题文本，读的是内核在组头上发布的 `data-process-activity` 属性。
- **Turn 级折叠条着色**：最外层的「已完成工作 · 用时 35 秒」用单独的中性色 `summary`（默认 `#94a3b8`）——它只有轮次号与工具计数，没有类别语义，硬套类别色是武断的。两条折叠条都**只在收起态**着色：展开后成员行各自带色，容器再涂就是两层色块叠在一起。
- **两种折叠形态，两种涂法**：过程组组头是「一行摘要」（以图标起头），走 3px 左轨 + 淡色底，内距比工具行宽（8px），让轨与图标之间有呼吸；Turn 级摘要条是**整行宽的分节线**（内核给它 `padding: 0` 加一条底部发丝线），改用**底线染色**、不加轨也不内缩 —— 否则轨会紧贴文字，而为补偿轨加的内缩又会让它与上下所有行错位。
- **工具级颜色覆盖**：任意工具名（如 `web_search`、`subagent`、`run_code`）可单独指定颜色，优先级高于类别色。
- **提问卡片**：`ask_user_question` 的卡片改为展示**当时给出的全部选项**，被选中的选项用 `ask` 类别色（默认蓝）反显并打勾。官方转录卡只保留已选答案，提问一旦结算就再也看不到其他选项 —— 本插件把选项读回来。
- **触发通知卡**：接管内核的「唤醒本轮」通知卡（`turn-trigger`）。目标轮次那张原本把**模型提示词原文**连同骨架一起显示（`<goal_round>`、`Objective: "…"`、`Round: 1/256`、一整段英文执行要求），骨架对人不构成信息却占满展开区。接管后折叠头加**轮次徽标**（收起态即可读到走到第几轮），展开体改为**字段化**：「目标」是还原了 JSON 转义的目标原文，「模型收到的指令」独立成节并默认收起（保留可查性，不销毁）。其余触发来源（`schedule` / `webhook` / `job` / `subagent` …）按官方同构渲染 —— 遮蔽是**全 key** 的，见「已知限制」。
- **目标条详情**：官方目标条下方接一条**与它拼成同一张卡**的详情行（借待办卡片的折叠形态），把官方条上被 ellipsis 截断的目标展开成可读详情：完整目标、阶段、阻塞原因、自主轮次、目标标识。只读投影，不碰官方的编辑/暂停/清除，那四个按钮仍是官方在跑。
- **交付文件行**：`present` 的行改为折叠态只报「首个文件名 + 数量」，展开后逐文件成行（扩展名徽标 + 文件名 + 所在目录），并在结果文本上方标注行数。官方折叠行把全部文件名逗号拼成一行（`fileNames()` 的 `.join(', ')`），多文件时读不完，也看不出这一轮交付了几个。配色单列 `deliver` 类别（默认青蓝 `#06b6d4`）——本轮生成文件的那些行与交付行常常同屏出现，与 `file`（`read`/`write`）共用绿色会分不清谁是谁。
- **思考过程显示开关**：关闭后 Think 思考行前端隐藏（`display: none`），配置项与配色在同一张设置卡片里。
- **即时生效**：设置改动立即重绘会话，并持久化到 DSH 用户设置文档（`$DSH_HOME/settings.yaml`）。

## 截图

| 会话节点着色 | 设置卡片 |
|---|---|
| ![会话节点着色(https://raw.githubusercontent.com/Max-Null/dsh-node-appearance/main/docs/shots/会话面板截图.png) | ![设置卡片(https://raw.githubusercontent.com/Max-Null/dsh-node-appearance/main/docs/shots/设置卡片.png) |

| 提问卡片 | 目标条（折叠 / 展开） |
|---|---|
| ![提问卡片(https://raw.githubusercontent.com/Max-Null/dsh-node-appearance/main/docs/shots/提问卡片截图.png) | ![目标条折叠(https://raw.githubusercontent.com/Max-Null/dsh-node-appearance/main/docs/shots/目标详情-折叠.png) ![目标条展开(https://raw.githubusercontent.com/Max-Null/dsh-node-appearance/main/docs/shots/目标详情-展开.png) |

| 交付文件行（折叠） |
|---|
| ![交付行折叠(https://raw.githubusercontent.com/Max-Null/dsh-node-appearance/main/docs/shots/交付行-折叠.png) |

| 交付文件行（展开 · 青＝交付、绿＝写入） |
|---|
| ![交付行展开(https://raw.githubusercontent.com/Max-Null/dsh-node-appearance/main/docs/shots/交付行-展开.png) |

| 折叠摘要条（收起 · 组头按类别取色） | 折叠摘要条（展开 · 成员行各自带色） |
|---|---|
| ![组头收起(https://raw.githubusercontent.com/Max-Null/dsh-node-appearance/main/docs/shots/组头着色-收起.png) | ![组头展开(https://raw.githubusercontent.com/Max-Null/dsh-node-appearance/main/docs/shots/组头着色-展开.png) |

| Turn 级摘要条（收起 · 中性色 `summary`） |
|---|
| ![Turn 摘要条收起(https://raw.githubusercontent.com/Max-Null/dsh-node-appearance/main/docs/shots/Turn摘要条-收起.png) |

| 触发通知卡（收起 · 带轮次徽标） | 触发通知卡（展开 · 字段化） |
|---|---|
| ![触发卡收起(https://raw.githubusercontent.com/Max-Null/dsh-node-appearance/main/docs/shots/触发卡-收起.png) | ![触发卡展开(https://raw.githubusercontent.com/Max-Null/dsh-node-appearance/main/docs/shots/触发卡-展开.png) |

## 安装

```sh
# 在 dsh profile 目录（如 ~/.dsh/profiles/web）
pnpm add @max-null/dsh-node-appearance
```

在 profile 的 `package.json`（`dsh.profile.bundles`）加入 `@max-null/dsh-node-appearance`，或在 profile 的 `cordis.patch.yml` 插入：

```yaml
- insert:
    - id: node-appearance
      name: '@max-null/dsh-node-appearance'
```

重启 `dsh web` 后生效。设置入口：设置 → 插件配置 → **节点外观**。

### 版本对应

peer 自 0.7.0 起改为**跨 minor 的宽范围** `>=0.1.7-rc.2 <0.3.0`。原因：caret（`^0.1.7-rc.2` 等价于 `>=0.1.7-rc.2 <0.2.0-0`）在内核跨 minor 时失配，而失配的插件**不会被加载、也不会出现在「未激活」列表里**（在进入 fiber 图之前就被跳过）——界面上不报错，只是少一批插件。本插件依赖的 DOM 锚点（`data-process-activity` / `data-turn-process`）在 0.1.7-rc.2 与 0.2.0-rc.1 上逐字相同，所以宽范围是准确的声明，不是放宽。

**装错版本不会被安装拦住**（pnpm 对不满足的 peer 只警告、不阻断），而是在启动时抛 `TypeError`（例如 `settings.installSection is not a function`）——现象是设置卡不出现，而节点着色仍走默认配色。

| 插件版本 | peer `@deepseek-ai/dsh-settings` | 注册方式 |
|---|---|---|
| **0.7.0+**（当前线） | `>=0.1.7-rc.2 <0.3.0` | host 不再注册 section，由 loader 依 `Config` schema 自动构成 |
| 0.6.0 – 0.6.x | `^0.1.7-rc.2` | 同上；caret 上界止于下一个 minor，内核 0.2.x 下会被静默跳过 |
| 0.3.4 – 0.5.0 | `^0.1.2-alpha.2` | 服务方法 `settings.installSection` |
| ≤ 0.3.3 | `^0.1.1-rc.1` | 独立函数 `installSettingsSection` |

装之前核对实际解析到的版本：

```sh
node -p "require('@deepseek-ai/dsh-settings/package.json').version"
```

## 配置

`cordis.yml` / settings 文档均可覆盖（以下为初始化配色）：

```yaml
node-appearance:
  showThinking: true
  colors:
    search: '#3b82f6'    # 联网搜索
    agent: '#a855f7'     # 智能体调用
    execute: '#f59e0b'   # 代码 / 指令执行
    file: '#22c55e'      # 文件操作
    deliver: '#06b6d4'   # 交付文件（present 行）
    task: '#ec4899'      # 任务 / 目标
    ask: '#65a30d'       # 提问卡片
    command: '#f97316'   # 指令节点
    thinking: '#c4b5fd'  # 思考过程
    context: '#8a9bb5'   # 上下文注入
    summary: '#94a3b8'   # 工作摘要（Turn 级折叠条）
    steering: '#14b8a6'  # 模型引导
    other: '#64748b'     # 其他工具
  toolColors: {}         # 工具名 → 颜色覆盖
```

## 工作方式

双面插件（Host + browser half，`dsh.client` bundle 由 DSH client 模块系统自动加载）：

- Host half **不再自行注册 settings section**：0.1.7 起 `settings.installSection` 已从 settings 服务面移除，section 改由 loader 依本模块导出的 `Config` schema 自动构成（namespace 即 entry id）。可被浏览器半写入的字段（`showThinking` / `colors` / `toolColors`）需用 `Volatile<T>` + `.volatile()` 声明——非 volatile 路径调 `mutate()` 会抛错。
- Browser half 用 `ctx.configForms.get(NODE_APPEARANCE_NS)` 取同一份表单，把快照交给纯函数 `buildCss()` 生成 CSS，注入一个 `<style data-plugin-css="node-appearance/rules">` 标签；快照变化即重绘。对象字段（`colors` / `toolColors`）的写入走 `mutate()` 路径操作，`set()` 只接受 scalar 字段。
- 着色目标全部使用 DSH 会话 DOM 的稳定 data 属性（`data-chat-flow-kind` / `data-tool` / `data-variant` / `data-process-activity` / `data-turn-process` / `data-turn-trigger`），不依赖任何 CSS Modules 哈希类名。
- 提问卡片是**接管**而非样式覆盖：`tool.call.toolview` 是 keyed slot，同一 key 只有最低 priority 的注册会渲染（DSH 的 slot 契约原话是 "a key the shipped composition already covers is replaced, not shared"），插件以 `priority: -1` 注册自己的 `ask_user_question` 视图，从调用参数里读回官方丢弃的 `options`。行外壳（24px 折叠行、running 扫光、Inspect 胶囊）与官方 `ToolRow` 逐项对齐，组件复用共享的 `ui-primitives`，locale 文案复用官方 `conversation` 字典。
- 交付文件行同样是**接管**：官方 ui-deliverables 在 `tool.call.toolview` 的 `present` key 上有一条 priority 0 的注册，插件以同样的 `priority: -1` 遮蔽它。字段取用面照官方 `PresentRow`（结算前读 `block.argsRaw`、结算后读 `block.call.argsRaw`，半截 JSON 原样显示参数文本而不是当成零个文件），行外壳与提问卡同一套基线，locale 文案复用官方 `deliverables` 字典（`row.title` / `row.ok` / `row.inspect` …）。派生逻辑在纯函数 `deliverable-model.ts` 里，组件只做 JSX。
- 目标详情折叠条是**并列追加**而非接管：`conversation.input.dock` 是 list 槽（官方占 `todo` order 0 / `goal` order 10 / `queue` order 20），插件以 `order: 11` 紧随官方目标条追加自己的条目，只读 `useProjection('goal')`。官方的 edit/pause/resume/clear 是 ui-goal 的注册者私有注入面（四个 Remote 动词 + 一个带竞态防护的 activation 订阅源），接管它们等于在本插件里再养一套会写会话数据的 RPC 客户端。
- 触发通知卡同样是**接管**：`conversation.chat.node` 是 keyed slot，插件在 `turn-trigger` key 上以 `priority: -1` 遮蔽官方的 `TurnTriggerNodeView`。**遮蔽是全 key 的** —— 全部触发来源都会走插件组件，所以 kind → 标题/图标映射在 `trigger-model.ts` 里逐条复刻了官方那一份，非目标轮次的来源按官方同构渲染。派生（`<goal_round>` 解析、时间格式）全在纯函数里，组件只做 JSX；目标轮次提示词的解析是**全有或全无**，结构不符即整卡退回「原文 + 等宽显示」的等价形态。

## 已知限制

- v0.1 不做运行态动画与节点折叠。
- 提问卡是接管式实现：组件来自共享 `ui-primitives`、业务字段只读调用与结果的 JSON，但官方 `ask_user_question` 的行外壳若变更，插件需同步。
- 提问卡高度随内容自适应、不做卡片内滚动；选项极多时由整条会话流承担滚动。
- 交付行同为接管式实现：官方 `present` 的字段取用面若变更，插件需同步。
- 交付行的折叠摘要（「… 等 N 个文件」）与展开区的「输出 N 行」是插件自有文案：官方 `deliverables` 字典没有对应 key，与目标详情条直写中文同一取径。
- 命令节点只有类别色（`command`），暂无命令名级配色。
- 过程组组头的取色表（活动类别 → 配色类别）按内核的活动值域写死，覆盖 `thinking` / `read` / `readImage` / `search` / `edit` / `write` / `commands` / `code` / `webSearch` / `webFetch` / `subagents` / `plan` / `questions` / `tools`。内核新增活动类别时，未列出的类别会落到 `other`（灰）——不报错，但需插件侧补一行映射。组头是**聚合**标题（「已读取文件并执行了命令」横跨两类），所以只取内核排名第一的类别，一个组里少数派的操作不会改变组头颜色。
- **触发通知卡是接管式实现，且遮蔽是全 key 的**：全部触发来源都走插件组件，所以官方新增来源时需插件侧同步图标与标题映射（未列出的 kind 落到「收到执行请求」这一默认，不会崩）。官方对该面板的后续改进也会被遮蔽（0.2.0 就把 `schedule` 的图标从 `IconAlarmClockOutlineRegular` 换成了 `IconClockOutlineRegular`）。
- **目标轮次的解析是内核私有约定**：`<goal_round>` 的结构写在 `goal-round-driver/src/prompt.ts` 里，它一变（或 `maxGoalRounds` 未设导致写出 `Round: 1/undefined`），解析会**静默回退**到「原文 + 等宽显示」的等价形态 —— 不报错，但美化失效。判据是 `test/trigger-model.spec.ts` 里那批「骨架任一处不符即放弃」的用例。
- `toolColors` 按工具名精确匹配；DSH 工具名变更时旧条目静默失效（可在设置面板删除）。**工具名就是 DOM 上 `data-tool` 属性的值**，不是类别名——例如 Windows 下 shell 工具叫 **`pwsh`，不是 `bash`**；给一个不存在的工具名配颜色不会报错，也不会有任何效果。想知道当前会话里实际有哪些工具名，可在 DevTools 执行 `[...new Set([...document.querySelectorAll('[data-tool]')].map(el => el.dataset.tool))].sort()` 查看。

## 开发

```sh
npm install
npm run typecheck   # tsc
npm test            # vitest（CSS 规则生成 + Config schema + 提问卡 / 交付行 / 触发卡三处派生）
npm run build       # tsc 类型 + tsdown（lib/index.js + lib/client.js）
```

## 文档

- [决策记录(https://github.com/Max-Null/dsh-node-appearance/blob/main/docs/决策/2026-08-17-节点外观插件-独立插件决策.md)
- [设计方案(https://github.com/Max-Null/dsh-node-appearance/blob/main/docs/设计/DSH节点外观插件-设计方案.md)
- [触发通知卡结构化设计(https://github.com/Max-Null/dsh-node-appearance/blob/main/docs/设计/2026-09-29-目标轮次触发卡结构化设计.md)
- [验证记录(https://github.com/Max-Null/dsh-node-appearance/blob/main/docs/验证记录.md)（L2 实机测试留痕：环境 / 判据 / 读数 / 踩过的坑）

## SSID 系列

