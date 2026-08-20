/**
 * The plugin's General-settings row: a "节点外观" title with the standard
 * chevron, expanding to palette rows, tool overrides, and the Think
 * visibility switch. Reads the namespace scope through the injected hooks
 * face and writes through the injected actions; every change applies
 * immediately. Drawn by hand (no value import from ui-settings-plugins — the
 * client bundle purity gate forbids cross-plugin value imports), styled with
 * the DSH design tokens like the shipped Appearance row.
 */

import { useState, type ChangeEvent, type FormEvent } from 'react'
import type { SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  DEFAULT_COLORS, isCssColor, resolveColors, TOOL_CATEGORIES,
  type NodeAppearanceSettings, type NodeCategory,
} from './palette.ts'
import css from './card.module.css'

/** The row's inject face: the read-only scope snapshot plus write actions. */
export interface NodeAppearanceRowFace {
  hooks: {
    /** The bound settings-scope snapshot, rendered as useNodeAppearance. */
    nodeAppearance: {
      getSnapshot(): SettingsScopeSnapshot<NodeAppearanceSettings>
      subscribe(listener: () => void): () => void
    }
  }
  /** Write the Think visibility switch. */
  setShowThinking(show: boolean): void
  /** Merge one category color into the palette section. */
  setCategoryColor(category: NodeCategory, color: string): void
  /** Merge one tool override into the toolColors section. */
  setToolColor(tool: string, color: string): void
  /** Remove one tool override. */
  removeToolColor(tool: string): void
}

/** Props the renderer binds for this General row. */
export type NodeAppearanceRowProps =
  PropsRuntime<'settings.general.item'>
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

/**
 * Render the node-appearance General row.
 * @param props - the injected scope snapshot hook and write actions.
 * @returns the row, always visible once its namespace is served.
 */
export function NodeAppearanceRow({ useNodeAppearance, setShowThinking, setCategoryColor, setToolColor, removeToolColor }: NodeAppearanceRowProps) {
  const [open, setOpen] = useState(false)
  const [toolName, setToolName] = useState('')
  const [toolColor, setToolColorDraft] = useState('#64748b')
  const snapshot = useNodeAppearance(snapshot => snapshot)
  const colors = resolveColors(snapshot.value ?? {})
  const toolColors = snapshot.value?.toolColors ?? {}
  const showThinking = snapshot.value?.showThinking ?? true
  const disabled = snapshot.writable === false

  const addTool = (event: FormEvent) => {
    event.preventDefault()
    const name = toolName.trim()
    if (name === '' || !isCssColor(toolColor)) return
    setToolColor(name, toolColor)
    setToolName('')
  }

  return (
    <div className={css.group}>
      <button
        type="button"
        className={css.header}
        aria-expanded={open}
        onClick={() => { setOpen(!open) }}
      >
        <span className={css.title}>节点外观</span>
        <IconChevronDownOutline14 className={open ? css.chevronOpen : css.chevron} />
      </button>
      {open && (
        <div className={css.body}>
          {snapshot.status !== 'ready' && (
            <p className={css.statusLine}>
              {snapshot.status === 'unavailable'
                ? '配置暂不可用：插件主机侧未挂载或连接非本机。'
                : '配置加载中…'}
            </p>
          )}
          <div className={`${disabled ? css.disabled : ''}`}>
            <div className={css.row}>
              <label className={css.rowLabel} htmlFor="node-appearance-show-thinking">显示思考过程</label>
              <input
                id="node-appearance-show-thinking"
                className={css.checkbox}
                type="checkbox"
                checked={showThinking}
                onChange={(event: ChangeEvent<HTMLInputElement>) => { setShowThinking(event.target.checked) }}
              />
              <span className={css.rowHint}>关闭后会话中的 Think 思考行隐藏</span>
            </div>
            {(Object.keys(CATEGORY_LABELS) as NodeCategory[]).map(category => (
              <div className={css.row} key={category}>
                <label className={css.rowLabel} htmlFor={`node-appearance-color-${category}`}>
                  {CATEGORY_LABELS[category]}
                </label>
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
            <div className={css.sectionTitle}>工具颜色覆盖（可选）</div>
            {Object.entries(toolColors).map(([tool, color]) => (
              <div className={css.toolRow} key={tool}>
                <span className={css.toolName} title={tool}>{tool}</span>
                <input
                  className={css.colorInput}
                  type="color"
                  value={isCssColor(color) ? color : DEFAULT_COLORS.other}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => { setToolColor(tool, event.target.value) }}
                />
                <button type="button" className={css.removeButton} onClick={() => { removeToolColor(tool) }}>删除</button>
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
              <input
                className={css.colorInput}
                type="color"
                value={toolColor}
                onChange={(event: ChangeEvent<HTMLInputElement>) => { setToolColorDraft(event.target.value) }}
              />
              <button type="submit" className={css.addButton} disabled={toolName.trim() === ''}>添加</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
