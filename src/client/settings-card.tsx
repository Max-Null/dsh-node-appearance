/**
 * The node-appearance plugin config card. Mirrors the official
 * `settings.plugin.item` card chrome (PluginCard: card shell, name-over-
 * description header, chevron disclosure) with the DSH design tokens —
 * drawn by hand because a feature plugin must not runtime-import another
 * feature plugin's values (bundle purity gate).
 *
 * Writes are immediate: picking a color or flipping the Think switch applies
 * it right away (a palette is a live preview, not a staged form). The footer
 * carries one「恢复初始设置」button that resets the whole namespace to the
 * shipped defaults — two-click confirmation so a miss cannot wipe a custom
 * palette.
 */

import { useState, type ChangeEvent, type FormEvent } from 'react'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import { IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  DEFAULT_COLORS, isCssColor, resolveColors, TOOL_CATEGORIES,
  type NodeAppearanceSettings, type NodeCategory,
} from './palette.ts'
import css from './card.module.css'

/** The card's inject face: the read-only scope snapshot plus write actions. */
export interface NodeAppearanceRowFace {
  hooks: {
    /** The bound settings-scope snapshot, rendered as useNodeAppearance. */
    nodeAppearance: ObservableSnapshot<SettingsScopeSnapshot<NodeAppearanceSettings>>
  }
  /** Persist one full value (reset-to-defaults path; resolves on Host settlement). */
  apply(value: NodeAppearanceSettings): Promise<void>
  /** Write the Think visibility switch. */
  setShowThinking(show: boolean): void
  /** Merge one category color into the palette section. */
  setCategoryColor(category: NodeCategory, color: string): void
  /** Merge one tool override into the toolColors section. */
  setToolColor(tool: string, color: string): void
  /** Remove one tool override. */
  removeToolColor(tool: string): void
}

/** Props the renderer binds for this plugin config card. */
export type NodeAppearanceRowProps =
  PropsRuntime<'settings.plugin.item'>
  & InjectFace<NodeAppearanceRowFace>

/** Chinese labels per category (product copy is Chinese). */
const CATEGORY_LABELS: Record<NodeCategory, string> = {
  search: '联网搜索',
  agent: '智能体调用',
  execute: '代码 / 指令执行',
  file: '文件操作',
  task: '任务 / 目标',
  command: '指令节点',
  thinking: '思考过程',
  context: '上下文注入',
  steering: '模型引导',
  other: '其他工具',
}

/** Tools shown in the add-override autocomplete-free text input placeholder. */
const TOOL_SUGGESTIONS = Object.values(TOOL_CATEGORIES).flat().join('、')

/** The card copy (one locale). */
const COPY = {
  title: '节点外观',
  description: '消息节点外观与颜色的偏好设置',
  reset: '恢复初始设置',
  resetConfirm: '再次点击确认恢复',
  resetting: '恢复中…',
  readOnly: '配置只读：插件主机侧未挂载或连接非本机。',
  loading: '配置加载中…',
  showThinking: '显示思考过程',
  showThinkingHint: '关闭后会话中的 Think 思考行隐藏',
  toolColors: '工具颜色覆盖（可选）',
  addTool: '添加',
  removeTool: '删除',
}

/** The shipped defaults, one face call away from any custom palette. */
const INITIAL_SETTINGS: NodeAppearanceSettings = {
  showThinking: true,
  colors: DEFAULT_COLORS,
  toolColors: {},
}

/**
 * Render the node-appearance config card.
 * @param props - the injected scope snapshot hook, its write actions.
 * @returns the card, matching the official plugin-card chrome.
 */
