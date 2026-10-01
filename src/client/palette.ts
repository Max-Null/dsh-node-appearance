/**
 * Node appearance palette: category/tool mapping, default colors, and the pure
 * CSS-rule generator that paints the chat flow. Browser-half owned; the Host
 * half mirrors the same defaults through its schemastery schema (the two
 * cannot share a value import — the browser bundle purity gate forbids
 * cross-package value imports).
 */

/** The settings namespace this plugin owns (spelled identically in both halves). */
export const NODE_APPEARANCE_NS = 'node-appearance'

/** The plugin's style tag identity (removed/replaced on every re-paint). */
export const STYLE_TAG_ID = `${NODE_APPEARANCE_NS}/rules`

/** One paintable node category. `command`, `thinking`, `context`, `summary` are non-tool rows. */
export type NodeCategory =
  | 'search' | 'agent' | 'execute' | 'file' | 'deliver' | 'task' | 'ask' | 'command' | 'thinking' | 'context' | 'summary' | 'steering' | 'other'

/** Accent color per category (CSS colors). */
export type NodeAppearanceColors = Record<NodeCategory, string>

/** The settings value this plugin reads from its namespace scope. */
export interface NodeAppearanceSettings {
  /** Show assistant reasoning blocks as Think rows; false hides them. */
  showThinking?: boolean | undefined
  /** Show the injected-context rows this plugin restores; false hides them. */
  showContextInjection?: boolean | undefined
  /** Show the system-prompt cards this plugin restores; false hides them. */
  showSystemPrompt?: boolean | undefined
  /** Per-category accent colors; missing keys fall back to defaults. */
  colors?: Partial<NodeAppearanceColors> | undefined
  /** Per-tool accent overrides keyed by wire tool name. */
  toolColors?: Record<string, string> | undefined
}

/** Initial palette: mid-luminance hues readable on both light and dark themes. */
export const DEFAULT_COLORS: NodeAppearanceColors = {
  search: '#3b82f6', // blue — web_search / web_fetch
  agent: '#a855f7', // purple — subagent / workflow / send_message …
  execute: '#f59e0b', // amber — bash / pwsh / run_code / terminal_*
  file: '#22c55e', // green — read / write / edit / glob / grep
  deliver: '#06b6d4', // cyan — present 交付文件行。独立于 file：生成文件的那些行与交付行常在同一轮同屏出现，共用绿色分不清谁是谁（用户反馈）
  task: '#ec4899', // pink — todo_write / goal / job_* / schedule_*
  ask: '#65a30d', // lime — ask_user_question 提问卡（取作 --ask-accent；色相落在 execute 琥珀与 file 绿之间的空档，与 search 的蓝区分开）
  command: '#f97316', // orange — /command nodes
  thinking: '#c4b5fd', // light purple — Think rows
  context: '#8a9bb5', // slate blue — injected context rows (informational)
  summary: '#94a3b8', // slate 400 — Turn-level folded summary bar（容器层摘要，比 context 更淡）
  steering: '#14b8a6', // teal — steering rows (rc.8)
  other: '#64748b', // slate — every unlisted tool
}

/** Wire tool name → category for the shipped mapping. */
export const TOOL_CATEGORIES: Record<Exclude<NodeCategory, 'command' | 'thinking' | 'context' | 'summary' | 'steering'>, readonly string[]> = {
  search: ['web_search', 'web_fetch'],
  agent: ['subagent', 'subagent_acp', 'subagent_fork', 'send_message', 'interrupt_agent', 'list_agents', 'report', 'workflow'],
  execute: ['bash', 'pwsh', 'run_code', 'terminal_open', 'terminal_close', 'terminal_list', 'terminal_read', 'terminal_send', 'terminal_signal', 'str_replace_editor'],
  file: ['read', 'write', 'edit', 'read_image', 'glob', 'grep'],
  deliver: ['present'],
  task: ['todo_write', 'create_goal', 'get_goal', 'update_goal', 'job_kill', 'job_list', 'job_output', 'schedule_create', 'schedule_delete', 'schedule_list', 'exit_plan_mode'],
  ask: ['ask_user_question'],
  other: [],
}

/**
 * The activity keys a step-process group header publishes on its
 * `data-process-activity` attribute. The set is the key list of ui-chat's
 * `ChatGroupSeat` `PROCESS_ICONS`, which is identical in kernel 0.1.7-rc.2 and
 * 0.2.0-rc.1. A closed group reports the kernel's top-ranked category; a
 * running one reports its live activity.
 */
export type ProcessActivityKind =
  | 'thinking' | 'read' | 'readImage' | 'search' | 'edit' | 'write'
  | 'commands' | 'code' | 'webSearch' | 'webFetch'
  | 'subagents' | 'plan' | 'questions' | 'tools'

