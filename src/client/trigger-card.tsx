/**
 * 触发通知卡：接管 `conversation.chat.node` 的 `turn-trigger` key。
 *
 * 官方 `TurnTriggerNodeView` 是「图标 + 标题 + 时间 + chevron」的折叠条，
 * 展开体把模型看到的那段文本原样交给 `NoticeBody`（→ `<pre>`）。对目标轮次
 * 来说，那段文本是**提示词原文**（`<goal_round>` / `Objective:` / `Round:`），
 * 骨架对人不构成信息却占满展开区。
 *
 * 本组件保留官方全部信息与交互（折叠、时间、explanation、原文可查），另加：
 * ① 折叠头补**轮次徽标**（收起态即可读到走到第几轮）；
 * ② 目标轮次的展开体改为字段化（目标 / 模型收到的指令），标签与转义消失；
 * ③ 其余触发来源按官方同构渲染（见下）。
 *
 * ## 接管是全 key 的
 *
 * `conversation.chat.node` 是 keyed cell，`priority` 最低者渲染 —— 注册
 * `turn-trigger` 的 `priority: -1` 会让**全部**触发来源都走本组件，这正是
 * 官方 `turnTriggerDetails` 被逐条复刻到 `trigger-model.ts` 的原因。判别只
 * 认 `source.kind`，不认标题文本。
 *
 * 代价：官方对该面板的后续改进会被遮蔽（0.2.0 就把 `schedule` 的图标从
 * `IconAlarmClockOutlineRegular` 换成了 `IconClockOutlineRegular`），今后要
 * 手动跟进。与 `ask_user_question`、`present` 两处接管同一性质。
 *
 * 全部派生在 `trigger-model.ts` 里，本文件只做 JSX。
 */
import { useId, useState, type ComponentType, type ReactNode } from 'react'
import {
  IconAgentPresetOutlineRegular, IconBranchOutlineRegular, IconChevronDownOutlineRegular,
  IconClockOutlineRegular, IconContextInjectionOutlineRegular, IconCordisPluginOutlineRegular,
  IconGlobeOutlineRegular, IconGoalOutlineRegular, IconPaperPlaneOutlineRegular,
  IconQueueOutlineRegular, JsonBlock, type IconProps,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
  contentRuns, formatClock, goalRoundOf, turnTriggerDetails,
  type ContentRun, type GoalRound, type TriggerIcon, type TriggerNodeLike, type TriggerTranslate,
} from './trigger-model.ts'
import css from './trigger-card.module.css'

/** 本卡从 slot owner 收到的字段；其余 owner props 与本卡无关。 */
export interface TriggerCardProps {
  /**
   * Chat Node。上下文消息在 `node.data` 上 —— 官方 `TurnTriggerNodeView`
   * 读的也是 `node.data.content` / `.source` / `.time`，`node` 本身只有
   * kind / key / location 这些位置信息。
   */
  node: { data: TriggerNodeLike }
  t: TriggerTranslate
}

/** 与官方 `TurnTriggerNodeView` 逐项相同的图标映射（`schedule` 用 0.2.0 的选择，两版内核都导出它）。 */
const TRIGGER_ICONS: Record<TriggerIcon, ComponentType<IconProps>> = {
  request: IconContextInjectionOutlineRegular,
  goal: IconGoalOutlineRegular,
  agent: IconPaperPlaneOutlineRegular,
  team: IconAgentPresetOutlineRegular,
  subagent: IconAgentPresetOutlineRegular,
  github: IconBranchOutlineRegular,
  webhook: IconGlobeOutlineRegular,
  schedule: IconClockOutlineRegular,
  job: IconQueueOutlineRegular,
  plugin: IconCordisPluginOutlineRegular,
}

/**
 * 轮次徽标。文案是插件自有 —— chat 字典里没有「第 N / M 轮」这样的 key，
 * 与交付行的折叠摘要直写中文同一取径。
 * @param props - 已还原的轮次字段。
 * @returns 徽标。
 */
function RoundBadge({ goal }: { goal: GoalRound }) {
  return <span className={css.round}>{`第 ${String(goal.round)} / ${String(goal.maxRounds)} 轮`}</span>
}

/**
 * 目标轮次的展开体：字段化，标签与转义都不再出现。
 *
 * 指令段独立成一节并默认收起 —— 它是给模型的执行要求，对人是噪音，但**不该
 * 销毁**（它解释了模型这一轮为什么会这么干），所以保留可查性而不是删掉。
 * @param props - 已还原的轮次字段。
 * @returns 两节字段。
 */
function GoalRoundBody({ goal }: { goal: GoalRound }) {
  return (
    <div className={css.detail}>
      <dl className={css.pair}>
        <dt className={css.key}>目标</dt>
        <dd className={css.value} data-trigger-objective>{goal.objective}</dd>
      </dl>
      <details className={css.instruction}>
        <summary className={css.instructionSummary}>模型收到的指令</summary>
        <pre className={css.instructionText}>{goal.instruction}</pre>
      </details>
    </div>
  )
}

/**
 * 非目标轮次的展开体：与官方 `NoticeBody` 同构 —— 文本按真实换行显示，
 * 本版本不认识的块单独渲染而不是消失。
 * @param props - 内容分段与翻译席位。
 * @returns 原文块。
 */
function PlainBody({ runs, t }: { runs: readonly ContentRun[]; t: TriggerTranslate }): ReactNode {
  return runs.map((run, index) => (run.kind === 'text'
    // 空文本块不渲染 —— 官方 `ModelFacingContent` 同样跳过 `''`，不然会多出一个空 `<pre>`。
    ? run.text !== '' && <pre key={index} className={css.text} data-context-text>{run.text}</pre>
    : (
      <JsonBlock
        key={index}
        label={t('message.unknownBlock')}
        payload={run.block}
        truncatedLabel={total => t('json.truncated', { total })}
      />
    )))
}

/**
 * 渲染一张触发通知卡。
 * @param props - 节点数据与翻译席位（注册时声明 `chat` 命名空间）。
 * @returns 折叠卡；收起的展开体由内容形态决定。
 */
export function TriggerCard({ node, t }: TriggerCardProps) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  const data = node.data
  const details = turnTriggerDetails(data.source)
  const TriggerIcon = TRIGGER_ICONS[details.icon]
  const goal = goalRoundOf(data)
  const runs = contentRuns(data.content)
  const time = formatClock(data.time, t)
  // 时间来自会话日志（durable 数据），缺一个合法值时不该整卡崩掉 ——
  // 崩溃会被 slot 系统接住并静默回落到官方注册，用户只看到"插件没生效"。
  const instant = new Date(data.time)
  const stamp = Number.isNaN(instant.getTime()) ? undefined : instant.toISOString()
  return (
    <section className={css.root} data-turn-trigger data-trigger-card>
      <button
        className={css.header}
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => { setOpen(!open) }}
      >
        <span className={css.icon} aria-hidden><TriggerIcon size={14} /></span>
        <span className={css.title}>{t(details.titleKey)}</span>
        {goal !== null && <RoundBadge goal={goal} />}
        <time className={css.time} dateTime={stamp}>{time}</time>
        <IconChevronDownOutlineRegular size={12} className={open ? css.openChevron : css.chevron} />
      </button>
      {open && (
        <div id={bodyId} className={css.body}>
          <p className={css.explanation}>{t('message.trigger.explanation')}</p>
          {goal !== null
            ? <GoalRoundBody goal={goal} />
            : <div className={css.content}>{runs !== null && <PlainBody runs={runs} t={t} />}</div>}
        </div>
      )}
    </section>
  )
}
