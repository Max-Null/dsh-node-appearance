/**
 * 提问卡数据派生：把一次 `ask_user_question` 调用还原成「问题 + 全部选项 +
 * 实际选中项」。
 *
 * 为什么要自己解析：DSH 官方的转录卡只保留**已选答案**
 * （`ui-tool/src/client/tool/toolviews/ask-question-row.tsx` 的
 * `questionEntries()` 只取 `id`/`question`，把 `options` 丢掉了），所以提问
 * 结算后「当时还有哪些选项」在客户端管线上就没了。选项列表只存在于调用的
 * 参数 JSON 里 —— 这也是本插件接管 `ask_user_question` toolview 的唯一原因。
 *
 * 本模块是纯函数：不碰 locale、不碰 DOM，解析失败一律降级而不是抛错
 * （接管后卡片由我们渲染，渲染不出来就等于用户什么都看不到）。
 */

/** 模型给出的一个可选项。 */
export interface AskOption {
  /** 选项文本；同时是被 `selected` 回传的那个值。 */
  label: string
  /** 选项下方的补充说明，模型没给时为空。 */
  description: string
}

/** 一个问题：全部选项 + 实际回答。 */
export interface AskQuestion {
  id: string
  question: string
  /** 可选的短标题（模型提供时显示在问题上方）。 */
  header: string
  /** 可选的补充说明。 */
  detail: string
  /** 模型是否允许多选。 */
  multiSelect: boolean
  /** 模型当时给出的全部选项；调用没带选项时为空数组。 */
  options: AskOption[]
  /** 被选中的选项文本，按回答记录的顺序。 */
  selected: string[]
  /** 直接输入的文本答案（没选选项或额外补充时）。 */
  custom: string
}

/** 行的运行状态，与通用工具行保持同一套词汇。 */
export type AskRowState = 'running' | 'ok' | 'error' | 'stopped'

/** 问题集的结算程度。 */
export type AskPhase = 'pending' | 'answered' | 'unanswered'

/** 卡片渲染所需的全部派生结果。 */
export interface AskCardModel {
  state: AskRowState
  phase: AskPhase
  /** 被取消或被中断时记录判定来源；正常结算为 undefined。 */
  verdict: 'cancelled' | 'aborted' | undefined
  questions: AskQuestion[]
  /** 至少选了选项或填了自定义答案的问题数（折叠行的 N/M 用）。 */
  answeredCount: number
  /**
   * 参数 JSON 解析不出来时用于兜底展示的结果文本；运行中或结果无文本时为
   * null。没有它，一次畸形调用会让接管后的行变成空白。
   */
  fallbackText: string | null
}

/**
 * `ask_user_question` 的 block 里本卡读到的字段子集。
 * 结构照 DSH 的 `ToolCallBlock`（运行中=调用自身，结算后=带 `kind` 的结果
 * 节点）声明为鸭子类型：跨插件只允许 type-only 引用，这里连类型引用都不需要。
 */
