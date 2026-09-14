/**
 * 提问卡：接管 `ask_user_question` 的工具行。
 *
 * 官方转录卡只列**已选答案**，结算后就再也看不到当时还有哪些选项。本卡片
 * 用调用参数里的 `options` 把每个选项都渲染成一块，被选中的那块用插件色板
 * 里 ask 类别的强调色（默认蓝）反显并打勾。
 *
 * 接管是 DSH 支持的机制（keyed slot 用不同 priority 遮蔽既有占用者，
 * 见 ui-slots 的 `register()`），代价是本文件要自己承担官方 ToolRow 的
 * 折叠行外观 —— 因此行外壳逐项对齐 ToolRow.module.css 的既有视觉
 * （24px 行高、2px 分隔点、13px 次级摘要、running 扫光、hover 才现的
 * Inspect 胶囊），组件则全部来自共享的 ui-primitives。
 */
import { useMemo, useState } from 'react'
import {
  DisclosureRow, IconCheckOutline14, IconInspectOutline12, IconQuestionOutline14, StateDot,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { askCardModel, askProgress, type AskCardModel, type AskToolBlock } from './ask-model.ts'
import css from './ask-card.module.css'

/** 注入的 locale 翻译函数（注册时声明 `conversation` 命名空间）。 */
export interface AskTranslate {
  (key: string, params?: Record<string, string | number>): string
}

/** 卡片从 slot owner 收到的字段；其余 owner props 与本行无关。 */
export interface AskCardProps {
  t: AskTranslate
  block: AskToolBlock
  /** 跳到轨迹视图查看原始调用；缺省时不渲染该入口。 */
  inspect?: (() => void) | undefined
}

/** 折叠行右侧的摘要：等待 / 已取消 / 已中断 / 未回答 / N-M 已回答。 */
function summaryText(model: AskCardModel, t: AskTranslate): string {
  if (model.phase === 'pending') return t('ask.waiting')
  if (model.phase === 'unanswered') {
    if (model.verdict === 'cancelled') return t('ask.cancelled')
    if (model.verdict === 'aborted') return t('ask.interrupted')
    return t('ask.skipped')
  }
  const { answered, total } = askProgress(model)
  return t('ask.answered', { answered, total })
}

/** 一行「未选/已选」选项块。 */
function OptionRow({ label, description, chosen }: {
  label: string
  description?: string | undefined
  chosen: boolean
}) {
  return (
    <div className={css.option} data-chosen={chosen ? '' : undefined}>
      <span className={css.marker} aria-hidden="true">
        {chosen && <IconCheckOutline14 />}
      </span>
      <span className={css.optionText}>
        <span className={css.label}>{label}</span>
        {description !== undefined && description !== '' && (
          <span className={css.desc}>{description}</span>
        )}
      </span>
    </div>
  )
}

/** 展开后的卡片体：逐问题列出全部选项并标出选中项。 */
function QuestionList({ model, t }: { model: AskCardModel; t: AskTranslate }) {
  return (
    <div className={css.card}>
      {model.verdict !== undefined && (
        <p className={css.verdict}>
          {model.verdict === 'cancelled' ? t('ask.cancelledDetail') : t('ask.interruptedDetail')}
        </p>
      )}
      {model.questions.map((question, index) => (
        <div className={css.item} key={question.id !== '' ? question.id : `q${String(index)}`}>
          {question.header !== '' && <div className={css.header}>{question.header}</div>}
          <div className={css.question}>{question.question}</div>
          {question.detail !== '' && <div className={css.detail}>{question.detail}</div>}
          {question.options.length > 0
            ? (
              <div className={css.options}>
                {question.options.map((option, optionIndex) => (
                  <OptionRow
                    key={`${String(optionIndex)}-${option.label}`}
                    label={option.label}
                    description={option.description}
                    chosen={question.selected.includes(option.label)}
                  />
                ))}
                {/* 直接输入的答案不在选项表里，单独补一块，否则这次回答会消失。 */}
                {question.custom !== '' && <OptionRow label={question.custom} chosen />}
              </div>
            )
            : (
              <div className={css.answers}>
                {question.selected.map((answer, answerIndex) => (
                  <span className={css.answerLine} key={`${String(answerIndex)}-${answer}`}>{answer}</span>
                ))}
                {question.custom !== '' && <span className={css.answerLine}>{question.custom}</span>}
                {question.selected.length === 0 && question.custom === '' && (
                  <span className={css.answersEmpty}>{t('ask.skipped')}</span>
                )}
              </div>
            )}
        </div>
      ))}
    </div>
  )
}

/**
 * 渲染一次提问的完整记录。
 * @param props - locale 翻译函数、冻结的调用切片与可选的轨迹入口。
 * @returns 折叠行 + 展开后的选项卡片。
 */
export function AskQuestionRow({ t, block, inspect }: AskCardProps) {
  const model = useMemo(() => askCardModel(block), [block])
  const [expanded, setExpanded] = useState(false)
  const hasBody = model.questions.length > 0 || model.fallbackText !== null
  const open = expanded && hasBody
  const leading = model.state === 'error'
    ? <StateDot state="error" />
    : model.state === 'stopped'
      ? <StateDot state="warning" />
      : <IconQuestionOutline14 />
  return (
    // data-tool / data-variant / data-state 必须保留：插件既有的强调色规则
    // （palette.ts 的 TOOL_ROW_ROOT）与其他行样式都按这三个属性匹配。
    <div className={css.root} data-variant="others" data-tool="ask_user_question" data-state={model.state}>
      <DisclosureRow
        rowClassName={css.row}
        leadingClassName={css.leading}
        titleClassName={css.title}
        chevronClassName={css.chevron}
        icon={leading}
        title={t('ask.rowTitle')}
        open={open}
        expandable={hasBody}
        expandOnRowClick
        keepContentWhenOpen
        onToggle={() => { setExpanded(value => !value) }}
        collapsedContent={(
          <>
            <span className={css.sep} aria-hidden />
            <span className={css.summary}>{summaryText(model, t)}</span>
          </>
        )}
      >
        <div className={css.bodyWrap}>
          {model.questions.length > 0
            ? <QuestionList model={model} t={t} />
            // 参数或结果畸形时的兜底：接管后不渲染就等于用户什么都看不到。
            : <pre className={css.fallback}>{model.fallbackText}</pre>}
          {inspect !== undefined && (
            <button type="button" className={css.inspectButton} onClick={inspect}>
              <IconInspectOutline12 />
              {t('row.inspect')}
            </button>
          )}
        </div>
      </DisclosureRow>
    </div>
  )
}
