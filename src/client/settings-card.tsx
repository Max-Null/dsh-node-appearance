/**
 * The node-appearance plugin config card. Mirrors the official
 * `settings.plugin.item` card chrome (PluginCard: card shell, name-over-
 * description header, unsaved pill, chevron disclosure, save/discard footer)
 * with the DSH design tokens — drawn by hand because a feature plugin must
 * not runtime-import another feature plugin's values (bundle purity gate).
 *
 * Edits are staged locally (a draft over the served snapshot) and written by
 * one `apply` call on save; a collapsed card carries the unsaved pill, and a
 * refused write keeps its diagnostics visible.
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
  /** Persist the staged value (one batched write; resolves on Host settlement). */
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

/** The card copy (staged-edit chrome, one locale). */
const COPY = {
  title: '节点外观',
  description: '消息节点外观与颜色的偏好设置',
  unsaved: '未保存',
  saving: '保存中…',
  save: '保存',
  discard: '放弃修改',
  readOnly: '配置只读：插件主机侧未挂载或连接非本机。',
  saveFailed: '保存失败：配置被拒绝或写入冲突。',
  loading: '配置加载中…',
  showThinking: '显示思考过程',
  showThinkingHint: '关闭后会话中的 Think 思考行隐藏',
  toolColors: '工具颜色覆盖（可选）',
  addTool: '添加',
  removeTool: '删除',
}

/**
 * Render the node-appearance config card.
 * @param props - the injected scope snapshot hook, its write actions.
 * @returns the card, matching the official plugin-card chrome.
 */
export function NodeAppearanceRow({ useNodeAppearance, apply, setShowThinking, setCategoryColor, setToolColor, removeToolColor }: NodeAppearanceRowProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<NodeAppearanceSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [toolName, setToolName] = useState('')
  const [toolColor, setToolColorDraft] = useState('#64748b')
  const snapshot = useNodeAppearance(snapshot => snapshot)
  const served = snapshot.value ?? {}
  const colors = resolveColors(draft ?? served)
  const toolColors = draft?.toolColors ?? served.toolColors ?? {}
  const showThinking = draft?.showThinking ?? served.showThinking ?? true
  const disabled = snapshot.writable === false
  const dirty = draft !== null
  const unavailable = snapshot.status !== 'ready'

  /** Stage one edit: materialize the draft over the served value, then patch. */
  const stage = (patch: Partial<NodeAppearanceSettings>): void => {
    setDraft(current => ({ ...(current ?? served), ...patch }))
  }

  const stageShowThinking = (next: boolean): void => { stage({ showThinking: next }) }
  const stageCategoryColor = (category: NodeCategory, color: string): void => {
    // colors is a partial record; staged merge over the served/draft palette.
    stage({ colors: { ...(draft?.colors ?? served.colors ?? {}), [category]: color } })
  }
  const stageToolColor = (tool: string, color: string): void => {
    stage({ toolColors: { ...toolColors, [tool]: color } })
  }
  const stageRemoveToolColor = (tool: string): void => {
    const next = { ...toolColors }
    delete next[tool]
    stage({ toolColors: next })
  }

  const save = async (): Promise<void> => {
    if (draft === null || saving) return
    setSaving(true)
    setSaveFailed(false)
    try {
      await apply(draft)
      setDraft(null)
    } catch {
      setSaveFailed(true)
    } finally {
      setSaving(false)
    }
  }

  const discard = (): void => {
    setDraft(null)
    setSaveFailed(false)
  }

  const addTool = (event: FormEvent): void => {
    event.preventDefault()
    const name = toolName.trim()
    if (name === '' || !isCssColor(toolColor)) return
    stageToolColor(name, toolColor)
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
        {dirty ? <span className={css.pending}>{COPY.unsaved}</span> : null}
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
                onClick={() => { stageShowThinking(!showThinking) }}
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
                  onChange={(event: ChangeEvent<HTMLInputElement>) => { stageCategoryColor(category, event.target.value) }}
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
                  onChange={(event: ChangeEvent<HTMLInputElement>) => { stageToolColor(tool, event.target.value) }}
                />
                <button type="button" className={css.removeButton} onClick={() => { stageRemoveToolColor(tool) }}>{COPY.removeTool}</button>
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
            {saveFailed ? <p className={css.failed} role="status">{COPY.saveFailed}</p> : null}
            <button
              type="button"
              className={css.discard}
              disabled={!dirty || saving}
              onClick={discard}
            >{COPY.discard}</button>
            <button
              type="button"
              className={css.save}
              disabled={!dirty || saving}
              onClick={() => { void save() }}
            >{saving ? COPY.saving : COPY.save}</button>
          </div>
        </div>
      )}
    </li>
  )
}