/**
 * Process activity → the category whose color paints a collapsed group header.
 *
 * The mapping lands on categories the plugin already ships, so group headers
 * reuse the configured palette and add no settings field. It is deliberately
 * the same classification the expanded member rows get: `search` here means
 * code search (`grep`/`glob`, a `file` category tool), not `web_search`.
 */
export const PROCESS_ACTIVITIES: Record<ProcessActivityKind, NodeCategory> = {
  thinking: 'thinking',
  read: 'file',
  readImage: 'file',
  search: 'file',
  edit: 'file',
  write: 'file',
  commands: 'execute',
  code: 'execute',
  webSearch: 'search',
  webFetch: 'search',
  subagents: 'agent',
  plan: 'task',
  questions: 'ask',
  tools: 'other',
}

/** Selector matching every tool row inside a tool-call node. */
const TOOL_ROW = '[data-chat-flow-kind="tool-call"] [data-tool]'
/** The ToolRow root itself (carries data-variant; the wrapper callRow does not). */
const TOOL_ROW_ROOT = '[data-chat-flow-kind="tool-call"] [data-tool][data-variant]'
/** Selector of the command node wrapper. */
const COMMAND_ROW = '[data-chat-flow-kind="command"]'
/** Selector of the Think reasoning row. */
const THINK_ROW = '[data-variant="think"]'
/** Selector of the injected-context row (the flow-item wrapper). */
const CONTEXT_ROW = '[data-chat-flow-kind="context"]'
/**
 * Selector of the injected-context row **restored by this plugin**.
 *
 * 0.2.0 起 ui-chat 的 `isVisibleChatNode()` 按 kind 排除 `context`，官方那条
 * 行不再渲染；本插件用自有 kind 重新接住同一批事件（见 `context-injection.ts`）。
 * 两个 kind 都要着色，否则恢复出来的行没有配色。
 */
const INJECTION_ROW = '[data-chat-flow-kind="context-injection"]'
/**
 * Selector of the system-prompt card **restored by this plugin**.
 *
 * 同一个由来的另一半：`isVisibleChatNode()` 也排除 `system-prompt`，官方那两张卡
 * （`system-message` / `request-prompt` 两条 Definition）仍在生成但不渲染。
 * 官方那张行本就没有类别配色（不在 ACCENTED_ROWS 里），这里同样只接开关。
 */
const SYSTEM_PROMPT_ROW = '[data-chat-flow-kind="system-prompt-notice"]'
/** Selector of a settled tool-result row (rc.8: tool results render as their own row). */
const TOOL_RESULT_ROW = '[data-chat-flow-kind="tool-result"]'
/**
 * Selector of a **collapsed** Turn-level summary bar — the outermost fold
 * ("已完成工作 · 用时 35 秒" / "深度求索中，用时 N"). One Turn's members sit
 * under it, each painting itself.
 *
 * `data-open` is present exactly while those members are expanded, so
 * `:not([data-open])` is the folded state. Both kernel 0.1.7-rc.2 and
 * 0.2.0-rc.1 publish it on the same button; 0.2.0 moved the running label to
 * `RunningStatus` (`data-chat-running`) but left this node's attributes alone.
 *
 * Deliberately NOT in {@link ACCENTED_ROWS}: the kernel renders this one as a
 * full-width section divider (`padding: 0` over a bottom hairline), not as a
 * block row. An inset rail lands flush against the label and reads as a stray
 * vertical stroke, and the 3px `padding-left` that keeps the rail off the text
 * pushes the whole bar out of line with every other row. It takes the accent on
 * that existing hairline instead, plus the same 8% wash.
 */
const TURN_SUMMARY = '[data-turn-process]:not([data-open])'
/**
 * Selector of a collapsed step-process group header — the one-line summary the
 * kernel folds a run of tool calls into ("已读取文件并执行了命令").
 *
 * Collapsed only: while the group is open its member rows carry their own
 * category colors, and painting the header too would stack two colored layers.
 * The `aria-expanded` attribute is the header button's own disclosure state.
 *
 * `activity` narrows the selector to one published value. Narrowing does NOT
 * raise specificity: `[attr]` and `[attr="value"]` each count as exactly one
 * attribute selector. The general form must therefore be declared first and the
 * per-activity forms after it — `buildCss` does that, and the palette spec
 * guards the order. Same mechanism, same trap, as the unlisted-tool fallback.
 * @param activity - one published activity, or undefined for the general form.
 * @returns a CSS attribute selector for the collapsed process-group header.
 */
function collapsedProcessHeader(activity?: ProcessActivityKind): string {
  const value = activity === undefined ? '' : `="${activity}"`
  return `[data-step-process] [data-process-activity${value}][aria-expanded="false"]`
}

