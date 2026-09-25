/**
 * 交付行：接管 `present` 的工具行。
 *
 * 官方 PresentRow 是一个 45 行的折叠行：状态点 + 「交付文件」标题 + **逗号拼接
 * 的文件名** + 可展开的结果文本 + inspect 入口。多文件时那串文件名会挤成一行
 * 读不完，也看不出这一轮交付了几个。
 *
 * 本组件保留官方全部信息与交互（四态、状态词、文件名、结果文本、inspect，以及
 * `data-tool="present"` / `data-state` 这两个样式与快照测试的锚点），另加三件：
 * ① 折叠态文件名只报「首个 + 数量」，多文件不再挤成一行；
 * ② 展开态逐文件成行，带扩展名徽标与所在目录；
 * ③ 结果文本标注行数。
 *
 * 全部派生在 deliverable-model.ts 里，本文件只做 JSX。
 *
 * 接管是 DSH 支持的机制（keyed slot 用不同 priority 遮蔽既有占用者，见
 * ui-slots 的 `register()`；官方插件开发 skill：registering an existing key
 * may replace the product's default card）。代价是本文件要自己承担官方行的
 * 折叠外观 —— 因此行外壳逐项对齐 ToolRow.module.css 与同插件的提问卡
 * （24px 行高、2px 分隔点、13px 次级摘要、running 扫光、hover 才现的
 * Inspect 胶囊），组件全部来自共享 ui-primitives。
 *
 * 下载卡片与「打开」菜单不在这里：它们属于 `conversation.chat.turnTail` 槽的
 * Deliverables 网格，与本 toolview 是两个不同的槽，接管互不影响。
 */
import { useState } from 'react'
import { DisclosureRow, IconInspectOutlineMedium, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  deliverableModel, type DeliverableBlock, type DeliverableFile, type DeliverableState,
} from './deliverable-model.ts'
import css from './deliverable-row.module.css'

/** 注入的 locale 翻译函数（注册时声明 `deliverables` 命名空间）。 */
export interface DeliverableTranslate {
  (key: string, params?: Record<string, string | number>): string
}

/** 本行从 slot owner 收到的字段；其余 owner props 与本行无关。 */
export interface DeliverableRowProps {
  t: DeliverableTranslate
  block: DeliverableBlock
  /** 跳到轨迹视图查看原始调用；缺省时不渲染该入口。 */
  inspect?: (() => void) | undefined
}

/** 状态点的外观名，四态映射与官方 PresentRow 一致。 */
const DOT: Record<DeliverableState, 'ongoing' | 'done' | 'warning' | 'error'> = {
  running: 'ongoing',
  ok: 'done',
  stopped: 'warning',
  error: 'error',
}

/** 逐文件一行：扩展名徽标 + 文件名 + 所在目录（完整路径挂在 title 上）。 */
function FileLine({ file }: { file: DeliverableFile }) {
  return (
    <li className={css.file}>
      {file.badge !== null && <span className={css.ext} aria-hidden>{file.badge}</span>}
      <span className={css.name}>{file.name}</span>
      {file.dir !== '' && <span className={css.path} title={file.path}>{file.dir}</span>}
    </li>
  )
}

/**
 * 渲染一次交付的完整记录。
 * @param props - locale 翻译函数、调用/结果切片与可选的轨迹入口。
 * @returns 折叠行 + 展开后的文件清单与结果文本。
 */
export function DeliverableRow({ t, block, inspect }: DeliverableRowProps) {
  const model = deliverableModel(block)
  const [expanded, setExpanded] = useState(false)
  const open = expanded && model.expandable
  return (
    // data-tool / data-variant / data-state 必须保留：palette.ts 的 TOOL_ROW_ROOT
    // 与其他行样式都按它们匹配（同 ask-card 的约定）。
    <div className={css.root} data-variant="others" data-tool="present" data-state={model.state}>
      <DisclosureRow
        rowClassName={css.row}
        leadingClassName={css.leading}
        titleClassName={css.title}
        chevronClassName={css.chevron}
        icon={<StateDot state={DOT[model.state]} />}
        title={t('row.title')}
        open={open}
        expandable={model.expandable}
        expandOnRowClick
        keepContentWhenOpen
        onToggle={() => { setExpanded(value => !value) }}
        collapsedContent={(
          <>
            <span className={css.sep} aria-hidden />
            <span className={css.summary}>
              <span className={css.state}>{t(`row.${model.state}`)}</span>
              <span className={css.paths}>{model.summary}</span>
            </span>
          </>
        )}
      >
        <div className={css.bodyWrap}>
          {model.files.length > 0 && (
            <ul className={css.files} aria-label={t('presented.all', { count: model.files.length })}>
              {model.files.map((file, index) => (
                <FileLine key={`${String(index)}-${file.path}`} file={file} />
              ))}
            </ul>
          )}
          {model.details !== '' && (
            <>
              {model.files.length > 0 && <div className={css.meta}>{`输出 ${String(model.lineCount)} 行`}</div>}
              <pre className={css.output}>{model.details}</pre>
            </>
          )}
          {inspect !== undefined && (
            <button type="button" className={css.inspectButton} onClick={inspect}>
              <IconInspectOutlineMedium />
              {t('row.inspect')}
            </button>
          )}
        </div>
      </DisclosureRow>
    </div>
  )
}
