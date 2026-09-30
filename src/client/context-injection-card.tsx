/**
 * 上下文注入行：把 0.2.0 起被 ui-chat 滤掉的注入行画回来。
 *
 * 形态逐项对齐官方 `ContextInjectionRow`（同一张 `DisclosureRow`、同一套
 * 折叠交互、同一个 `message.contextInjection` 文案），因为这里要的正是
 * 「看起来跟以前一样」；本组件只多一个 `data-context-injection-body` 之外的
 * 锚点，供插件自己的配色规则命中。
 *
 * 展开体走插件既有的 `contentRuns`：文本按真实换行显示，不认识的块交给
 * `JsonBlock` 而不是吞掉。官方按 `form`（instructions / catalog / snapshot …）
 * 做结构化渲染，本组件暂不跟进——内容本体在 `content` 里，不丢信息。
 */

import { useState } from 'react'
import {
  DisclosureRow, IconContextInjectionOutlineRegular, JsonBlock,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { contentRuns, type TriggerTranslate } from './trigger-model.ts'
import type { InjectedContextState } from './context-injection-model.ts'
import css from './context-injection-card.module.css'

/** 本卡从 slot owner 收到的字段。 */
export interface ContextInjectionCardProps {
  /** 本插件 definition 产出的节点；渲染字段在 `node.data`。 */
  node: { data: InjectedContextState }
  /** 注册时声明 `chat` 命名空间后由 seat 注入的翻译席位。 */
  t: TriggerTranslate
}

/**
 * 渲染一行上下文注入。
 * @param props - 投影字段与翻译席位。
 * @returns 折叠行；展开体按内容形态渲染。
 */
export function ContextInjectionCard({ node, t }: ContextInjectionCardProps) {
  const [open, setOpen] = useState(false)
  const data = node.data
  const runs = contentRuns(data.content)
  return (
    <DisclosureRow
      className={css.root}
      icon={<IconContextInjectionOutlineRegular size={14} />}
      chevronClassName={css.chevron}
      title={t(data.producer.role === 'recall' ? 'message.contextRecall' : 'message.contextInjection')}
      collapsedContent={data.producer.label === null ? undefined : (
        <>
          <span className={css.sep} aria-hidden />
          <span className={css.source} data-context-source>{data.producer.label}</span>
        </>
      )}
      keepContentWhenOpen
      open={open}
      expandable
      expandOnRowClick
      onToggle={() => { setOpen(value => !value) }}
    >
      <div className={css.body} data-context-injection-body data-context-form={data.form ?? undefined}>
        {runs !== null && runs.map((run, index) => (run.kind === 'text'
          // 空文本块不渲染：否则会多出一个空 <pre>。
          ? run.text !== '' && <pre key={index} className={css.text}>{run.text}</pre>
          : (
            <JsonBlock
              key={index}
              label={t('message.unknownBlock')}
              payload={run.block}
              truncatedLabel={total => t('json.truncated', { total })}
            />
          )))}
      </div>
    </DisclosureRow>
  )
}
