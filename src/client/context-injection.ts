/**
 * 注入行的事件→节点 Definition。
 *
 * 它注册在 `ctx.uiConversation.events` 上，与官方 ui-chat 的
 * `messageDefinition`（kind `input-message`）处理**同一批** `user/message`
 * 事件，只是产出另一种渲染 kind。注册表按 definition.kind 唯一，因此两条
 * Definition 并存不冲突；引擎按 kind 分桶组装各自的 Context，节点 key 也
 * 因此互不覆盖——官方自己就有 `input-message` 与 `developer-message` 两条
 * Definition 同时产出 `context` 渲染 kind 的先例。
 *
 * 未做 `request-prompt` 那一半（系统提示词卡片）：它还要复刻
 * `system-message` + `request-prompt` 两条 Definition 共享的位置状态机
 * （`showsPrompt` / `stableRequestPromptAnchor`），风险高于收益，暂缓。
 */

import {
  injectedContextState, isInjectedContextEvent,
  type InjectedContextEventLike, type InjectedContextState,
} from './context-injection-model.ts'

/** 本插件为恢复注入行而注册的渲染 kind（同时是 slot 分发的 key）。 */
export const CONTEXT_INJECTION_KIND = 'context-injection'

/** Definition 状态：渲染字段 + 引擎给的会话位置。 */
export interface ContextInjectionState extends InjectedContextState {
  readonly location: unknown
}

/** Definition 上本文件用到的字段；其余由引擎拥有。 */
export interface ContextInjectionDefinition {
  readonly kind: string
  readonly target: string
  match(event: unknown): { readonly id: string; readonly role: 'start' } | null
  start(context: unknown, match: unknown): ContextInjectionState
  update(context: unknown): ContextInjectionState | undefined
  buildViewNode(context: unknown): unknown | null
}

/** 引擎随 match 递进来的位置信息。 */
interface StartMatchLike {
  readonly event: unknown
  readonly location: unknown
}

/** 引擎组装出的 Context 上本文件读取的字段。 */
interface ContextLike {
  readonly key: string
  readonly id: string
  readonly state: ContextInjectionState | undefined
}

/**
 * 构造恢复注入行的 Definition。
 * @returns 注册到 `ctx.uiConversation.events` 的 Definition。
 */
export function contextInjectionDefinition(): ContextInjectionDefinition {
  return {
    kind: CONTEXT_INJECTION_KIND,
    target: 'chat',
    match: (event) => {
      if (!isInjectedContextEvent(event)) return null
      // 身份取 seq：同一 definition 内逐事件唯一，且不依赖 source 是否带 id。
      const seq = (event as { seq?: unknown }).seq
      return { id: String(typeof seq === 'number' ? seq : ''), role: 'start' }
    },
    start: (_context, match) => {
      const { event, location } = match as StartMatchLike
      return {
        ...injectedContextState(event as InjectedContextEventLike),
        location,
      }
    },
    // 注入是一事件一行的定局：后续 match（同一 Context 被重新打开）不改内容。
    update: context => (context as ContextLike).state,
    buildViewNode: (context) => {
      const candidate = context as ContextLike
      const state = candidate.state
      if (state === undefined) return null
      return {
        key: candidate.key,
        kind: CONTEXT_INJECTION_KIND,
        id: candidate.id,
        target: 'chat',
        anchorSeq: state.seq,
        location: state.location,
        visibility: 'visible',
        data: state,
      }
    },
  }
}
