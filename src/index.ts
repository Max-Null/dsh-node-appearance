/**
 * Host half of dsh-node-appearance: registers the `node-appearance` settings
 * namespace carrying the palette and the Think-visibility switch. The browser
 * half reads the same namespace through `ctx.settingsScope` and paints the
 * chat flow from it — see `src/client/`.
 */

import type { Context, Volatile } from '@deepseek-ai/cordis'
// `Dict` 必须显式引用：`toolColors` 的 schema 是 `z.dict(z.string())`，其推导类型
// 含 cosmokit 的 `Dict`；生成 .d.ts 时若本文件没有它的引用，tsc 会报 TS2883
// 「inferred type cannot be named without a reference to ...」。在接口里用它声明
// 同一字段，既让类型可命名，也让声明与 schema 对齐。
import type { Dict } from '@deepseek-ai/cosmokit'
import z from '@deepseek-ai/schemastery'

export const name = 'dsh-node-appearance'

/** The settings namespace this plugin owns (spelled identically in both halves).
 *  dsh-settings 0.1.2-alpha.2 起 register/installSection 用 SettingsNamespaceInput
 *  模板字面量自动 parse——settingsNamespace() 函数已删除，改裸字面量。 */
export const NODE_APPEARANCE_NS = 'node-appearance'

/** Accent color per category (CSS colors). */
export interface NodeAppearanceColors {
  search: string
  agent: string
  execute: string
  file: string
  deliver: string
  task: string
  ask: string
  command: string
  thinking: string
  context: string
  steering: string
  other: string
}

/** The plugin configuration: palette plus the Think-visibility switch.
 *
 *  0.1.7 起插件的 Config schema 本身就构成它的 settings section（不再有
 *  `installSection`），可变字段用 `Volatile<T>` + `.volatile()` 声明，读值走
 *  `config.<field>.get()`。见官方同款范例 `web-search-deepseek/src/index.ts`。
 *
 *  **三个字段都要标 volatile**：`settings/src/schema.ts` 的 `isVolatilePath`
 *  只承认「祖先节点标了 volatile」的路径，而 `settings/src/index.ts:406` 对
 *  非 volatile 路径直接 `throw new Error(... is not volatile)`。所以漏标
 *  `colors` / `toolColors` 会让浏览器半的 `mutate()` 写配色时抛错。标了之后
 *  其整棵子树（含 `colors.search` 这类）都可写。 */
export interface Config {
  /** Show assistant reasoning blocks as Think rows; false hides them on the frontend. */
  showThinking: Volatile<boolean>
  /** Per-category accent colors. */
  colors: Volatile<NodeAppearanceColors>
  /** Per-tool accent overrides keyed by wire tool name. */
  toolColors: Volatile<Dict<string>>
}

/** Initial palette: mid-luminance hues readable on both light and dark themes. */
export const DEFAULT_COLORS: NodeAppearanceColors = {
  search: '#3b82f6', // blue — web_search / web_fetch
  agent: '#a855f7', // purple — subagent / workflow / send_message …
  execute: '#f59e0b', // amber — bash / pwsh / run_code / terminal_*
  file: '#22c55e', // green — read / write / edit / glob / grep
  deliver: '#06b6d4', // cyan — present 交付文件行（与 file 绿区分，见 client/palette.ts）
  task: '#ec4899', // pink — todo_write / goal / job_* / schedule_*
  ask: '#65a30d', // lime — ask_user_question 提问卡（避开 search 的蓝）
  command: '#f97316', // orange — /command nodes
  thinking: '#c4b5fd', // light purple — Think rows
  context: '#8a9bb5', // slate blue — injected context rows (informational)
  steering: '#14b8a6', // teal — steering rows (rc.8)
  other: '#64748b', // slate — every unlisted tool
}

// 不写 `z<Config>` 显式泛型：`.volatile()` 会把字段的 schema 模式变成
// `'volatile-defined'`，与接口里声明的 `Volatile<T>` 不是同一个 `Mode`，
// 显式标注会因 `default()` 的参数类型不兼容而报 TS2322。官方同款范例
// （`web-search-deepseek/src/index.ts`）同样让 TS 自行推导。
export const Config = z.object({
  showThinking: z.boolean().default(true).volatile(),
  colors: z.object({
    search: z.string().default(DEFAULT_COLORS.search),
    agent: z.string().default(DEFAULT_COLORS.agent),
    execute: z.string().default(DEFAULT_COLORS.execute),
    file: z.string().default(DEFAULT_COLORS.file),
    deliver: z.string().default(DEFAULT_COLORS.deliver),
    task: z.string().default(DEFAULT_COLORS.task),
    ask: z.string().default(DEFAULT_COLORS.ask),
    command: z.string().default(DEFAULT_COLORS.command),
    thinking: z.string().default(DEFAULT_COLORS.thinking),
    context: z.string().default(DEFAULT_COLORS.context),
    steering: z.string().default(DEFAULT_COLORS.steering),
    other: z.string().default(DEFAULT_COLORS.other),
  }).default(DEFAULT_COLORS).volatile(),
  toolColors: z.dict(z.string()).default({}).volatile(),
})

/**
 * The Host half no longer installs a settings section itself.
 *
 * 0.1.7 的 settings 服务的公开面只有 `configure` / `describe` / `update` /
 * `replace` / `mutate`（`settings/src/index.ts`），`installSection` 已不存在——
 * 调它只会抛 TypeError。现在 section 由 loader 依据本模块导出的 `Config`
 * schema 自动构成（`settings/src/schema.ts` 的 `volatileForm`），namespace 就是
 * 本插件的 entry id（`node-appearance`，与 {@link NODE_APPEARANCE_NS} 同值）。
 * 浏览器半经 `ctx.configForms.get(NS)` 读写同一份。
 * @param _ctx - Host context（此处无需注册任何东西）。
 * @param _config - composed entry config，由 settings 服务按 schema 解析。
 */
export function apply(_ctx: Context, _config: Config): void {}
