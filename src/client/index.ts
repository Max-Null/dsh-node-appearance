/**
 * Browser half: binds the `node-appearance` settings scope, paints the chat
 * flow from it (a single <style data-plugin-css> tag rebuilt on every
 * snapshot change), and registers the settings card.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: the `ctx.configForms` Context merge, plus the Plugins page's SlotMap
// merge (the `plugins.bundle.config` entry). Cross-plugin collaboration goes through
// cordis services; a value import would fail the client bundle-purity gate.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
// Type-only: the ctx.slots Context merge comes from the renderer package
// (slot registry), not from the removed dsh-client-runtime module.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { buildCss, NODE_APPEARANCE_NS, STYLE_TAG_ID, type NodeAppearanceSettings } from './palette.ts'
import { NodeAppearanceRow, type NodeAppearanceRowFace } from './settings-card.tsx'
import { AskQuestionRow } from './ask-card.tsx'
import { DeliverableRow } from './deliverable-row.tsx'
import { GoalDetail } from './goal-detail.tsx'
import { TriggerCard } from './trigger-card.tsx'
import { CONTEXT_INJECTION_KIND, contextInjectionDefinition } from './context-injection.ts'
import { ContextInjectionCard } from './context-injection-card.tsx'
import { SkillRow } from './skill-row.tsx'

export const inject = ['slots', 'connection', 'remote', 'configForms']

/** Upsert the plugin's paint stylesheet with the current snapshot's CSS. */
function paint(form: ConfigForm<NodeAppearanceSettings>): void {
  let tag = document.querySelector<HTMLStyleElement>(`style[data-plugin-css="${STYLE_TAG_ID}"]`)
  if (tag === null) {
    tag = document.createElement('style')
    tag.dataset.plugin = NODE_APPEARANCE_NS
    tag.dataset.pluginCss = STYLE_TAG_ID
    document.head.appendChild(tag)
  }
  tag.textContent = buildCss(form.getSnapshot().value)
}