/**
 * The same header while expanded: no paint, and no `--ncolor-accent` read. It
 * exists only to hold the paint rule's 3px `padding-left`, so opening a group
 * does not shift its header sideways.
 */
const PROCESS_HEADER_OPEN = '[data-step-process] [data-process-activity][aria-expanded="true"]'

/**
 * The rows that carry the accent rail + wash: the ToolRow root (not its wrapper
 * callRow — both carry data-tool, only the inner row carries data-variant),
 * command nodes, Think rows, injected-context rows, tool-result rows, and a
 * collapsed step-process group header. The collapsed Turn summary bar is
 * deliberately absent — see {@link TURN_SUMMARY}.
 * User input rows are excluded — right-alignment already
 * distinguishes them (2026-08-20 用户反馈）；steering rows 也走独立规则
 * （见 buildCss：在 userStack 层做 wash，不涂整行 rail）。
 * The 3px inset rail is compensated
 * with a matching padding-left so the rail never covers the row's leading icon.
 */
const ACCENTED_ROWS = [
  TOOL_ROW_ROOT, COMMAND_ROW, THINK_ROW, CONTEXT_ROW, INJECTION_ROW, TOOL_RESULT_ROW, collapsedProcessHeader(),
].join(',\n')

/**
 * Accept a configured CSS color (hex, color functions) or reject it so an
 * invalid value falls back to the category default instead of poisoning CSS.
 * @param value - configured color string.
 * @returns whether the value is a plausible CSS color literal.
 */
export function isCssColor(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === '') return false
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) return true
  return /^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|device-cmyk)\(/i.test(trimmed)
}

/** Resolve the effective palette from user settings merged over defaults. */
export function resolveColors(settings: NodeAppearanceSettings): NodeAppearanceColors {
  const colors: NodeAppearanceColors = { ...DEFAULT_COLORS }
  const configured = settings.colors
  if (configured !== undefined && typeof configured === 'object' && configured !== null) {
    for (const key of Object.keys(DEFAULT_COLORS) as NodeCategory[]) {
      const value = configured[key]
      if (typeof value === 'string' && isCssColor(value)) colors[key] = value
    }
  }
  return colors
}

/** Escape a tool name into a CSS attribute selector string literal. */
function attributeLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * Steering marker icon: a corner-up-left arrow (mid-turn guidance inserted
 * into the running answer), drawn as a mask so the icon inherits the
 * configured steering color. Encoded data URI, no external asset.
 */
const STEERING_ICON = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='9 14 4 9 9 4'/%3E%3Cpath d='M20 20v-7a4 4 0 0 0-4-4H4'/%3E%3C/svg%3E"

/**
 * Build the complete stylesheet text for one settings snapshot.
 * @param settings - the namespace scope value (may be partial or undefined).
 * @returns CSS text painting accent rows and (optionally) hiding Think rows.
 */