export interface AskToolBlock {
  /** 运行中的调用没有这个字段；结算后为 `'tool-result'`。 */
  kind?: string | undefined
  callId?: string | undefined
  /** 运行中形态：调用自身携带参数。 */
  argsRaw?: string | undefined
  /** 结算形态：调用头（子调用被剥掉时为 null）。 */
  call?: { argsRaw?: string | undefined } | null | undefined
  /** 结算形态：结果内容块。 */
  content?: readonly unknown[] | undefined
  error?: { code?: string | undefined } | undefined
  isError?: boolean | undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 读一个字符串字段，非字符串一律当空串。 */
function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function parseJson(source: string): unknown {
  try {
    return JSON.parse(source)
  } catch {
    // 流式截断的半截 JSON 是正常现象：降级为「无问题」，由调用方兜底展示原文。
    return undefined
  }
}

/** 从结果内容块拼出展示文本（文本块原样、其余块转 JSON）。 */
export function resultTextOf(block: AskToolBlock): string | null {
  const content = block.content
  if (!Array.isArray(content) || content.length === 0) return null
  const parts: string[] = []
  for (const part of content) {
    if (isRecord(part) && part.type === 'text' && typeof part.text === 'string') parts.push(part.text)
    else parts.push(JSON.stringify(part, null, 2))
  }
  return parts.length === 0 ? null : parts.join('\n')
}

/** 参数 JSON 里的原始问题（未经回答配对）。 */
interface RawQuestion {
  id: string
  question: string
  header: string
  detail: string
  multiSelect: boolean
  options: AskOption[]
}

function readOptions(value: unknown): AskOption[] {
  if (!Array.isArray(value)) return []
  const options: AskOption[] = []
  for (const item of value) {
    if (typeof item === 'string') {
      // 宽容形态：模型偶尔直接给字符串数组而不是 {label} 对象。
      if (item !== '') options.push({ label: item, description: '' })
      continue
    }
    if (!isRecord(item)) continue
    const label = text(item.label)
    if (label === '') continue
    options.push({ label, description: text(item.description) })
  }
  return options
}

/** 读调用参数里的问题列表；拿不到合法问题时返回 null（由调用方兜底）。 */
function readQuestions(argsRaw: string): RawQuestion[] | null {
  const parsed = parseJson(argsRaw)
  if (!isRecord(parsed) || !Array.isArray(parsed.questions)) return null
  const questions: RawQuestion[] = []
  for (const item of parsed.questions) {
    if (!isRecord(item)) continue
    const question = text(item.question)
    if (question === '') continue
    questions.push({
      id: text(item.id),
      question,
      header: text(item.header),
      detail: text(item.detail),
      multiSelect: item.multiSelect === true,
      options: readOptions(item.options),
    })
  }
  return questions.length === 0 ? null : questions
}

/** 一条回答记录。 */
interface RawAnswer {
  id: string
  selected: string[]
  custom: string
}

function readAnswers(resultText: string | null): RawAnswer[] | null {
  if (resultText === null) return null
  const parsed = parseJson(resultText)
  if (!isRecord(parsed) || !Array.isArray(parsed.answers)) return null
  const answers: RawAnswer[] = []
  for (const item of parsed.answers) {
    if (!isRecord(item)) continue
    const selected = Array.isArray(item.selected)
      ? item.selected.filter((v): v is string => typeof v === 'string')
      : []
    answers.push({ id: text(item.id), selected, custom: text(item.custom) })
  }
  return answers
}

/** 调用参数：运行中取 block 自身，结算后取结算节点的调用头。 */
function argsRawOf(block: AskToolBlock): string {
  return 'kind' in block ? block.call?.argsRaw ?? '' : block.argsRaw ?? ''
}

/**
 * 从一次提问调用的冻结切片派生卡片模型。
 * @param block - 运行中的调用或已结算的结果节点。
 * @returns 卡片模型；参数或结果畸形时 `questions` 为空并带兜底文本。
 */
export function askCardModel(block: AskToolBlock): AskCardModel {
  const settled = 'kind' in block
  const code = settled ? block.error?.code : undefined
  // Composer 的两种判定自带专用 error code，不能按通用失败处理：用户自己
  // 取消（ASK_CANCELLED）是一次正常结算，中断（ASK_ABORTED）沿用其他被中断
  // 工具调用的 amber「已停止」语义 —— 与官方 ask-question-row 的 state 覆盖
  // 逐条一致。
  const state: AskRowState = !settled ? 'running'
    : code === 'ASK_ABORTED' || code === 'interrupted' ? 'stopped'
      : code === 'ASK_CANCELLED' ? 'ok'
        : block.isError === true ? 'error' : 'ok'
  const argsRaw = argsRawOf(block)
  const resultText = settled ? resultTextOf(block) : null

  // 判定来源优先于结算形态：Composer 取消 / 回合中断都会带自己的 error code，
  // 此时结果里没有答案，但仍应列出问题本身（与官方转录卡的语义一致）。
  let verdict: AskCardModel['verdict']
  let phase: AskPhase
  if (code === 'ASK_CANCELLED') {
    verdict = 'cancelled'
    phase = 'unanswered'
  } else if (code === 'ASK_ABORTED') {
    verdict = 'aborted'
    phase = 'unanswered'
  } else if (!settled) {
    phase = 'pending'
  } else {
    phase = resultText === null ? 'unanswered' : 'answered'
  }

  const raw = readQuestions(argsRaw)
  if (raw === null) {
    return {
      state, phase, verdict, questions: [], answeredCount: 0,
      fallbackText: resultText ?? (argsRaw === '' ? null : argsRaw),
    }
  }

  // 回答按 id 配对；配不上的问题保留全部选项、标记为未选 —— 官方在严格配对
  // 失败时整卡降级，这里宁可少标一个"已选"也不丢掉用户想看的选项列表。
  const byId = new Map<string, RawAnswer>()
  for (const answer of readAnswers(resultText) ?? []) {
    if (!byId.has(answer.id)) byId.set(answer.id, answer)
  }
  const questions: AskQuestion[] = raw.map(question => {
    const answer = byId.get(question.id)
    return {
      ...question,
      selected: answer?.selected ?? [],
      custom: answer?.custom ?? '',
    }
  })
  const answeredCount = questions
    .filter(question => question.selected.length > 0 || question.custom !== '')
    .length
  return { state, phase, verdict, questions, answeredCount, fallbackText: resultText }
}

/** 折叠行右侧的进度计数（文案由组件用 locale 组装）。 */
export function askProgress(model: AskCardModel): { answered: number; total: number } {
  return { answered: model.answeredCount, total: model.questions.length }
}
