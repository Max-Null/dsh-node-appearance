/**
 * Browser half: binds the `node-appearance` settings scope, paints the chat
 * flow from it (a single <style data-plugin-css> tag rebuilt on every
 * snapshot change), and registers the settings card.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: the ctx.settingsScope Context merge and the slot's declaration.
// Cross-plugin collaboration goes through cordis services; a value import
// would fail the client bundle-purity gate.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
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

  // The General settings section stacks preference rows (locale → Language,
  // ui-theme → Appearance, dsh-skin → Skins). Node appearance is the same
  // kind of visual preference, so it registers here beside them.
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: NODE_APPEARANCE_NS,
    order: 30,
    inject: () => face,
  }, NodeAppearanceRow))
}
