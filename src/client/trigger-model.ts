/**
 * 触发通知卡的派生逻辑：把内核发来的那条「唤醒本轮」的上下文消息，变成卡片
 * 要显示的东西 —— 标题与图标、目标轮次的字段、以及时间戳。
 *
 * 本文件只放纯函数，组件只做 JSX（与 `ask-model` / `deliverable-model` 同构）。
 *
 * ## 为什么需要它
 *
 * 官方 `TurnTriggerNodeView` 把 `node.data.content` 原样交给 `NoticeBody`
 * （→ `ModelFacingContent` → `<pre>`）。对目标轮次来说，那段 content 是
 * **模型提示词的原文**：
 *
 * ```
 * <goal_round>
 * Objective: "……"
 * Round: 1/256
 *
 * Continue working toward the objective …
 * </goal_round>
 * ```
 *
 * 骨架（标签、`Objective:` 前缀、JSON 转义）对人不构成信息，却占满了展开区。
 * 本插件接管这个 key，把这些字段还原成人读的形式。
 *
 * ## 解析是「全有或全无」
 *
 * `<goal_round>` 的结构是内核私有约定（`goal-round-driver/src/prompt.ts`），
 * 它一变，任何半解析的结果都会显示成一张自信但不完整的卡片。所以解析失败时
 * 整卡退回「原文 + 等宽显示」的等价形态，绝不显示半截字段 —— 判据与
 * `deliverable-model`、`ContextBody` 的 `instructionChanges()` 同一条。
 *
 * ## 接管是全 key 的
 *
 * `conversation.chat.node` 是 keyed cell，同一 key 只有 priority 最低的注册
 * 会渲染。注册 `turn-trigger` 的 `priority: -1` 会让**全部**触发来源都走本
 * 插件组件，所以 {@link turnTriggerDetails} 复刻官方的 kind → 标题/图标映射
 * （含默认分支），非目标轮次的来源原样显示。
 */

/** 注入的 locale 翻译函数（注册时声明 `chat` 命名空间）。 */
export interface TriggerTranslate {
  (key: string, params?: Record<string, string | number>): string
}

/** 官方 `turn-trigger.ts` 的 `TurnTriggerIcon`：一族里挑一个已有的图标字形。 */
export type TriggerIcon =
  | 'agent' | 'github' | 'goal' | 'job' | 'plugin' | 'request' | 'schedule' | 'subagent' | 'team' | 'webhook'

/** 本卡从 `node.source` 读到的形状（内核记录的来源，鸭子类型）。 */
export interface TriggerSourceLike {
  kind?: unknown
  provider?: unknown
  round?: unknown
}

/** 本卡从 `node` 取用的字段（其余字段与本卡无关）。 */
export interface TriggerNodeLike {
  /** 记录时间（Unix epoch ms）。 */
  time: number
  /** 模型可见的内容块。 */
  content: unknown
  /** 持久化的来源标注。 */
  source: unknown
}

/** 内容的一段：文本，或本版本不认识的块（照官方做法单独渲染，不让它消失）。 */
export type ContentRun = { kind: 'text'; text: string } | { kind: 'block'; block: unknown }

/**
 * 拆开内容块：文本与未知块各成一段。
 * @param content - 持久化的内容块数组。
 * @returns 分段结果；不是数组时返回 null（调用方走等价外壳）。
 */
export function contentRuns(content: unknown): ContentRun[] | null {
  if (!Array.isArray(content)) return null
  const runs: ContentRun[] = []
  for (const block of content as readonly unknown[]) {
    const text = textBlock(block)
    runs.push(text === null ? { kind: 'block', block } : { kind: 'text', text })
  }
  return runs
}

/** 一个块是不是文本块；是则给出文本。 */
function textBlock(block: unknown): string | null {
  if (typeof block !== 'object' || block === null) return null
  const candidate = block as { type?: unknown; text?: unknown }
  return candidate.type === 'text' && typeof candidate.text === 'string' ? candidate.text : null
}

/**
 * 全部内容都是文本块时把它们拼起来。
 *
 * 目标轮次的提示词是**单个**文本块，所以拼起来就能直接拿去解析。出现任何
 * 非文本块即返回 null —— 那种内容本卡不负责解释，交给等价外壳按块渲染。
 * @param content - 持久化的内容块数组。
 * @returns 拼接后的文本，或 null。
 */
export function plainText(content: unknown): string | null {
  const runs = contentRuns(content)
  if (runs === null) return null
  let text = ''
  for (const run of runs) {
    if (run.kind !== 'text') return null
    text += run.text
  }
  return text
}

/** 记下的一段来源，读成对象。 */
function sourceRecord(source: unknown): TriggerSourceLike {
  return typeof source === 'object' && source !== null ? source as TriggerSourceLike : {}
}

/** 读一个字符串字段，非字符串当空串。 */
function textField(source: TriggerSourceLike, key: 'kind' | 'provider'): string {
  const value = source[key]
  return typeof value === 'string' ? value : ''
}

/** 识别出的触发来源：chat 字典的标题 key + 一族图标。 */
export interface TriggerDetails {
  /** `message.trigger.*` 的 key，交给 `t()` 取文案。 */
  titleKey: string
  icon: TriggerIcon
}

/**
 * 由来源标注判断该显示成什么 —— 逐条复刻官方 `turn-trigger.ts` 的 switch。
 *
 * 未识别的来源保留「收到执行请求」这一默认，**不假装知道**它的身份或结果
 * （官方注释：Custom sources remain visible without attributing unrecorded
 * identity or success）。
 * @param source - 持久化的来源标注。
 * @returns 标题 key 与图标。
 */