export function NodeAppearanceRow({ useNodeAppearance, apply, setShowThinking, setCategoryColor, setToolColor, removeToolColor }: NodeAppearanceRowProps) {
  const [open, setOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [toolName, setToolName] = useState('')
  const [toolColor, setToolColorDraft] = useState('#64748b')
  const snapshot = useNodeAppearance(snapshot => snapshot)
  const served = snapshot.value ?? {}
  const colors = resolveColors(served)
  const toolColors = served.toolColors ?? {}
  const showThinking = served.showThinking ?? true
  const disabled = snapshot.writable === false
  const unavailable = snapshot.status !== 'ready'

  const resetInitial = async (): Promise<void> => {
    if (resetting) return
    setResetting(true)
    try {
      await apply(INITIAL_SETTINGS)
      setConfirmReset(false)
    } catch {
      // A refused reset just leaves the current palette in place.
    } finally {
      setResetting(false)
    }
  }

  const handleReset = (): void => {
    if (confirmReset) {
      void resetInitial()
    } else {
      setConfirmReset(true)
    }
  }

  const addTool = (event: FormEvent): void => {
    event.preventDefault()
    const name = toolName.trim()
    if (name === '' || !isCssColor(toolColor)) return
    setToolColor(name, toolColor)
    setToolName('')
  }

  return (
    <li className={css.card + (open ? ' ' + css.cardOpen : '')}>
      <button
        type="button"
        className={css.header}
        aria-expanded={open}
        aria-label={`${open ? '收起' : '展开'}：${COPY.title}`}
        onClick={() => { setOpen(!open) }}
      >
        <span className={css.headText}>
          <span className={css.name}>{COPY.title}</span>
          <span className={css.description}>{COPY.description}</span>
        </span>
        <IconChevronDownOutline14 className={css.chevron + (open ? ' ' + css.chevronOpen : '')} />
      </button>
      {open && (
        <div className={css.body}>
          {unavailable && !disabled && <p className={css.statusLine}>{COPY.loading}</p>}
          {disabled && <p className={css.readOnly} role="status">{COPY.readOnly}</p>}
          <div className={disabled ? css.disabled : ''}>
            <div className={css.row}>
              <label className={css.rowLabel} htmlFor="node-appearance-show-thinking">{COPY.showThinking}</label>
              <span className={css.rowHint}>{COPY.showThinkingHint}</span>
              <button
                id="node-appearance-show-thinking"
                className={css.switch + (showThinking ? ' ' + css.on : '')}
                type="button"
                aria-pressed={showThinking}
                onClick={() => { setShowThinking(!showThinking) }}
              >
                <span className={css.knob} />
              </button>
            </div>
            {(Object.keys(CATEGORY_LABELS) as NodeCategory[]).map(category => (
              <div className={css.row} key={category}>
                <label className={css.rowLabel} htmlFor={`node-appearance-color-${category}`}>{CATEGORY_LABELS[category]}</label>
                <input
                  id={`node-appearance-color-${category}`}
                  className={css.colorInput}
                  type="color"
                  value={colors[category]}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => { setCategoryColor(category, event.target.value) }}
                />
                <span className={css.colorValue}>{colors[category]}</span>
              </div>
            ))}
            <div className={css.sectionTitle}>{COPY.toolColors}</div>
            {Object.entries(toolColors).map(([tool, color]) => (
              <div className={css.row} key={tool}>
                <span className={css.toolName} title={tool}>{tool}</span>
                <input
                  className={css.colorInput}
                  type="color"
                  value={isCssColor(color) ? color : DEFAULT_COLORS.other}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => { setToolColor(tool, event.target.value) }}
                />
                <button type="button" className={css.removeButton} onClick={() => { removeToolColor(tool) }}>{COPY.removeTool}</button>
              </div>
            ))}
            <form className={css.addRow} onSubmit={addTool}>
              <input
                className={css.toolInput}
                type="text"
                placeholder={`工具名，如 ${TOOL_SUGGESTIONS}`}
                value={toolName}
                onChange={(event: ChangeEvent<HTMLInputElement>) => { setToolName(event.target.value) }}
              />
              <input className={css.colorInput} type="color" value={toolColor} onChange={(event: ChangeEvent<HTMLInputElement>) => { setToolColorDraft(event.target.value) }} />
              <button type="submit" className={css.addButton} disabled={toolName.trim() === ''}>{COPY.addTool}</button>
            </form>
          </div>
          <div className={css.footer}>
            <button
              type="button"
              className={css.reset + (confirmReset ? ' ' + css.resetConfirm : '')}
              disabled={resetting}
              onClick={handleReset}
            >{resetting ? COPY.resetting : confirmReset ? COPY.resetConfirm : COPY.reset}</button>
          </div>
        </div>
      )}
    </li>
  )
}
