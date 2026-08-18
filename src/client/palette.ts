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

/** One paintable node category. `command`, `thinking`, and `context` are non-tool rows. */
export type NodeCategory =
  | 'search' | 'agent' | 'execute' | 'file' | 'task' | 'command' | 'thinking' | 'context' | 'other'

/** Accent color per category (CSS colors). */
export type NodeAppearanceColors = Record<NodeCategory, string>

/** The settings value this plugin reads from its namespace scope. */
export interface NodeAppearanceSettings {
  /** Show assistant reasoning blocks as Think rows; false hides them. */
  showThinking?: boolean | undefined
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
  task: '#ec4899', // pink — todo_write / goal / job_* / schedule_*
  command: '#f97316', // orange — /command nodes
  thinking: '#c4b5fd', // light purple — Think rows
  context: '#8a9bb5', // slate blue — injected context rows (informational)
  other: '#64748b', // slate — every unlisted tool
}

/** Wire tool name → category for the shipped mapping. */
export const TOOL_CATEGORIES: Record<Exclude<NodeCategory, 'command' | 'thinking' | 'context'>, readonly string[]> = {
  search: ['web_search', 'web_fetch'],
  agent: ['subagent', 'subagent_acp', 'subagent_fork', 'send_message', 'interrupt_agent', 'list_agents', 'report', 'workflow'],
  execute: ['bash', 'pwsh', 'run_code', 'terminal_open', 'terminal_close', 'terminal_list', 'terminal_read', 'terminal_send', 'terminal_signal', 'str_replace_editor'],
  file: ['read', 'write', 'edit', 'read_image', 'glob', 'grep'],
  task: ['todo_write', 'create_goal', 'get_goal', 'update_goal', 'job_kill', 'job_list', 'job_output', 'schedule_create', 'schedule_delete', 'schedule_list', 'exit_plan_mode'],
  other: [],
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
 * The rows that carry the accent paint: the ToolRow root (not its wrapper
 * callRow — both carry data-tool, only the inner row carries data-variant),
 * command nodes, Think rows, and injected-context rows. The 3px inset rail is
 * compensated with a matching padding-left so the rail never covers the
 * row's leading icon.
 */
const ACCENTED_ROWS = [TOOL_ROW_ROOT, COMMAND_ROW, THINK_ROW, CONTEXT_ROW].join(',\n')

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
    const key = category as Exclude<NodeCategory, 'command' | 'thinking'>
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

  // One shared paint rule: 3px inset left rail (layout-free) + 8% wash. The
  // matching padding-left moves the row content off the rail so the leading
  // icon is never covered.
  lines.push(`${ACCENTED_ROWS} {
  box-shadow: inset 3px 0 0 var(--ncolor-accent);
  background-color: color-mix(in srgb, var(--ncolor-accent) 8%, transparent);
  padding-left: 3px;
}`)

  // Visibility switch: hide Think rows entirely on the frontend. `!important`
  // outranks the module stylesheet's `.root { display: flex }` (same
  // specificity, but the plugin style tag is injected before the module's).
  if (settings?.showThinking === false) {
    lines.push(`${THINK_ROW} { display: none !important; }`)
  }

  return lines.join('\n')
}
