import { describe, expect, it } from 'vitest'
import {
  contextForm, contextProducer, injectedContextState, isAppendSurface, isInjectedContextEvent,
} from '../src/client/context-injection-model.ts'

/** 一条以 append 进入 surface 的注入事件（形态照真实会话日志里的 seq=10）。 */
function injection(source: unknown, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'user/message',
    seq: 10,
    time: 1_790_791_331_517,
    surfaceOp: 'append',
    data: { content: [{ type: 'text', text: 'Current runtime context.' }], source },
    ...overrides,
  }
}

describe('isAppendSurface', () => {
  it('accepts a surface event carrying the append marker', () => {
    expect(isAppendSurface({ type: 'user/message', surfaceOp: 'append' })).toBe(true)
  })

  it('rejects a surface event without the marker', () => {
    // 官方 `isSurfaceEvent` 要求 surfaceOp 存在；缺标记的不是 surface 事件。
    expect(isAppendSurface({ type: 'user/message' })).toBe(false)
  })

  it('rejects an appended event of a non-surface type', () => {
    expect(isAppendSurface({ type: 'tool/call', surfaceOp: 'append' })).toBe(false)
  })

  it('rejects a replacement copy', () => {
    expect(isAppendSurface({ type: 'user/message', surfaceOp: { op: 'replace', startSeq: 1, endSeq: 2 } })).toBe(false)
  })
})

describe('isInjectedContextEvent', () => {
  it('accepts a non-user source injected as a user message', () => {
    expect(isInjectedContextEvent(injection({ kind: 'runtime-context', form: 'snapshot' }))).toBe(true)
  })

  it('rejects real human input', () => {
    expect(isInjectedContextEvent(injection({ kind: 'user' }))).toBe(false)
  })

  it('rejects a source that names no kind', () => {
    expect(isInjectedContextEvent(injection({}))).toBe(false)
  })

  it('rejects an injection that arrived as a replacement copy', () => {
    const event = injection({ kind: 'runtime-context' })
    event['surfaceOp'] = { op: 'replace', startSeq: 1, endSeq: 2 }
    expect(isInjectedContextEvent(event)).toBe(false)
  })

  it('rejects other event types, including the developer tool-change notice', () => {
    // developer/message 的 content 全是 tool-addition/removal，官方因此**仍然
    // 显示**它（`isVisibleChatNode` 的例外条件）。恢复它会造成双行。
    expect(isInjectedContextEvent({ ...injection({ kind: 'plugin:x' }), type: 'developer/message' })).toBe(false)
    expect(isInjectedContextEvent({ ...injection({ kind: 'plugin:x' }), type: 'assistant/message' })).toBe(false)
  })
})

describe('contextProducer', () => {
  it('labels agent instructions by the changed file paths', () => {
    expect(contextProducer({
      kind: 'agent-instructions',
      changes: [{ path: 'AGENTS.md' }, { path: 'sub/AGENTS.md' }],
    })).toEqual({ role: 'inject', label: 'AGENTS.md, sub/AGENTS.md' })
  })

  it('marks a session reference as recall and labels it by its references', () => {
    expect(contextProducer({
      kind: 'session-reference',
      references: [{ label: 'session-a' }, { label: 'session-b' }],
    })).toEqual({ role: 'recall', label: 'session-a, session-b' })
  })

  it('labels a skill invocation by its skill name', () => {
    expect(contextProducer({ kind: 'skill-invocation', name: 'genui' }))
      .toEqual({ role: 'inject', label: 'genui' })
  })

  it('falls back to the durable kind for an unknown producer', () => {
    // MessageSourceMap 是 merge-extensible 的：不认识的来源按 kind 露出，不吞。
    expect(contextProducer({ kind: 'runtime-context', form: 'snapshot' }))
      .toEqual({ role: 'inject', label: 'runtime-context' })
  })

  it('reports no label when the source is not an object', () => {
    expect(contextProducer(null)).toEqual({ role: 'inject', label: null })
  })
})

describe('contextForm', () => {
  it('accepts every form the official table knows', () => {
    for (const form of ['instructions', 'catalog', 'snapshot', 'notice', 'relay', 'recall']) {
      expect(contextForm({ kind: 'x', form })).toBe(form)
    }
  })

  it('drops a form outside the table', () => {
    expect(contextForm({ kind: 'x', form: 'brand-new' })).toBeNull()
  })

  it('returns null when no form is declared', () => {
    expect(contextForm({ kind: 'x' })).toBeNull()
  })
})

describe('injectedContextState', () => {
  it('projects one injected event into render fields', () => {
    const state = injectedContextState(injection({
      kind: 'runtime-context',
      form: 'snapshot',
      sections: [],
    }) as never)
    expect(state.seq).toBe(10)
    expect(state.time).toBe(1_790_791_331_517)
    expect(state.content).toHaveLength(1)
    expect(state.producer).toEqual({ role: 'inject', label: 'runtime-context' })
    expect(state.form).toBe('snapshot')
  })

  it('treats a non-array content as empty rather than throwing', () => {
    const event = injection({ kind: 'runtime-context' })
    ;(event['data'] as Record<string, unknown>)['content'] = null
    expect(injectedContextState(event as never).content).toEqual([])
  })
})
