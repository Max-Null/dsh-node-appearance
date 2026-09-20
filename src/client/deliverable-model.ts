/**
 * 交付行数据派生：把一次 `present` 调用还原成「状态 + 文件清单 + 结果文本」。
 *
 * 为什么要自己解析：官方 PresentRow 的折叠态把全部文件名逗号拼成一行
 * （`ui-deliverables/src/client/PresentRow.tsx` 的 `fileNames()`），多文件时读不完，
 * 也看不出这一轮交付了几个。完整清单只存在于调用的参数 JSON 里，所以折叠摘要与
 * 展开态都得自己解一份。
 *
 * 本模块是纯函数：不碰 locale、不碰 DOM，解析失败一律降级而不是抛错（接管后
 * 行由我们渲染，渲染不出来就等于用户什么都看不到）。
 *
 * 「等 N 个文件」这类摘要文案直写中文，与 goal-detail.tsx 同一取径：本插件不新造
 * locale 命名空间，而官方 deliverables 字典没有「共计 N 个」的 key（`presented.more`
 * 是「+ N 个文件」，用于溢出提示）。行内的标题、状态词与 inspect 仍取自官方字典。
 */

/**
 * 工具调用块里本行取用的字段（照官方 PresentRow 的取用面声明为鸭子类型，
 * 不为此引入 @deepseek-ai/dsh-client-ui-tool 依赖）。
 */
export interface DeliverableBlock {
  /** 未结算时参数在块本身；结算后搬到 `call` 上。流式中途可能是截断的 JSON。 */
  argsRaw?: string | undefined
  call?: { argsRaw?: string | undefined } | undefined
  content?: ReadonlyArray<{ type: string, text?: string | undefined }> | undefined
  error?: { name?: string | undefined, code?: string | undefined } | undefined
  isError?: boolean | undefined
}

/** 交付状态：运行中 / 完成 / 中断 / 出错。 */
export type DeliverableState = 'running' | 'ok' | 'stopped' | 'error'

/** 展开态里的一行：文件名、所在目录与扩展名徽标已拆好。 */
export interface DeliverableFile {
  /** 参数的完整路径，用于悬停提示。 */
  path: string
  /** 文件名部分（正反斜杠都兼容）。 */
  name: string
  /** 所在目录；纯文件名（没有分隔符）时为空串。 */
  dir: string
  /** 扩展名徽标：大写、至多 4 字符；没有扩展名时为 null。 */
  badge: string | null
}

/** 交付行渲染需要的全部派生结果。 */
export interface DeliverableModel {
  state: DeliverableState
  /** 折叠态摘要：单文件报文件名，多文件报「首个 + 数量」；参数未成形时报参数原文。 */
  summary: string
  /** 逐文件数据；参数未成形时为空数组。 */
  files: DeliverableFile[]
  /** 展开后的结果文本（结果无文本时退回错误描述，再没有则为空串）。 */
  details: string
  /** 结果文本的行数；没有文本时为 0。 */
  lineCount: number
  /** 是否有可展开的内容。 */
  expandable: boolean
}

/**
 * 从参数 JSON 里取文件路径。
 * 截断的 JSON（调用仍在流式输出）返回 null —— 与官方一致：那时原样显示参数
 * 文本，而不是当成「零个文件」。
 * @param raw - 参数 JSON 原文。
 * @returns 路径数组；JSON 未成形时为 null。
 */
function parsePaths(raw: string): string[] | null {
  let args: unknown
  try {
    args = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof args !== 'object' || args === null || !('files' in args)) return null
  const files = (args as { files?: unknown }).files
  if (!Array.isArray(files)) return null
  return files.flatMap((file: unknown) => {
    if (typeof file !== 'object' || file === null || !('path' in file)) return []
    const path = (file as { path?: unknown }).path
    return typeof path === 'string' ? [path] : []
  })
}

/** 最后一个路径分隔符的下标；没有分隔符时为 -1。 */
function separatorAt(path: string): number {
  return Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
}

/** 扩展名徽标：最后一个点之后的部分，过长截断；无扩展名返回 null。 */
function extensionBadge(name: string): string | null {
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return null
  const ext = name.slice(dot + 1)
  return (ext.length <= 4 ? ext : ext.slice(0, 4)).toUpperCase()
}

/** 拆一行：路径 → 文件名 + 所在目录 + 扩展名徽标。 */
function fileOf(path: string): DeliverableFile {
  const cut = separatorAt(path)
  const name = cut === -1 ? path : path.slice(cut + 1)
  return { path, name, dir: cut === -1 ? '' : path.slice(0, cut), badge: extensionBadge(name) }
}

/**
 * 折叠态摘要。
 * `paths === null` 表示参数 JSON 未成形，此时按官方做法原样显示参数文本；解析
 * 成功但一个路径都没取到时返回空串，不把 `{"files":[]}` 这种原文当摘要抛出去。
 */
function summaryOf(paths: string[] | null, fallback: string): string {
  if (paths === null) return fallback
  const first = paths[0]
  if (first === undefined) return ''
  const name = fileOf(first).name
  return paths.length === 1 ? name : `${name} 等 ${String(paths.length)} 个文件`
}

/** 结果文本：把结果节点拼成一段；未结算时没有结果。 */
function outputOf(settled: boolean, block: DeliverableBlock): string {
  if (!settled) return ''
  return (block.content ?? [])
    .map(item => item.type === 'text' ? item.text ?? '' : JSON.stringify(item))
    .join('\n')
}

/** 错误描述：没有结果文本时的兜底，比整行空白有用。 */
function errorTextOf(error: DeliverableBlock['error']): string {
  if (error === undefined) return ''
  const name = error.name ?? 'error'
  return error.code === undefined ? name : `${name}: ${error.code}`
}

/**
 * 派生一次交付的全部渲染数据。
 * @param block - 工具调用/结果块。
 * @returns 状态、折叠摘要、逐文件数据与结果文本。
 */
export function deliverableModel(block: DeliverableBlock): DeliverableModel {
  const settled = 'kind' in block
  const state: DeliverableState = !settled
    ? 'running'
    : block.error?.code === 'interrupted'
      ? 'stopped'
      : block.isError === true ? 'error' : 'ok'
  const args = (settled ? block.call?.argsRaw : block.argsRaw) ?? ''
  const output = outputOf(settled, block)
  const details = output !== ''
    ? output
    : settled ? errorTextOf(block.error) : ''
  const paths = parsePaths(args)
  const files = paths?.map(fileOf) ?? []
  return {
    state,
    summary: summaryOf(paths, args),
    files,
    details,
    lineCount: details === '' ? 0 : details.split('\n').length,
    // 比官方宽：官方只在有结果文本时可展开，这里交付了文件也允许展开看清单。
    expandable: files.length > 0 || details !== '',
  }
}