/**
 * Mount the node-appearance plugin on the page.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  // 0.1.7：`settingsScope` 已从 client 服务面移除（`settingsScope` 在 client 包里
  // 0 命中），取而代之的是官方 ui-settings 提供的 `configForms`。`configForms.get(ns)`
  // 返回的 `ConfigForm<T>` 与旧的 scope 面几乎同形——`getSnapshot()` / `subscribe()` /
  // `set(field, value)` 同名同义，额外提供 `mutate(ops, rev)` 与 `unset(field)`。
  // 参数 ns 是 Host 插件的 entry id（`ConfigForms.get` 的 JSDoc：Unique Host plugin
  // entry id），与本插件的 `cordis.patch.yml` 行 id（`node-appearance`）同值。
  const form = ctx.configForms.get<NodeAppearanceSettings>(NODE_APPEARANCE_NS)
  // Paint once from the current snapshot (defaults before the first Host read).
  paint(form)
  ctx.effect(
    () => form.subscribe(() => { paint(form) }),
    'dsh-node-appearance: repaint on settings change',
  )

  const face: NodeAppearanceRowFace = {
    hooks: { nodeAppearance: form },
    // Staged-edit save: write the three keys in one write.
    //
    // `colors` / `toolColors` 是**对象**字段，不能走 `set(field, value)`——它的
    // JSDoc 写明只接受 scalar field。改用 `mutate()` 的路径操作：`SettingsPathOpView`
    // 是 `{ op: 'set'; path: string[]; value }`，其注释说明写入会「creating
    // intermediate objects」，所以 `['colors']` 整个子树可以一次写掉。
    apply: async (value) => {
      await form.mutate([
        { op: 'set', path: ['showThinking'], value: value.showThinking ?? true },
        { op: 'set', path: ['colors'], value: value.colors ?? {} },
        { op: 'set', path: ['toolColors'], value: value.toolColors ?? {} },
      ] as never)
    },
    setShowThinking: (show) => { void form.set('showThinking', show) },
    setShowContextInjection: (show) => { void form.set('showContextInjection', show) },
    setCategoryColor: (category, color) => {
      const value = form.getSnapshot().value
      void form.mutate([
        { op: 'set', path: ['colors'], value: { ...value?.colors, [category]: color } },
      ] as never)
    },
    setToolColor: (tool, color) => {
      const value = form.getSnapshot().value
      void form.mutate([
        { op: 'set', path: ['toolColors'], value: { ...value?.toolColors, [tool]: color } },
      ] as never)
    },
    removeToolColor: (tool) => {
      const value = form.getSnapshot().value
      const toolColors = { ...value?.toolColors }
      delete toolColors[tool]
      void form.mutate([{ op: 'set', path: ['toolColors'], value: toolColors }] as never)
    },
  }

  // 0.1.7：卡片挂到 Plugins 页的 `plugins.bundle.config`（旧 `settings.plugin.item`
  // 已不存在——它在 client 包里 0 命中，且替代者 `plugins.item` 按契约注释是
  // 「OCCUPIED by the official settings pages」的官方专区，第三方不该占）。
  // 本插件的 package.json 声明了 `dsh.bundle.patch`，因此它自身就是一个 bundle，
  // key 用**包名**（`config-ledger.ts` 的 `keysOf('plugins.bundle.config')` 直接取
  // `entry.options.key`，而 `plugins.row.config` 才用 `包名#行id`）。
  // 该槽只渲染 `view: 'page'`，卡片在 summary 下返回 null（见 settings-card.tsx）。
  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config',
    key: '@max-null/dsh-node-appearance',
    inject: () => face,
  }, NodeAppearanceRow))

  // 接管官方提问卡。官方 ui-tool 在 `tool.call.toolview` 的
  // `ask_user_question` key 上有一条 priority 0 的注册，而 keyed cell 只
  // 渲染最低 priority 的条目（ui-slots `register()` 的 shadowing 规则），
  // priority -1 因此遮蔽它——这是 DSH 支持的接管姿势（ui-tool 的 slot 契约
  // 原文：a key the shipped composition already covers is replaced, not shared）。
  //
  // 接管的唯一原因：官方转录卡只保留已选答案，把调用参数里的 `options`
  // 丢掉了，提问一旦结算就再也看不到当时有哪些选项（详见 ask-model.ts）。
  //
  // 类型期放宽同 settings 那条：`tool.call.toolview` 的 SlotMap 声明属于官方
  // @deepseek-ai/dsh-client-ui-tool，本插件不为此引入依赖。
  ctx.slots.inject('tool.call.toolview' as never, () => ctx.slots.register({
    name: 'tool.call.toolview',
    key: 'ask_user_question',
    priority: -1,
    // 复用官方 conversation 字典：卡片文案（提问 / N/M 已回答 / 未回答 /
    // 查看 …）全部取自它，插件不新造 locale 命名空间。
    locale: 'conversation',
  } as never, AskQuestionRow as never))

  // 接管官方交付行。姿势与理由同提问卡：ui-deliverables 在 `tool.call.toolview`
  // 的 `present` key 上有一条 priority 0 的注册，keyed cell 只渲染最低 priority
  // 的条目，priority -1 因此遮蔽它。
  //
  // 接管的唯一原因：官方折叠态把全部文件名逗号拼成一行，多文件时读不完，也看不出
  // 这一轮交付了几个（详见 deliverable-row.tsx）。
  ctx.slots.inject('tool.call.toolview' as never, () => ctx.slots.register({
    name: 'tool.call.toolview',
    key: 'present',
    priority: -1,
    // 复用官方 deliverables 字典：「交付文件 / 正在交付 / 已交付 / 交付失败 /
    // 已中断 / 查看调用」全部取自它，插件不新造 locale 命名空间。
    locale: 'deliverables',
  } as never, DeliverableRow as never))

  // 接管官方技能行。姿势与理由同交付行：ui-skill 在 `tool.call.toolview` 的
  // `skill` key 上有一条 priority 0 的注册，keyed cell 只渲染最低 priority 的条目，
  // priority -1 因此遮蔽它。
  //
  // 接管的唯一原因：官方展开体把 `renderSkillContent` 的规范块整段铺进 `<pre>`
  // —— `<skill_content>` 套 `<skill_resources>` 再套 `<skill_instructions>`，
  // 那层 XML 壳对人不构成信息，却把技能正文夹在中间（详见 skill-row.tsx）。
  ctx.slots.inject('tool.call.toolview' as never, () => ctx.slots.register({
    name: 'tool.call.toolview',
    key: 'skill',
    priority: -1,
    // 复用官方 skill 字典：「加载技能 / 正在加载 skill / 准备加载技能 /
    // skill 加载失败 / skill 加载已中止 / 说明 / 查看」全部取自它，
    // 插件不新造 locale 命名空间（「资源」一节是本插件自有的直写中文）。
    locale: 'skill',
  } as never, SkillRow as never))

  // 目标详情折叠条：挂进输入框上方的 `conversation.input.dock`（list 槽，
  // 不同 id 各自成格、并列渲染），order 11 紧随官方 ui-goal 的 order 10 ——
  // 官方条只显示一行被 ellipsis 截断的目标，这里补一个可展开的详情。
  //
  // 只读 `useProjection('goal')`，不碰官方条的 edit/pause/resume/clear ——
  // 那四个 Remote 动词与 activation 订阅源都是 ui-goal 的注册者私有注入面，
  // 接管它们等于在本插件里再养一套会写会话数据的 RPC 客户端。
  ctx.slots.inject('conversation.input.dock' as never, () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'max-null/goal-detail',
    order: 11,
  } as never, GoalDetail as never))

  // 接管官方触发通知卡（「继续执行目标」那一类）。姿势同前两处：keyed cell 只
  // 渲染最低 priority 的条目，priority -1 因此遮蔽官方的 TurnTriggerNodeView。
  //
  // 接管的唯一原因：官方展开体把模型提示词原文（`<goal_round>` / `Objective:`
  // / `Round:` / JSON 转义）连同骨架一起显示，而骨架对人不构成信息却占满版面
  // （详见 trigger-card.tsx）。折叠头另加轮次徽标，收起态即可读到走到第几轮。
  //
  // 注意遮蔽是**全 key** 的：全部触发来源（goal / schedule / webhook / job …）
  // 都会走本插件组件，所以 trigger-model.ts 逐条复刻了官方的 kind → 标题/图标
  // 映射，非目标轮次的来源按官方同构渲染。
  //
  // 类型期放宽同前两处：`conversation.chat.node` 的 SlotMap 声明属于官方
  // @deepseek-ai/dsh-client-ui-chat，本插件不为此引入依赖。
  ctx.slots.inject('conversation.chat.node' as never, () => ctx.slots.register({
    name: 'conversation.chat.node',
    key: 'turn-trigger',
    priority: -1,
    // 复用官方 chat 字典：标题（message.trigger.*）、说明
    // （message.trigger.explanation）、时间模板（clock.md / clock.ymd）全部取自
    // 它，插件不新造 locale 命名空间。
    locale: 'chat',
  } as never, TriggerCard as never))

  // 恢复被 0.2.0 滤掉的上下文注入行。
  //
  // 这里**不是接管**：ui-chat 的 `isVisibleChatNode()` 按 kind 排除 `context`，
  // 官方那条节点根本走不到渲染（slot 分发轮不到它），遮蔽同一个 key 没有意义。
  // 改为注册一条**自有 kind** 的 Definition 去接住同一批 `user/message`，再在
  // 同一个 slot 上以该 kind 注册渲染器——`ChatNodeDataMap` 是 merge-extensible
  // 的（注释原文即「业务模块贡献的渲染 kind」），这是官方留的口子。
  //
  // 走 `uiConversation` 服务而不是插件级 `inject` 声明它：服务缺席时只让这一个
  // 功能不生效，不该把整个插件拖成 pending —— 配色与其余卡片不必陪着消失。
  // 类型期放宽同前几处：`ConversationNodeDefinition` 与 `uiConversation` 的
  // Context 增强属于官方 @deepseek-ai/dsh-client-ui-conversation，本插件不为此
  // 引入依赖。
  const serviceContext = ctx as unknown as {
    inject(names: readonly string[], callback: (scoped: ClientContext) => void): unknown
  }
  serviceContext.inject(['uiConversation'], (scoped) => {
    const conversation = (scoped as unknown as {
      uiConversation: { events: { register(definition: unknown): () => void } }
    }).uiConversation
    scoped.effect(
      () => conversation.events.register(contextInjectionDefinition()),
      'dsh-node-appearance: restore injected-context rows',
    )
  })

  ctx.slots.inject('conversation.chat.node' as never, () => ctx.slots.register({
    name: 'conversation.chat.node',
    key: CONTEXT_INJECTION_KIND,
    // 复用官方 chat 字典：`message.contextInjection` / `message.contextRecall`
    // 两条文案都还在里面（0.2.0 只是不用它们画行了，key 没删）。
    locale: 'chat',
  } as never, ContextInjectionCard as never))
}
