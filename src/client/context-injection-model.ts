/**
 * 上下文注入行的纯投影：一条 `user/message` 事件 → 可渲染字段。
 *
 * ## 为什么需要它
 *
 * 0.2.0 起 ui-chat 的 `isVisibleChatNode()`
 * （`packages/client/ui-chat/src/client/contract/chat-visibility.ts`）把
 * `kind === 'context'` 的节点整个从对话面板滤掉，只有含 `tool-addition` /
 * `tool-removal` 的 context 行留下。该变更首次进入 `dsh-v0.1.7-alpha.1`
 * （commit 776efdf321「hide infrastructure rows and retain turn triggers」）；
 * 在那之前（0.1.5 线）注入行全部显示。官方的 `context` 节点**仍在生成**，
 * 只是不再渲染——所以接管 `context` 这个 key 没有意义，它根本走不到渲染。
 *
 * 本插件改为用自有 kind 重新接住同一批事件：`ChatNodeDataMap` 是
 * merge-extensible 的，其注释原文即「业务模块贡献的渲染 kind」，这是官方
 * 留的口子。
 *
 * ## 复刻而非导入
 *
 * 浏览器半边不能值导入其他包（client bundle purity gate），所以判据照官方
 * 逐条复刻，官方变更时本文件需同步——与 `trigger-model.ts` 复刻
 * `turnTriggerDetails` 同一性质：
 *
 * - `isAppendSurface` ← `@deepseek-ai/dsh-session/surface` 的 `isSurfaceEvent`
 *   + `isAppendSurfaceEvent`（surface 五型且 `surfaceOp === 'append'`）
 * - `contextProducer` / `contextForm` ← ui-chat
 *   `conversation-nodes/event-projection.ts`
 */

/** 本投影从事件上读取的字段；其余事件数据一概不碰。 */
export interface InjectedContextEventLike {
  readonly type: string
  readonly seq: number
  readonly time: number
  readonly surfaceOp?: unknown
  readonly data: {
    readonly content?: unknown
    readonly source?: unknown
  }
}

/** 注入来源扮演的角色：普通注入，或跨会话召回。 */
export type ContextProducerRole = 'inject' | 'recall'

/** 折叠头右侧展示的来源身份。 */
export interface ContextProducer {
  readonly role: ContextProducerRole
  /** 可读来源名（文件路径 / 工具名 / 事件 kind）；无名为 null。 */
  readonly label: string | null
}

/**
 * 官方 `contextForm` 认得的结构化形态。不在表内的按不透明正文渲染——
 * `MessageSourceMap` 是 merge-extensible 的，新形态不该被当成错误。
 */
export const KNOWN_CONTEXT_FORMS = [
  'instructions', 'catalog', 'snapshot', 'notice', 'relay', 'recall',
] as const

/** 官方 `KnownContextForm` 在本插件里的等价物。 */
export type KnownContextForm = typeof KNOWN_CONTEXT_FORMS[number]

/** 官方 surface 事件类型集合（`@deepseek-ai/dsh-session/surface`）。 */
const SURFACE_EVENT_TYPES = new Set<string>([
  'system/message',
  'developer/message',
  'user/message',
  'assistant/message',
  'tool/result',
])

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function collect(source: Record<string, unknown>, member: string, field: string): string[] {
  const list = source[member]
  if (!Array.isArray(list)) return []
  const seen: string[] = []
  for (const entry of list) {
    const record = asRecord(entry)
    const value = record === null ? null : readString(record, field)
    if (value !== null && !seen.includes(value)) seen.push(value)
  }
  return seen
}

function joined(names: string[]): string | null {
  return names.length > 0 ? names.join(', ') : null
}

/**
 * 事件是否已进入模型可见 surface（而非仅落盘的日志记录）。
 * @param event - 候选事件。
 * @returns 事件类型属于 surface 五型且带 `surfaceOp` 时为 true。
 */