export function turnTriggerDetails(source: unknown): TriggerDetails {
  const record = sourceRecord(source)
  switch (textField(record, 'kind')) {
    case 'goal':
      return { titleKey: 'message.trigger.goal', icon: 'goal' }
    case 'agent-message':
      return { titleKey: 'message.trigger.agent', icon: 'agent' }
    case 'team-message':
      return { titleKey: 'message.trigger.team', icon: 'team' }
    case 'subagent-settled':
      return { titleKey: 'message.trigger.subagent', icon: 'subagent' }
    case 'webhook': {
      const github = textField(record, 'provider') === 'github'
      return github
        ? { titleKey: 'message.trigger.github', icon: 'github' }
        : { titleKey: 'message.trigger.webhook', icon: 'webhook' }
    }
    case 'schedule':
      return { titleKey: 'message.trigger.schedule', icon: 'schedule' }
    case 'tool-jobs':
      return { titleKey: 'message.trigger.job', icon: 'job' }
    case 'cordis-host-runner':
      return { titleKey: 'message.trigger.plugin', icon: 'plugin' }
    default:
      return { titleKey: 'message.trigger.request', icon: 'request' }
  }
}

/** 一次目标轮次，字段已从提示词里还原。 */
export interface GoalRound {
  /** 目标原文（JSON 转义已还原）。 */
  objective: string
  /** 本轮序号。 */
  round: number
  /** 轮次上限。 */
  maxRounds: number
  /** `Round:` 行之后那段发给模型的执行指令。 */
  instruction: string
}

/**
 * 目标轮次提示词的骨架。锚定整串：开头、`Objective:` 行、`Round:` 行、
 * 结尾的闭合标签缺一不可。
 *
 * `(\d+)\/(\d+)` 顺带挡住上限缺失的情形（内核在 `maxGoalRounds` 未设时会
 * 写出 `Round: 1/undefined`），那种文本会解析失败并整卡回退。
 */
const GOAL_ROUND = /^<goal_round>\nObjective: (.*)\nRound: (\d+)\/(\d+)\n\n([\s\S]*)\n<\/goal_round>$/

/**
 * 解析一段目标轮次提示词；结构不符即整体放弃。
 * @param text - 内容拼接后的文本。
 * @returns 还原后的字段，或 null。
 */
export function parseGoalRound(text: string): GoalRound | null {
  const matched = GOAL_ROUND.exec(text)
  if (matched === null) return null
  const [, encoded, round, maxRounds, instruction] = matched
  if (encoded === undefined || round === undefined || maxRounds === undefined || instruction === undefined) {
    return null
  }
  // `Objective` 侧做过 JSON.stringify，转义必须经 JSON.parse 还原；目标里本来
  // 含 `</goal_round>` 字样时它也是转义的，不会破坏上面的分段。
  let objective: unknown
  try {
    objective = JSON.parse(encoded)
  } catch {
    return null
  }
  if (typeof objective !== 'string') return null
  return {
    objective,
    round: Number(round),
    maxRounds: Number(maxRounds),
    instruction,
  }
}

/**
 * 来源里记录的轮次号。
 *
 * 它是**结构化事实**，比提示词文本可靠 —— 两者不一致时以它为准（解析成功但
 * 来源缺失的情况也存在，例如旧记录，那时回落到文本里的数字）。
 */
function roundFromSource(source: unknown): number | null {
  const record = sourceRecord(source)
  if (textField(record, 'kind') !== 'goal') return null
  const round = record.round
  return typeof round === 'number' && Number.isInteger(round) && round > 0 ? round : null
}

/**
 * 取一条消息的目标轮次，供卡片决定用哪种展开体。
 * @param node - 触发节点的时间、内容与来源。
 * @returns 字段齐备的目标轮次，或 null（调用方渲染等价外壳）。
 */
export function goalRoundOf(node: Pick<TriggerNodeLike, 'content' | 'source'>): GoalRound | null {
  const text = plainText(node.content)
  if (text === null) return null
  const parsed = parseGoalRound(text)
  if (parsed === null) return null
  const fromSource = roundFromSource(node.source)
  return fromSource === null ? parsed : { ...parsed, round: fromSource }
}

/** 两位补零。 */
function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * 紧凑的本地时间戳 —— 复刻 ui-chat 的 `formatMessageClock`。
 *
 * 跨插件不能 import 它的值（client bundle 的 purity gate 禁止 feature plugin
 * 之间做运行时 import），所以这份实现与它同源：同一天只给 `HH:mm`，同年补上
 * `clock.md` 的日期模板，跨年用 `clock.ymd`。日期模板仍从调用方的 locale
 * seat 取，插件不自带文案。
 * @param time - 记录时间（Unix epoch ms）。
 * @param t - 提供 `clock.md` / `clock.ymd` 模板的翻译席位。
 * @param now - 判定「今天 / 今年」的参照时刻。
 * @returns 与官方卡片一致的时钟串。
 */
export function formatClock(time: number, t: TriggerTranslate, now: number = Date.now()): string {
  const date = new Date(time)
  const reference = new Date(now)
  const clock = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  if (
    date.getFullYear() === reference.getFullYear()
    && date.getMonth() === reference.getMonth()
    && date.getDate() === reference.getDate()
  ) {
    return clock
  }
  const params = { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() }
  const day = date.getFullYear() === reference.getFullYear()
    ? t('clock.md', params)
    : t('clock.ymd', params)
  return `${day} ${clock}`
}
