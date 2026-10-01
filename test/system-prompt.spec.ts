import { describe, expect, it } from 'vitest'
import { SYSTEM_PROMPT_KIND, systemPromptDefinition } from '../src/client/system-prompt.ts'

/** 假 inspect：第一张卡是引入，之后一律按「更新」处理。 */
function fakeInspect(previous: unknown): unknown {
  return previous === undefined
    ? { introduced: { seq: 7, text: 'prompt text', update: false } }
    : { introduced: { seq: 9, text: 'prompt text v2', update: true } }
}

const noPrevious = { previous: () => undefined }

describe('systemPromptDefinition.match', () => {
  it('accepts only an appended system message', () => {
    const def = systemPromptDefinition(fakeInspect)
    expect(def.match({ type: 'system/message', surfaceOp: 'append', seq: 7 })).toEqual({ id: '7', role: 'start' })
  })

  it('rejects a system message without the append marker', () => {
    // 官方 `isAppendSurfaceEvent` 要求 surfaceOp 存在；替换副本属于模型可见面，
    // 人类转录要的是它自己的落点。
    const def = systemPromptDefinition(fakeInspect)
    expect(def.match({ type: 'system/message', seq: 7 })).toBeNull()
    expect(def.match({ type: 'system/message', surfaceOp: { op: 'replace', startSeq: 1, endSeq: 2 }, seq: 7 })).toBeNull()
  })

  it('rejects every other event type', () => {
    const def = systemPromptDefinition(fakeInspect)
    expect(def.match({ type: 'user/message', surfaceOp: 'append', seq: 7 })).toBeNull()
    expect(def.match({ type: 'request/header', seq: 7 })).toBeNull()
  })
})

describe('systemPromptDefinition.buildViewNode', () => {
  const location = { kind: 'session' }

  it('produces a visible card at the event position for the first prompt', () => {
    const def = systemPromptDefinition(fakeInspect)
    const state = def.start({}, { event: { seq: 7 }, location }, noPrevious)
    // 引擎的 Context 会带上 start（含 location）；漏了它，节点位置会退化成 unresolved。
    expect(def.buildViewNode({ key: 'key-1', id: 'id-1', state, start: { location } })).toEqual({
      key: 'key-1',
      kind: SYSTEM_PROMPT_KIND,
      id: 'id-1',
      target: 'chat',
      anchorSeq: 7,
      location,
      visibility: 'visible',
      data: { text: 'prompt text', update: false },
    })
  })

  it('marks a later prompt as an update at its own position', () => {
    const def = systemPromptDefinition(fakeInspect)
    const state = def.start({}, { event: { seq: 9 }, location }, { previous: () => ({ state: {} }) })
    const node = def.buildViewNode({ key: 'key-2', id: 'id-2', state }) as { anchorSeq: number, data: { update: boolean } }
    expect(node.anchorSeq).toBe(9)
    expect(node.data.update).toBe(true)
  })

  it('renders nothing for an empty dormant node', () => {
    // 官方同样不画空文本的卡（`state.text === ''` 时返回 null）——
    // 那是历史位置上的休眠节点，不是一张空卡。
    const def = systemPromptDefinition(() => ({ introduced: { seq: 7, text: '', update: false } }))
    const state = def.start({}, { event: { seq: 7 }, location }, noPrevious)
    expect(def.buildViewNode({ key: 'key-3', id: 'id-3', state })).toBeNull()
  })

  it('renders nothing before any state has been assembled', () => {
    const def = systemPromptDefinition(fakeInspect)
    expect(def.buildViewNode({ key: 'key-4', id: 'id-4', state: undefined })).toBeNull()
  })
})