export function buildCss(settings: NodeAppearanceSettings | undefined): string {
  const colors = resolveColors(settings ?? {})
  const toolOverrides = settings?.toolColors
  const lines: string[] = []

  // Unlisted tools keep the neutral fallback. Declared BEFORE the per-tool
  // rules: both selectors carry equal specificity (two attribute selectors),
  // so of two conflicting declarations the later one wins — a fallback
  // declared after the category rules would override every category color.
  lines.push(`${TOOL_ROW} { --ncolor-accent: ${colors.other}; }`)

  // Per-tool accent assignments (explicit overrides win over category color).
  for (const [category, tools] of Object.entries(TOOL_CATEGORIES)) {
    const key = category as keyof typeof TOOL_CATEGORIES
    for (const tool of tools) {
      const override = toolOverrides?.[tool]
      const color = typeof override === 'string' && isCssColor(override)
        ? override
        : colors[key]
      lines.push(`[data-chat-flow-kind="tool-call"] [data-tool="${attributeLiteral(tool)}"] { --ncolor-accent: ${color}; }`)
    }
  }

  // Non-tool accent rows.
  lines.push(`${COMMAND_ROW} { --ncolor-accent: ${colors.command}; }`)
  lines.push(`${THINK_ROW} { --ncolor-accent: ${colors.thinking}; }`)
  lines.push(`${CONTEXT_ROW} { --ncolor-accent: ${colors.context}; }`)
  lines.push(`${INJECTION_ROW} { --ncolor-accent: ${colors.context}; }`)
  lines.push(`${TOOL_RESULT_ROW} { --ncolor-accent: ${colors.file}; }`)
  lines.push(`${TURN_SUMMARY} { --ncolor-accent: ${colors.summary}; }`)

  // Collapsed process-group headers, keyed by the activity the kernel publishes
  // on the header button. The general form is the fallback for an activity this
  // build does not know about, declared FIRST for the same cascade reason as the
  // unlisted-tool fallback above: narrowing an attribute selector does not raise
  // specificity, so a fallback emitted after these mappings would override every
  // one of them and turn all group headers gray.
  lines.push(`${collapsedProcessHeader()} { --ncolor-accent: ${colors.other}; }`)
  for (const activity of Object.keys(PROCESS_ACTIVITIES) as ProcessActivityKind[]) {
    lines.push(`${collapsedProcessHeader(activity)} { --ncolor-accent: ${colors[PROCESS_ACTIVITIES[activity]]}; }`)
  }

  // One shared paint rule: 3px inset left rail (layout-free) + 8% wash. The
  // matching padding-left moves the row content off the rail so the leading
  // icon is never covered.
  lines.push(`${ACCENTED_ROWS} {
  box-shadow: inset 3px 0 0 var(--ncolor-accent);
  background-color: color-mix(in srgb, var(--ncolor-accent) 8%, transparent);
  padding-left: 3px;
}`)

  // Group headers lead with an icon, so their rail wants more air than the
  // shared 3px — at 3px the rail sits flush against the glyph and reads as a
  // stray stroke. Declared after the shared rule (equal specificity, so the
  // later one wins) and held identical while open so toggling cannot shift it.
  lines.push(`${collapsedProcessHeader()} { padding-left: 8px; }`)
  lines.push(`${PROCESS_HEADER_OPEN} { padding-left: 8px; }`)

  // The Turn summary bar is a section divider, not a block row: it takes the
  // accent on the hairline the kernel already draws under it, plus the shared
  // 8% wash. No rail and no indent, so it stays flush with the rows around it.
  lines.push(`${TURN_SUMMARY} {
  border-bottom-color: var(--ncolor-accent);
  background-color: color-mix(in srgb, var(--ncolor-accent) 8%, transparent);
}`)

  // Steering rows (mid-turn user steering) stay visually distinct from plain
  // user rows with a compass marker beside the right-aligned bubble. The
  // marker is a mask over the user-stack — the container that hugs the bubble
  // — positioned to the left of it, so the tint reads as a glyph next to the
  // message rather than a detached full-width rail (2026-08-21 用户反馈：
  // 整行 rail 突兀，改在 userStack 层做图标区分；slot 方案不可行：
  // conversation.message.images 是 single 槽且已被官方 ui-attachment 占用).
  // alpha.2 锚点迁移（2026-08-31）：消息行"时间悬浮"标识 data-time-hover-root
  // 已被 TurnTail/MessageItem 的 data-actions-reveal（always|hover）取代；
  // kind 与 首子=userStack 结构不变（ChatNodeSeat L206 / MessageItem L178 验证）。
  lines.push(`[data-chat-flow-kind="steering"] [data-actions-reveal] > :first-child {
  position: relative;
}`)
  lines.push(`[data-chat-flow-kind="steering"] [data-actions-reveal] > :first-child::before {
  content: '';
  position: absolute;
  right: 100%;
  margin-right: 6px;
  top: 50%;
  width: 14px;
  height: 14px;
  transform: translateY(-50%);
  background-color: ${colors.steering};
  -webkit-mask: url("${STEERING_ICON}") center / contain no-repeat;
  mask: url("${STEERING_ICON}") center / contain no-repeat;
}`)

  // Visibility switch for the restored injection rows. 选 CSS 而不是「让
  // Definition 不产出节点」：后者要 Definition 读配置并触发引擎重跑，而
  // `showThinking` 已经确立了「前端隐藏」这条先例，两处开关行为一致更好预期。
  if (settings?.showContextInjection === false) {
    lines.push(`${INJECTION_ROW} { display: none !important; }`)
  }

  // 同一开关形态的第三个：恢复出来的系统提示词卡。
  if (settings?.showSystemPrompt === false) {
    lines.push(`${SYSTEM_PROMPT_ROW} { display: none !important; }`)
  }

  // Visibility switch: hide Think rows entirely on the frontend. `!important`
  // outranks the module stylesheet's `.root { display: flex }` (same
  // specificity, but the plugin style tag is injected before the module's).
  if (settings?.showThinking === false) {
    lines.push(`${THINK_ROW} { display: none !important; }`)
    // A think-only node leaves its flowItem seat with zero height: the seat
    // still consumes the column's 16px flex gap on both sides, doubling the
    // spacing between the neighbors. Hide the whole seat when the think row
    // is the only child of its block container — block-internal thinks
    // (text + reasoning in one node) stay gap-neutral after hiding the row.
    lines.push(
      `[data-chat-flow-kind="assistant"]:has(${THINK_ROW}:only-child),`,
      `[data-chat-flow-kind="assistant-step"]:has(${THINK_ROW}:only-child) { display: none !important; }`,
    )
  }

  return lines.join('\n')
}
