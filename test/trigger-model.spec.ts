/**
 * trigger-model 的单测：目标轮次提示词的解析与回退、触发来源的映射、
 * 以及时间格式的复刻。
 *
 * 解析这一侧是本次接管的全部风险 —— 提示词结构是内核私有约定，它一变，
 * 唯一的期望行为是**整卡回退**，不是显示半截字段。
 */

import { describe, expect, it } from 'vitest'
import {
  contentRuns, formatClock, goalRoundOf, parseGoalRound, plainText,
  turnTriggerDetails, type TriggerTranslate,
} from '../src/client/trigger-model.ts'

/** 与内核 `goal-round-driver/src/prompt.ts` 的 `renderGoalRoundPrompt` 同构。 */
function goalText(
  objective: string,
  round = 1,
  max: number | string = 256,
  instruction = 'Continue working toward the objective in this same session.',
): string {
  return '<goal_round>\n'
    + `Objective: ${JSON.stringify(objective)}\n`
    + `Round: ${round}/${max}\n\n`
    + `${instruction}\n`
    + '</goal_round>'
}

describe('parseGoalRound', () => {
  it('解析标准提示词', () => {
    expect(parseGoalRound(goalText('发布 0.7.0'))).toEqual({
      objective: '发布 0.7.0',
      round: 1,
      maxRounds: 256,
      instruction: 'Continue working toward the objective in this same session.',
    })
  })

  it('还原 JSON 转义：真换行、引号，以及目标里本来含的闭合标签字样', () => {
    // 内核用 JSON.stringify 写目标，所以目标里的 `\n`、`"` 与 `</goal_round>`
    // 字样都是转义的。还原后必须与原文逐字相同，且不能破坏骨架的分段。
    const objective = '第一行\n第二行 含 "引号" 与 </goal_round> 字样'
    expect(parseGoalRound(goalText(objective))?.objective).toBe(objective)
  })

  it('上限缺失（内核会写出 undefined）时整体放弃', () => {
    expect(parseGoalRound(goalText('x', 1, 'undefined'))).toBeNull()
  })

  it('骨架任一处不符即放弃', () => {
    const ok = goalText('x')
    expect(parseGoalRound(ok.replace('Objective: ', 'Goal: '))).toBeNull()
    expect(parseGoalRound(ok.replace('<goal_round>\n', ''))).toBeNull()
    expect(parseGoalRound(ok.replace('\n</goal_round>', ''))).toBeNull()
    expect(parseGoalRound(ok.replace('Round: 1/256', 'Round: 一/二'))).toBeNull()
    expect(parseGoalRound(ok.replace('\n\n', '\n'))).toBeNull()
  })

  it('目标不是合法 JSON 串时放弃', () => {
    expect(parseGoalRound('<goal_round>\nObjective: 没加引号\nRound: 1/2\n\nGo.\n</goal_round>')).toBeNull()
  })

  it('对任意普通文本返回 null，不抛错', () => {
    expect(parseGoalRound('')).toBeNull()
    expect(parseGoalRound('已读取文件并执行了命令')).toBeNull()
    expect(parseGoalRound('<goal_round>')).toBeNull()
  })
})

describe('turnTriggerDetails', () => {
  it('十种来源各自映射到官方的标题 key 与图标', () => {
    expect(turnTriggerDetails({ kind: 'goal' })).toEqual({ titleKey: 'message.trigger.goal', icon: 'goal' })
    expect(turnTriggerDetails({ kind: 'agent-message' })).toEqual({ titleKey: 'message.trigger.agent', icon: 'agent' })
    expect(turnTriggerDetails({ kind: 'team-message' })).toEqual({ titleKey: 'message.trigger.team', icon: 'team' })
    expect(turnTriggerDetails({ kind: 'subagent-settled' })).toEqual({ titleKey: 'message.trigger.subagent', icon: 'subagent' })
    expect(turnTriggerDetails({ kind: 'schedule' })).toEqual({ titleKey: 'message.trigger.schedule', icon: 'schedule' })
    expect(turnTriggerDetails({ kind: 'tool-jobs' })).toEqual({ titleKey: 'message.trigger.job', icon: 'job' })
    expect(turnTriggerDetails({ kind: 'cordis-host-runner' })).toEqual({ titleKey: 'message.trigger.plugin', icon: 'plugin' })
  })

  it('webhook 依 provider 分岔到 GitHub', () => {
    expect(turnTriggerDetails({ kind: 'webhook', provider: 'github' }))
      .toEqual({ titleKey: 'message.trigger.github', icon: 'github' })
    expect(turnTriggerDetails({ kind: 'webhook', provider: 'gitlab' }))
      .toEqual({ titleKey: 'message.trigger.webhook', icon: 'webhook' })
  })

  it('未识别的来源落到「收到执行请求」，不假装知道它的身份', () => {
    const fallback = { titleKey: 'message.trigger.request', icon: 'request' }
    expect(turnTriggerDetails({ kind: 'something-new' })).toEqual(fallback)
    expect(turnTriggerDetails({})).toEqual(fallback)
    expect(turnTriggerDetails(undefined)).toEqual(fallback)
    expect(turnTriggerDetails('nope')).toEqual(fallback)
  })
})

