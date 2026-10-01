/**
 * 技能行：接管 `skill` 的工具行。
 *
 * 官方 `SkillRow`（ui-skill）是「状态图标 + 『加载技能』+ 技能名」的折叠行，展开体
 * 是一张「说明」卡，里面用 `<pre>` 直接铺 `skill` 工具返回的**规范渲染块**：
 * `<skill_content name="…">` 套 `<skill_resources>`（一两行资源指引）再套
 * `<skill_instructions>`（技能正文）。那层 XML 壳对人不构成信息，却把正文夹在中间。
 *
 * 本组件保留官方全部信息与交互（四态、状态词、技能名、`查看` 入口、`data-tool="skill"`
 * 与 `data-state` 这两个样式与快照测试的锚点），另加两件：
 * ① 展开体剥壳：正文直出，XML 骨架消失；
 * ② 资源指引单独成节并**默认收起**（保留可查性，不销毁——它解释了技能去哪些路径找素材）。
 *
 * **结构不符时退回官方等价形态**：直接铺结果原文，绝不猜、也绝不把展开体渲染成空白。
 * 全部派生在 skill-model.ts 里，本文件只做 JSX。
 *
 * 接管是 DSH 支持的机制（keyed slot 用更低的 priority 遮蔽既有占用者，见 ui-slots 的
 * `register()`）。代价是本文件要自己承担官方行的折叠外观 —— 因此外壳逐项对齐
 * 同插件的交付行与提问卡（`DisclosureRow` + `StateDot`，组件全部来自共享 ui-primitives）。
 */
import { useState } from 'react'
import {
  DisclosureRow, IconInspectOutlineMedium, StateDot, TextShimmer,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { skillModel, type SkillBlock, type SkillState } from './skill-model.ts'
import css from './skill-row.module.css'

/** 注入的 locale 翻译函数（注册时声明 `skill` 命名空间）。 */
export interface SkillTranslate {
  (key: string, params?: Record<string, string | number>): string
}

/** 本行从 slot owner 收到的字段；其余 owner props 与本行无关。 */
export interface SkillRowProps {
  t: SkillTranslate
  block: SkillBlock
  /** 跳到轨迹视图查看原始调用；缺省时不渲染该入口。 */
  inspect?: (() => void) | undefined
  /** 准备阶段（调用尚未落地）单独成态。 */
  phase?: string | undefined
}

/** 状态点的外观名，四态映射与官方 `SkillRow` 一致。 */
const DOT: Record<SkillState, 'ongoing' | 'done' | 'warning' | 'error'> = {
  running: 'ongoing',
  ok: 'done',
  stopped: 'warning',
  error: 'error',
}

/**
 * 渲染一次技能加载的完整记录。
 * @param props - locale 翻译函数、调用/结果切片与可选的轨迹入口。
 * @returns 折叠行 + 展开后的技能正文与资源指引。
 */
export function SkillRow({ t, block, inspect, phase }: SkillRowProps) {
  const model = skillModel(block)
  const [expanded, setExpanded] = useState(false)
  // 准备阶段没有调用切片可解析，与官方一样只报一句话。
  if (phase === 'preparing') {
    return (
      <div className={css.root} data-variant="others" data-tool="skill" data-state="running">
        <div className={css.row}>
          <span className={css.leading}><StateDot state="ongoing" /></span>
          <TextShimmer active className={css.title}>{t('row.preparing')}</TextShimmer>
        </div>
      </div>
    )
  }
  const open = expanded && model.expandable
  const summary = model.state === 'stopped'
    ? t('row.stopped')
    : model.errorSummary ?? model.name
  return (
    // data-tool / data-variant / data-state 必须保留：palette.ts 的 TOOL_ROW_ROOT
    // 与其他行样式都按它们匹配（同 ask-card / deliverable-row 的约定）。
    <div className={css.root} data-variant="others" data-tool="skill" data-state={model.state}>
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
            <span className={css.summary}>{summary}</span>
          </>
        )}
      >
        <div className={css.bodyWrap}>
          <section className={css.instructionsCard} aria-label={t('row.instructions')}>
            <div className={css.instructionsHeader}>{t('row.instructions')}</div>
            {/* 剥壳成功铺正文，否则铺原文 —— 与官方展开体等价，不留空白。 */}
            <pre className={css.instructions} data-error={model.state === 'error' || undefined}>
              {model.parsed ? model.instructions : model.raw}
            </pre>
          </section>
          {model.parsed && model.resources !== '' && (
            // 默认收起：它解释技能去哪找素材，属于按需查看的背景，不是正文。
            // 「资源」直写中文，与 goal-detail 的「等 N 个文件」同取径：官方 skill
            // 字典没有这个 key，而本插件的产品文案本就是中文。
            <details className={css.resources}>
              <summary className={css.resourcesSummary}>资源</summary>
              <pre className={css.resourcesText}>{model.resources}</pre>
            </details>
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
