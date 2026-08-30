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
}