export function isSurfaceEvent(event: unknown): boolean {
  const record = asRecord(event)
  if (record === null) return false
  const type = record['type']
  if (typeof type !== 'string' || !SURFACE_EVENT_TYPES.has(type)) return false
  return record['surfaceOp'] !== undefined
}

/**
 * 事件是否以 append 进入 surface（从未作为替换副本出现过）。
 *
 * 人类转录以 append 为durable 源material：被替换遮蔽的区间在模型可见面上
 * 是对的，拿它当聊天记录会抹掉用户已经看过的内容。
 * @param event - 候选事件。
 * @returns append-origin surface 事件时为 true。
 */
export function isAppendSurface(event: unknown): boolean {
  const record = asRecord(event)
  return isSurfaceEvent(event) && record?.['surfaceOp'] === 'append'
}

/**
 * 该事件是不是一条「上下文注入」——即非人类输入、以 append 进入 surface 的
 * `user/message`。判据对齐官方 `messageDefinition.start`：凡 `source.kind`
 * 不是 `user` 的 `user/message` 都是注入（`compact-checkpoint` 走替换路径，
 * 已被 append 条件排除）。
 * @param event - 候选事件。
 * @returns 需要以注入行重新呈现时为 true。
 */
export function isInjectedContextEvent(event: unknown): boolean {
  const record = asRecord(event)
  if (record === null || record['type'] !== 'user/message') return false
  if (!isAppendSurface(event)) return false
  const data = asRecord(record['data'])
  const source = data === null ? null : asRecord(data['source'])
  const kind = source === null ? null : readString(source, 'kind')
  return kind !== null && kind !== 'user'
}

/**
 * 读取注入来源声明的展示形态。
 * @param source - 落盘的 `user/message` source。
 * @returns 官方认得的结构化形态，否则 null（按不透明正文渲染）。
 */
export function contextForm(source: unknown): KnownContextForm | null {
  const record = asRecord(source)
  const form = record === null ? null : readString(record, 'form')
  return form !== null && (KNOWN_CONTEXT_FORMS as readonly string[]).includes(form)
    ? form as KnownContextForm
    : null
}

/**
 * 把落盘 source 投影成折叠头要显示的角色与来源名。
 * @param source - 落盘的 `user/message` source。
 * @returns 角色与可读来源名。
 */
export function contextProducer(source: unknown): ContextProducer {
  const record = asRecord(source)
  const kind = record === null ? null : readString(record, 'kind')
  if (record === null || kind === null) return { role: 'inject', label: null }
  switch (kind) {
    case 'session-reference':
      return { role: 'recall', label: joined(collect(record, 'references', 'label')) ?? kind }
    case 'agent-instructions':
      return { role: 'inject', label: joined(collect(record, 'changes', 'path')) ?? kind }
    case 'skill-invocation':
      return { role: 'inject', label: readString(record, 'name') ?? kind }
    default:
      // MessageSourceMap 是 merge-extensible 的：不认识的来源按 kind 原样露出，
      // 不猜也不吞。
      return { role: 'inject', label: kind }
  }
}

/** 一行注入的渲染字段。 */
export interface InjectedContextState {
  readonly seq: number
  readonly time: number
  readonly content: readonly unknown[]
  readonly source: unknown
  readonly producer: ContextProducer
  readonly form: KnownContextForm | null
}

/**
 * 把一条注入事件投影成渲染字段。
 * @param event - 已由 {@link isInjectedContextEvent} 判定为注入的事件。
 * @returns 该行的渲染字段。
 */
export function injectedContextState(event: InjectedContextEventLike): InjectedContextState {
  const data = asRecord(event.data) ?? {}
  const content = data['content']
  return {
    seq: event.seq,
    time: event.time,
    content: Array.isArray(content) ? content : [],
    source: data['source'],
    producer: contextProducer(data['source']),
    form: contextForm(data['source']),
  }
}
