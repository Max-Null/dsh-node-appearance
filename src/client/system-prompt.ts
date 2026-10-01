/**
 * 系统提示词行：把 0.2.0 起被 ui-chat 滤掉的「系统提示词」卡片画回来。
 *
 * 与上下文注入行同一处境、不同来源：`isVisibleChatNode()` 同时排除
 * `kind === 'system-prompt'`，而官方那两张卡（`system-message` 与 `request-prompt`
 * 两条 Definition）**仍在生成，只是不再渲染**——所以遮蔽同一个 key 同样没有意义，
 * 走的是与注入行一样的路子：注册自有 kind 接住同一批事件，再以该 kind 注册渲染器。
 *
 * **只接管 `system-message` 这一半。** 它 match `system/message` 的 append，在系统
 * 提示词**发生变化**时产出一张卡：首轮一张（用户说的「会话发起时的系统提示词注入」
 * 就是它），之后每次内容变化各一张，第二次起标 `update`。`request-prompt` 那半
 * （每次请求 header 决定要不要再显示一次，覆盖 resume / 显式新系列）不做 —— 它要
 * 复刻 `shownByUpdate` 与 `stableRequestPromptAnchor` 那套与 system-message 协作的
 * 位置状态机，而它带来的增量只是「没变的时候也补一张」。
 *
 * 状态推导**不自己实现**：`uiConversation` 把官方的 `inspectSystemPrompt` 暴露成了
 * 服务方法（`assembly.ts:300`），插件直接调它 —— 表面位置、替换区间与 `update` 判定
 * 全由官方逻辑负责，我们只负责画。这也是为什么本文件没有「纯函数模型层」：
 * 该算的东西官方已经算好了。
 */

/** 本插件为恢复系统提示词卡而注册的渲染 kind（同时是 slot 分发的 key）。 */
export const SYSTEM_PROMPT_KIND = 'system-prompt-notice'

/** 官方 `inspectSystemPrompt` 的鸭子类型签名（不为此引入 ui-conversation 依赖）。 */
export type SystemPromptInspect = (previous: unknown, event: unknown) => unknown

/** 卡片的渲染数据。 */
export interface SystemPromptData {
  /** 该次 `system/message` 的文本。 */
  readonly text: string
  /** 是否是一次「内容变化」而非首轮引入。 */
  readonly update: boolean
}

/** Definition 上本文件用到的字段；其余由引擎拥有。 */
export interface SystemPromptDefinition {
  readonly kind: string
  readonly target: string
  match(event: unknown): { readonly id: string; readonly role: 'start' } | null
  start(context: unknown, match: unknown, reader: unknown): unknown
  update(context: unknown): unknown
  buildViewNode(context: unknown): unknown | null
}

/** 引擎组装出的 Context 上本文件读取的字段。 */
interface ContextLike {
  readonly key: string
  readonly id: string
  readonly state: unknown
}

/** 引擎随 match 递进来的位置信息。 */
interface StartMatchLike {
  readonly event: { readonly seq?: unknown }
  readonly location: unknown
}

/** 官方 `SystemPromptState` 上本文件读取的字段。 */
interface PromptStateLike {
  readonly introduced?: { readonly seq: number, readonly text: string, readonly update: boolean } | undefined
}

/**
 * 构造恢复系统提示词卡的 Definition。
 * @param inspect - `uiConversation.inspectSystemPrompt`（官方状态推导）。
 * @returns 注册到 `ctx.uiConversation.events` 的 Definition。
 */
export function systemPromptDefinition(inspect: SystemPromptInspect): SystemPromptDefinition {
  return {
    kind: SYSTEM_PROMPT_KIND,
    target: 'chat',
    match: (event) => {
      const record = event as { type?: unknown, surfaceOp?: unknown } | null
      if (record === null || record.type !== 'system/message') return null
      // 只认 append：替换副本是模型可见面的事，人类转录要的是它自己的落点。
      if (record.surfaceOp !== 'append') return null
      const seq = (record as { seq?: unknown }).seq
      return { id: String(typeof seq === 'number' ? seq : ''), role: 'start' }
    },
    start: (context, match, reader) => {
      const { event } = match as StartMatchLike
      // 跨事件累积的表面事实只有官方那份推导知道怎么算（位置、替换区间、update），
      // 所以状态一律向它要 —— previous 取自**本 kind 自己的**前驱 Context，
      // 与官方 Definition 各留各的一份，互不干扰。
      const previous = (reader as {
        previous(kind: string): { state?: unknown } | undefined
      }).previous(SYSTEM_PROMPT_KIND)?.state
      void context
      return inspect(previous, event)
    },
    update: context => (context as ContextLike).state,
    buildViewNode: (context) => {
      const candidate = context as ContextLike
      const state = candidate.state as PromptStateLike | undefined
      const introduced = state?.introduced
      // 文本为空的历史卡是休眠节点，官方同样不画（`state.text === ''` 时返回 null）。
      if (introduced === undefined || introduced.text === '') return null
      const match = (candidate as unknown as { start?: StartMatchLike }).start
      return {
        key: candidate.key,
        kind: SYSTEM_PROMPT_KIND,
        id: candidate.id,
        target: 'chat',
        // 官方首卡把锚点挪到该 step 的开头（`requestPromptAnchor`）；那条路径属于
        // request-prompt 半边，这里不做。`system/message` 本身就写在轮次开头，
        // 直接用它的 seq 即是自然位置。
        anchorSeq: introduced.seq,
        location: match?.location ?? { kind: 'unresolved' },
        visibility: 'visible',
        data: { text: introduced.text, update: introduced.update === true } satisfies SystemPromptData,
      }
    },
  }
}
