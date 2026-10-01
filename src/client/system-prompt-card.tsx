/**
 * 系统提示词卡：把 0.2.0 起被 ui-chat 滤掉的「系统提示词」行画回来。
 *
 * 形态**逐项照官方 `SystemPromptRow`**：同一个 `DisclosureRow`、同一个
 * `IconBrowseOutlineRegular` 图标、同一对文案 key（`message.systemPrompt` /
 * `message.systemPromptUpdate`），展开体同样保留 `data-system-prompt-body` 锚点。
 *
 * 与注入行不同，这里**不做改造** —— 官方的呈现本来就是对的（纯文本 + 真实换行，
 * 不渲染 markdown），缺的只是「它不再显示」这一件事。所以本文件存在的唯一理由是
 * 把行接回来，而不是重塑它。
 *
 * 样式表复用 `context-injection-card.module.css`，与官方复用
 * `ContextInjectionRow.module.css` 是同一个做法：两张折叠行本就该长成一个样子。
 */
import { useState } from 'react'
import { DisclosureRow, IconBrowseOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SystemPromptData } from './system-prompt.ts'
import type { TriggerTranslate } from './trigger-model.ts'
import css from './context-injection-card.module.css'

/** 本卡从 slot owner 收到的字段。 */
export interface SystemPromptCardProps {
  /** 本插件 definition 产出的节点；渲染字段在 `node.data`。 */
  node: { data: SystemPromptData }
  /** 注册时声明 `chat` 命名空间后由 seat 注入的翻译席位。 */
  t: TriggerTranslate
}

/**
 * 渲染一张完整的系统提示词卡。
 * @param props - 提示词文本、是否「更新」与翻译席位。
 * @returns 折叠行；展开体是提示词原文。
 */
export function SystemPromptCard({ node, t }: SystemPromptCardProps) {
  const [open, setOpen] = useState(false)
  const data = node.data
  return (
    <DisclosureRow
      className={css.root}
      icon={<IconBrowseOutlineRegular size={14} />}
      chevronClassName={css.chevron}
      title={t(data.update ? 'message.systemPromptUpdate' : 'message.systemPrompt')}
      open={open}
      expandable
      expandOnRowClick
      onToggle={() => { setOpen(value => !value) }}
    >
      {/* 锚点与官方同名：样式规则与快照都按它匹配。 */}
      <div className={css.body} data-system-prompt-body>
        {/* 不渲染 markdown，与官方 `OpaqueBody` 同口径：提示词是给模型的原始文本，
            它的换行与缩进本身就是信息。 */}
        <pre className={css.text}>{data.text}</pre>
      </div>
    </DisclosureRow>
  )
}
