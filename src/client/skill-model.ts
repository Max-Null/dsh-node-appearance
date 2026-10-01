/**
 * 技能行的数据派生：剥掉 `<skill_content>` 的三层壳，还原出「说明正文 + 资源指引」。
 *
 * 为什么要自己解析：官方 `SkillRow` 的展开体是一个 `<pre>`，里面铺的是 `skill`
 * 工具返回的**规范渲染块**（`dsh-skill` 的 `renderSkillContent`）——
 * `<skill_content name="…">` 套 `<skill_resources>`（一两行资源指引）再套
 * `<skill_instructions>`（技能正文）。那层 XML 壳对人不构成信息，却把正文夹在
 * 中间（与触发卡那条 `<goal_round>` 骨架同一个问题）。
 *
 * 本模块是纯函数：不碰 locale、不碰 DOM；**结构不符一律退回原文**而不是抛错或
 * 猜——接管之后行由我们渲染，渲染不出来就等于用户什么都看不到。
 */

/**
 * 工具调用块里本行取用的字段（照官方 `SkillRow` 的取用面声明为鸭子类型，
 * 不为此引入 `@deepseek-ai/dsh-client-ui-tool` 依赖）。
 */
export interface SkillBlock {
  /** 未结算时参数在块本身；结算后搬到 `call` 上。流式中途可能是截断的 JSON。 */
  argsRaw?: string | undefined
  callId?: string | undefined
  call?: { argsRaw?: string | undefined } | undefined
  content?: ReadonlyArray<{ type: string, text?: string | undefined }> | undefined
  error?: { name?: string | undefined, code?: string | undefined } | undefined
  isError?: boolean | undefined
}

/** 技能行状态：运行中 / 完成 / 中断 / 出错。 */
export type SkillState = 'running' | 'ok' | 'stopped' | 'error'

/** 剥壳结果：规范块的两个内容段。 */
export interface SkillContent {
  /** `<skill_resources>` 段原文（资源指引）。 */
  readonly resources: string
  /** `<skill_instructions>` 段原文（技能正文）。 */
  readonly instructions: string
}

/** 技能行渲染需要的全部派生结果。 */
export interface SkillModel {
  state: SkillState
  /** 技能名（参数 JSON 的 `name`；参数未成形时退回参数原文首行）。 */
  name: string
  /** 技能正文；未剥壳成功时为空串。 */
  instructions: string
  /** 资源指引原文；未剥壳成功时为空串。 */
  resources: string
  /** 结果原文——未剥壳成功时展开体铺它，与官方形态等价。 */
  raw: string
  /** 是否成功剥掉 `<skill_content>` 壳。 */
  parsed: boolean
  /** 错误摘要（仅 error 态；取结果首行）。 */
  errorSummary: string | null
  /** 是否有可展开的内容。 */
  expandable: boolean
}

/** 首行：折叠态错误摘要与参数原文的取用面。 */
function firstLine(text: string): string {
  const newline = text.indexOf('\n')
  return newline === -1 ? text : text.slice(0, newline)
}

/**
 * 技能名：参数 JSON 的 `name`。
 * @param argsRaw - 参数 JSON 原文（流式中途可能是截断的）。
 * @param callId - 参数完全取不到时的兜底标识。
 * @returns 技能名（截断 JSON 取其首行）。
 */
export function skillName(argsRaw: string, callId: string): string {
  try {
    const parsed: unknown = JSON.parse(argsRaw)
    if (typeof parsed === 'object' && parsed !== null) {
      const name = (parsed as Record<string, unknown>)['name']
      if (typeof name === 'string' && name !== '') return firstLine(name)
    }
  } catch {
    // 流式中途暴露的是截断的 JSON 前缀，它的首行仍比「换成一次无关的目录查询」有用。
  }
  return argsRaw === '' ? callId : firstLine(argsRaw)
}

/** 结果文本：把结果节点拼成一段；未结算时没有结果。 */
function resultText(settled: boolean, block: SkillBlock): string {
  if (!settled) return ''
  const parts: string[] = []
  for (const item of block.content ?? []) {
    parts.push(item.type === 'text' ? item.text ?? '' : JSON.stringify(item, null, 2))
  }
  if (parts.length === 0 && block.error !== undefined) {
    parts.push(`${block.error.name ?? 'error'}: ${block.error.code ?? ''}`.trim())
  }
  return parts.join('\n')
}

/**
 * 剥掉 `<skill_content>` 壳，取出资源段与正文段。
 *
 * 判据是**逐行对帧**而不是一条宽松正则：正文里出现 `</skill_instructions>` 这类
 * 字面量是允许的（官方测试就带这种用例），所以收尾用的是**末尾三行的固定形状**，
 * 内容段则取两端之间的全部文本。
 * @param output - `skill` 工具的结果原文。
 * @returns 两个内容段；形状不符时为 null（调用方退回原文渲染）。
 */
export function parseSkillContent(output: string): SkillContent | null {
  const lines = output.split('\n')
  if (lines.length < 6) return null
  const [head, resourcesOpen] = lines
  if (head === undefined || resourcesOpen === undefined) return null
  if (!/^<skill_content name="[^"]*">$/.test(head)) return null
  if (resourcesOpen !== '<skill_resources>') return null

  // 末尾三行固定：</skill_instructions> / </skill_content>（可能带一个尾随空行）。
  let tail = lines.length
  while (tail > 0 && lines[tail - 1] === '') tail--
  const contentClose = lines[tail - 1]
  const instructionsClose = lines[tail - 2]
  if (contentClose !== '</skill_content>' || instructionsClose !== '</skill_instructions>') return null

  const resourcesClose = lines.indexOf('</skill_resources>', 1)
  if (resourcesClose === -1) return null
  const instructionsOpen = lines.indexOf('<skill_instructions>', resourcesClose + 1)
  if (instructionsOpen === -1) return null
  // 两个开标签之间必须正好隔一个空行（renderSkillContent 的形状）。
  if (instructionsOpen !== resourcesClose + 2) return null
  if (lines[resourcesClose + 1] !== '') return null
  if (instructionsOpen + 1 > tail - 2) return null

  return {
    // 开标签各占一行：lines[1] 是 <skill_resources>，lines[?] 是 <skill_instructions>。
    resources: lines.slice(2, resourcesClose).join('\n'),
    instructions: lines.slice(instructionsOpen + 1, tail - 2).join('\n'),
  }
}

/**
 * 派生一次技能加载的全部渲染数据。
 * @param block - 工具调用/结果块。
 * @returns 状态、技能名、剥壳后的两段与原文退回所需的字段。
 */
export function skillModel(block: SkillBlock): SkillModel {
  const settled = 'kind' in block
  const state: SkillState = !settled
    ? 'running'
    : block.error?.code === 'interrupted'
      ? 'stopped'
      : block.isError === true ? 'error' : 'ok'
  const args = (settled ? block.call?.argsRaw : block.argsRaw) ?? ''
  const raw = resultText(settled, block)
  const parsed = raw === '' ? null : parseSkillContent(raw)
  return {
    state,
    name: skillName(args, block.callId ?? ''),
    instructions: parsed?.instructions ?? '',
    resources: parsed?.resources ?? '',
    raw,
    parsed: parsed !== null,
    errorSummary: state === 'error' && raw !== '' ? firstLine(raw) : null,
    expandable: raw !== '',
  }
}
