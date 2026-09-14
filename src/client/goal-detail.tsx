/**
 * 目标详情折叠条：接在官方 GoalBar 下面（`conversation.input.dock` 里
 * `order: 11`，官方那条是 10），把官方条上被 ellipsis 截断的目标展开成可读
 * 详情。
 *
 * 卡片形态照同槽的待办面板（ui-conversation 的 TodoPanel）：同一套 dock 宽度
 * 公式、同一张 `--dsw-specific-tip` 卡片、同一个「标题 + 右侧摘要 + chevron」
 * 折叠头，默认收起。折叠头只放官方条**没有**的元信息（版本号、自主轮次），
 * 目标原文放在展开区 —— 这样两块不会互相重复。
 *
 * 为什么是「另加一条」而不是接管官方条：`conversation.input.dock` 是 list
 * 槽，不同 id 各自成格并列渲染；而官方 ui-goal 的注入面（edit/pause/resume/
 * clear 四个 Remote 动词 + 一个带竞态防护的 activation 订阅源）是**注册者
 * 私有**的，接管就得整套复刻 —— 那会把这个「只读地多看一行」的需求变成
 * 插件里多一处会写会话数据的 RPC 客户端。这里只读 `useProjection('goal')`。
 */
import { useEffect, useState } from 'react'
import {
  IconChevronDownOutline14, IconChevronUpOutline14, IconGoalOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactNode } from 'react'
import css from './goal-detail.module.css'

/** 投影里本卡渲染的字段（照 DSH 的 `GoalSnapshot` 声明为鸭子类型）。 */
export interface GoalSnapshotLike {
  id: string
  revision: number
  objective: string
  phase: 'active' | 'paused' | 'blocked' | 'complete'
  /** 自主轮次上限；未设置时为 undefined。 */
  maxGoalRounds?: number | undefined
  /** 已开始的自主轮次；旧快照可能没有该字段。 */
  roundsStarted?: number | undefined
  /** 仅 blocked 阶段存在。 */
  blockedReason?: { code: string; message: string } | undefined
}

/** `useProjection('goal')` 的返回形状。 */
export interface GoalProjectionLike {
  goal: GoalSnapshotLike
}

/** 本卡从 slot 标准 props 取用的部分（其余 owner props 与本卡无关）。 */
export interface GoalDetailProps {
  /** 框架标准投影席位：按 key 读当前会话的投影。 */
  useProjection: (key: string) => GoalProjectionLike | null | undefined
}

/** 阶段文案：与官方 goal 字典同义，按本插件既有做法直写中文。 */
const PHASE_LABEL: Record<GoalSnapshotLike['phase'], string> = {
  active: '进行中',
  paused: '已暂停',
  blocked: '已阻塞',
  complete: '已完成',
}

/** 折叠头右侧摘要：只放官方条没有的元信息。 */
function summaryLabel(goal: GoalSnapshotLike): string {
  const parts = [`rev ${String(goal.revision)}`]
  if (goal.roundsStarted !== undefined) {
    parts.push(goal.maxGoalRounds === undefined
      ? `${String(goal.roundsStarted)} 轮`
      : `${String(goal.roundsStarted)} / ${String(goal.maxGoalRounds)} 轮`)
  }
  return parts.join('\u2002·\u2002')
}

/** 展开区里的一组「键 / 值」。 */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={css.row}>
      <dt className={css.key}>{label}</dt>
      <dd className={css.value}>{children}</dd>
    </div>
  )
}

/**
 * 渲染目标详情折叠条。
 * @param props - 框架标准投影席位。
 * @returns 折叠条；加载中、无目标、或目标已完成时不渲染（与官方条一致）。
 */
export function GoalDetail({ useProjection }: GoalDetailProps) {
  const projection = useProjection('goal')
  const [collapsed, setCollapsed] = useState(true)
  const goalId = projection?.goal.id

  // 目标换了一个（新建 / 清除后重建）就收起：否则展开态会挂在新目标上。
  useEffect(() => { setCollapsed(true) }, [goalId])

  const goal = projection?.goal
  if (goal === undefined || goal === null || goal.phase === 'complete') return null

  return (
    <section className={css.root} data-goal-detail aria-label="目标详情">
      <div className={css.body}>
        <button
          type="button"
          className={css.header}
          aria-expanded={!collapsed}
          onClick={() => { setCollapsed(value => !value) }}
        >
          <span className={css.lead} aria-hidden><IconGoalOutline16 size={14} /></span>
          <span className={css.title}>目标详情</span>
          <span className={css.summary}>{summaryLabel(goal)}</span>
          <span className={css.chevron} aria-hidden>
            {collapsed ? <IconChevronUpOutline14 /> : <IconChevronDownOutline14 />}
          </span>
        </button>
        {!collapsed && (
          <dl className={css.detail}>
            <Row label="目标">{goal.objective}</Row>
            <Row label="阶段">{PHASE_LABEL[goal.phase]}</Row>
            {goal.blockedReason !== undefined && (
              <Row label="阻塞">
                {goal.blockedReason.message}
                <span className={css.code}>{goal.blockedReason.code}</span>
              </Row>
            )}
            <Row label="标识">
              <span className={css.code}>{goal.id}</span>
            </Row>
          </dl>
        )}
      </div>
    </section>
  )
}
