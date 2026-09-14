/**
 * Browser half: binds the `node-appearance` settings scope, paints the chat
 * flow from it (a single <style data-plugin-css> tag rebuilt on every
 * snapshot change), and registers the settings card.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: the ctx.settingsScope Context merge and the slot's declaration.
// Cross-plugin collaboration goes through cordis services; a value import
// would fail the client bundle-purity gate.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
// Type-only: the ctx.slots Context merge comes from the renderer package
// (slot registry), not from the removed dsh-client-runtime module.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { buildCss, NODE_APPEARANCE_NS, STYLE_TAG_ID, type NodeAppearanceSettings } from './palette.ts'
import { NodeAppearanceRow, type NodeAppearanceRowFace } from './settings-card.tsx'
import { AskQuestionRow } from './ask-card.tsx'

export const inject = ['slots', 'connection', 'remote', 'settingsScope']

/** Upsert the plugin's paint stylesheet with the current snapshot's CSS. */
function paint(scope: SettingsScope<NodeAppearanceSettings>): void {
  let tag = document.querySelector<HTMLStyleElement>(`style[data-plugin-css="${STYLE_TAG_ID}"]`)
  if (tag === null) {
    tag = document.createElement('style')
    tag.dataset.plugin = NODE_APPEARANCE_NS
    tag.dataset.pluginCss = STYLE_TAG_ID
    document.head.appendChild(tag)
  }
  tag.textContent = buildCss(scope.getSnapshot().value)
}

/**
 * Mount the node-appearance plugin on the page.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  // settingsScope 由官方 ui-settings 服务提供（DSH 0.1.2-alpha 内核 client
  // 模块表）；bind 返回该命名空间的强类型 scope（read/set/unset/subscribe）。
  const scope = ctx.settingsScope.bind<NodeAppearanceSettings>({ namespace: NODE_APPEARANCE_NS })
  // Paint once from the current snapshot (defaults before the first Host read).
  paint(scope)
  ctx.effect(
    () => scope.subscribe(() => { paint(scope) }),
    'dsh-node-appearance: repaint on settings change',
  )

  const face: NodeAppearanceRowFace = {
    hooks: { nodeAppearance: scope },
    // Staged-edit save: write the three keys in one face call (Host settles
    // the whole namespace; per-key resolution keeps observable semantics).
    apply: async (value) => {
      await scope.set('showThinking', value.showThinking ?? true)
      await scope.set('colors', value.colors ?? {})
      await scope.set('toolColors', value.toolColors ?? {})
    },
    setShowThinking: (show) => { void scope.set('showThinking', show) },
    setCategoryColor: (category, color) => {
      const value = scope.getSnapshot().value
      void scope.set('colors', { ...value?.colors, [category]: color })
    },
    setToolColor: (tool, color) => {
      const value = scope.getSnapshot().value
      void scope.set('toolColors', { ...value?.toolColors, [tool]: color })
    },
    removeToolColor: (tool) => {
      const value = scope.getSnapshot().value
      const toolColors = { ...value?.toolColors }
      delete toolColors[tool]
      void scope.set('toolColors', toolColors)
    },
  }

  // alpha.2：General 区 slot（settings.general.item）已退役，接入官方
  // 「可配置插件」Tab 的 settings.plugin.item（keyed by namespace）——官方
  // 卡片姿势见 dsh-client-ui-settings-plugins/src/client/index.ts（BashCard 等）。
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: NODE_APPEARANCE_NS,
    inject: () => face,
    // npm ui-slots (0.0.1-rc.1) 类型未合并 keyed-slot 选项（官方 monorepo 类型
    // 才有）——运行时与官方源码一致，类型期放宽（官方类型同步后收紧）。
  } as never, NodeAppearanceRow))

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
}