describe('goalRoundOf', () => {
  const node = (text: string, source: unknown) => ({ content: [{ type: 'text', text }], source })

  it('来源里的轮次优先于文本里的数字（结构化事实优先）', () => {
    expect(goalRoundOf(node(goalText('x', 3), { kind: 'goal', round: 7 }))?.round).toBe(7)
  })

  it('来源缺轮次时回落到文本', () => {
    expect(goalRoundOf(node(goalText('x', 3), { kind: 'goal' }))?.round).toBe(3)
  })

  it('轮次为 0 或非整数时不算数，仍用文本', () => {
    expect(goalRoundOf(node(goalText('x', 3), { kind: 'goal', round: 0 }))?.round).toBe(3)
    expect(goalRoundOf(node(goalText('x', 3), { kind: 'goal', round: 1.5 }))?.round).toBe(3)
  })

  it('非目标轮次的内容返回 null（交给等价外壳）', () => {
    expect(goalRoundOf(node('已读取文件并执行了命令', { kind: 'schedule' }))).toBeNull()
    expect(goalRoundOf(node(goalText('x'), { kind: 'schedule' }))).not.toBeNull() // 文本说了算
  })

  it('出现非文本块时返回 null', () => {
    expect(goalRoundOf({ content: [{ type: 'image', data: 'x' }], source: { kind: 'goal' } })).toBeNull()
  })
})

describe('内容分段', () => {
  it('全文本时拼成一个串', () => {
    expect(plainText([{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }])).toBe('ab')
  })

  it('混入未知块时 plainText 放弃，而分段仍把该块原样带出', () => {
    const content = [{ type: 'text', text: 'a' }, { type: 'image', data: 1 }]
    expect(plainText(content)).toBeNull()
    expect(contentRuns(content)).toEqual([
      { kind: 'text', text: 'a' },
      { kind: 'block', block: { type: 'image', data: 1 } },
    ])
  })

  it('不是数组时返回 null', () => {
    expect(contentRuns('nope')).toBeNull()
    expect(contentRuns(null)).toBeNull()
    expect(plainText(undefined)).toBeNull()
  })
})

describe('formatClock', () => {
  const t: TriggerTranslate = (key, params) => key === 'clock.md'
    ? `${String(params?.['m'])}月${String(params?.['d'])}日`
    : `${String(params?.['y'])}年${String(params?.['m'])}月${String(params?.['d'])}日`

  it('同一天只给时分', () => {
    const now = new Date(2026, 8, 29, 15, 0).getTime()
    expect(formatClock(new Date(2026, 8, 29, 9, 5).getTime(), t, now)).toBe('09:05')
  })

  it('同年不同日带上 clock.md 模板', () => {
    const now = new Date(2026, 8, 29, 15, 0).getTime()
    expect(formatClock(new Date(2026, 7, 3, 14, 7).getTime(), t, now)).toBe('8月3日 14:07')
  })

  it('跨年用 clock.ymd 模板', () => {
    const now = new Date(2026, 0, 2, 10, 0).getTime()
    expect(formatClock(new Date(2025, 11, 31, 23, 59).getTime(), t, now)).toBe('2025年12月31日 23:59')
  })
})
