/**
 * Host half of dsh-node-appearance: registers the `node-appearance` settings
 * namespace carrying the palette and the Think-visibility switch. The browser
 * half reads the same namespace through `ctx.settingsScope` and paints the
 * chat flow from it — see `src/client/`.
 */

import type { Context } from '@deepseek-ai/cordis'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'

export const name = 'dsh-node-appearance'

/** The settings namespace this plugin owns (spelled identically in both halves). */
export const NODE_APPEARANCE_NS = settingsNamespace('node-appearance')

/** Accent color per category (CSS colors). */
export interface NodeAppearanceColors {
  search: string
  agent: string
  execute: string
  file: string
  task: string
  command: string
  thinking: string
  context: string
  steering: string
  other: string
}

/** The plugin configuration: palette plus the Think-visibility switch. */
export interface Config {
  /** Show assistant reasoning blocks as Think rows; false hides them on the frontend. */
  showThinking: boolean
  /** Per-category accent colors. */
  colors: NodeAppearanceColors
  /** Per-tool accent overrides keyed by wire tool name. */
  toolColors: Record<string, string>
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
  steering: '#f472b6', // pink — steering rows (rc.8)
  other: '#64748b', // slate — every unlisted tool
}

export const Config: z<Config> = z.object({
  showThinking: z.boolean().default(true),
  colors: z.object({
    search: z.string().default(DEFAULT_COLORS.search),
    agent: z.string().default(DEFAULT_COLORS.agent),
    execute: z.string().default(DEFAULT_COLORS.execute),
    file: z.string().default(DEFAULT_COLORS.file),
    task: z.string().default(DEFAULT_COLORS.task),
    command: z.string().default(DEFAULT_COLORS.command),
    thinking: z.string().default(DEFAULT_COLORS.thinking),
    context: z.string().default(DEFAULT_COLORS.context),
    steering: z.string().default(DEFAULT_COLORS.steering),
    other: z.string().default(DEFAULT_COLORS.other),
  }).default(DEFAULT_COLORS),
  toolColors: z.dict(z.string()).default({}),
})

/**
 * Install the plugin's settings section; the browser half consumes it.
 * @param ctx - Host context.
 * @param config - the composed entry config (becomes the section's base layer).
 */
export function apply(ctx: Context, config: Config): void {
  installSettingsSection(ctx, NODE_APPEARANCE_NS, Config, config, {
    setSource: () => {},
    onChange: () => {},
  })
}
