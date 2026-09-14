/**
 * 提问卡派生逻辑的单测：选项还原、答案配对、以及各条降级路径。
 *
 * 接管官方卡片后这些派生就是唯一的渲染来源，所以畸形输入（半截 JSON、
 * 结果不是 answers、id 对不上）都必须有确定的输出，而不是空白。
 */

import { describe, expect, it } from 'vitest'
import { askCardModel, askProgress, resultTextOf } from '../src/client/ask-model.ts'

/** 造一个已结算的结果节点（结构照 DSH 的 ToolResultNode）。 */
function settled(argsRaw: string, answers: unknown, extra: Record<string, unknown> = {}) {
  return {
    kind: 'tool-result',
    callId: 'call-1',
    call: { argsRaw },
    content: [{ type: 'text', text: JSON.stringify({ answers }) }],
    isError: false,
    ...extra,
  }
}

/** 造一个尚未结算的调用。 */
function running(argsRaw: string) {
  return { callId: 'call-1', argsRaw }
}

const ARGS = JSON.stringify({
  questions: [{
    id: 'q1',
    question: 'DSH 插件的最小单位是？',
    options: [
      { label: '服务' },
      { label: '插件（cordis 插件）', description: 'cordis 的 apply 单元' },
      { label: '工具' },
    ],
  }],
})

describe('askCardModel 选项还原', () => {
  it('keeps every offered option and marks the chosen one', () => {
    const model = askCardModel(settled(ARGS, [{ id: 'q1', selected: ['插件（cordis 插件）'] }]))
    expect(model.phase).toBe('answered')
    expect(model.state).toBe('ok')
    expect(model.questions[0]?.options.map(option => option.label))
      .toEqual(['服务', '插件（cordis 插件）', '工具'])
    expect(model.questions[0]?.options[1]?.description).toBe('cordis 的 apply 单元')
    expect(model.questions[0]?.selected).toEqual(['插件（cordis 插件）'])
    expect(askProgress(model)).toEqual({ answered: 1, total: 1 })
  })

  it('keeps every chosen label of a multi-select answer in order', () => {
    const args = JSON.stringify({
      questions: [{
        id: 'q1',
        question: '要修哪些？',
        multiSelect: true,
        options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
      }],
    })
    const model = askCardModel(settled(args, [{ id: 'q1', selected: ['C', 'A'] }]))
    expect(model.questions[0]?.multiSelect).toBe(true)
    expect(model.questions[0]?.selected).toEqual(['C', 'A'])
    expect(model.questions[0]?.options).toHaveLength(3)
  })

  it('carries a typed answer beside the options', () => {
    const model = askCardModel(settled(ARGS, [{ id: 'q1', selected: [], custom: '都不是' }]))
    expect(model.questions[0]?.custom).toBe('都不是')
    expect(askProgress(model)).toEqual({ answered: 1, total: 1 })
  })

  it('reports an unanswered set when nothing was chosen', () => {
    const model = askCardModel(settled(ARGS, [{ id: 'q1', selected: [] }]))
    expect(askProgress(model)).toEqual({ answered: 0, total: 1 })
    expect(model.questions[0]?.options).toHaveLength(3)
  })

  it('pairs two questions by id', () => {
    const args = JSON.stringify({
      questions: [
        { id: 'a', question: '第一个？', options: [{ label: '1' }] },
        { id: 'b', question: '第二个？', options: [{ label: '2' }] },
      ],
    })
    const model = askCardModel(settled(args, [{ id: 'b', selected: ['2'] }, { id: 'a', selected: ['1'] }]))
    expect(model.questions.map(question => question.selected)).toEqual([['1'], ['2']])
    expect(askProgress(model)).toEqual({ answered: 2, total: 2 })
  })

  it('keeps the options when an id cannot be paired', () => {
    const model = askCardModel(settled(ARGS, [{ id: 'other', selected: ['服务'] }]))
    expect(model.questions[0]?.options).toHaveLength(3)
    expect(model.questions[0]?.selected).toEqual([])
  })

  it('accepts a bare string option list', () => {
    const args = JSON.stringify({ questions: [{ id: 'q1', question: '选？', options: ['甲', '乙'] }] })
    const model = askCardModel(settled(args, [{ id: 'q1', selected: ['乙'] }]))
    expect(model.questions[0]?.options.map(option => option.label)).toEqual(['甲', '乙'])
  })
})

describe('askCardModel 状态与降级', () => {
  it('reports a running call as pending with its options visible', () => {
    const model = askCardModel(running(ARGS))
    expect(model.state).toBe('running')
    expect(model.phase).toBe('pending')
    expect(model.questions[0]?.options).toHaveLength(3)
    expect(model.questions[0]?.selected).toEqual([])
  })

  it('names composer cancellation', () => {
    const model = askCardModel(settled(ARGS, [], { error: { code: 'ASK_CANCELLED' }, isError: true }))
    expect(model.verdict).toBe('cancelled')
    expect(model.phase).toBe('unanswered')
    // 用户自己取消是一次正常结算，不是失败行。
    expect(model.state).toBe('ok')
    expect(model.questions[0]?.options).toHaveLength(3)
  })

  it('names a turn interrupt as stopped', () => {
    const model = askCardModel(settled(ARGS, [], { error: { code: 'ASK_ABORTED' }, isError: true }))
    expect(model.verdict).toBe('aborted')
    expect(model.phase).toBe('unanswered')
    expect(model.state).toBe('stopped')
  })

  it('flags a failed call', () => {
    const model = askCardModel(settled(ARGS, [], { isError: true }))
    expect(model.state).toBe('error')
  })

  it('falls back to the result text when the arguments are unreadable', () => {
    const block = {
      kind: 'tool-result',
      callId: 'call-1',
      call: { argsRaw: '{"questions": [{"id":' },
      content: [{ type: 'text', text: '半截参数的兜底文本' }],
      isError: false,
    }
    const model = askCardModel(block)
    expect(model.questions).toEqual([])
    expect(model.fallbackText).toBe('半截参数的兜底文本')
  })

  it('falls back to the raw arguments when there is no result text', () => {
    const model = askCardModel({ kind: 'tool-result', callId: 'c', call: null, content: [], isError: false })
    expect(model.questions).toEqual([])
    expect(model.fallbackText).toBeNull()
  })

  it('treats a non-answers result as an unanswered set', () => {
    const block = {
      kind: 'tool-result',
      callId: 'c',
      call: { argsRaw: ARGS },
      content: [{ type: 'text', text: 'not json' }],
      isError: false,
    }
    const model = askCardModel(block)
    expect(model.phase).toBe('answered')
    expect(model.questions[0]?.options).toHaveLength(3)
    expect(model.questions[0]?.selected).toEqual([])
  })
})

describe('resultTextOf', () => {
  it('joins text blocks and stringifies other blocks', () => {
    expect(resultTextOf({ content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] })).toBe('a\nb')
    expect(resultTextOf({ content: [{ type: 'image', data: 'x' }] })).toBe('{\n  "type": "image",\n  "data": "x"\n}')
  })

  it('returns null for an empty or missing content list', () => {
    expect(resultTextOf({ content: [] })).toBeNull()
    expect(resultTextOf({})).toBeNull()
  })
})
