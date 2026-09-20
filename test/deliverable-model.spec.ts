/**
 * 交付行派生逻辑的单测：文件名清单还原、折叠摘要、四态判定与各条降级路径。
 *
 * 接管官方交付行后这些派生就是唯一的渲染来源，所以畸形输入（流式中的半截
 * JSON、空 files、只有错误没有结果文本）都必须有确定的输出，而不是空白。
 */

import { describe, expect, it } from 'vitest'
import { deliverableModel, type DeliverableBlock } from '../src/client/deliverable-model.ts'

/** 造一个已结算的结果节点（结构照 DSH 的 ToolResultNode）。 */
function settled(
  argsRaw: string,
  content: ReadonlyArray<{ type: string, text?: string }> = [],
  extra: Record<string, unknown> = {},
) {
  return { kind: 'tool-result', callId: 'call-1', call: { argsRaw }, content, isError: false, ...extra }
}

/** 造一个尚未结算的调用（参数还在流式输出）。 */
function running(argsRaw: string): DeliverableBlock {
  return { argsRaw }
}

/** 造一份 present 参数。 */
function args(...paths: string[]): string {
  return JSON.stringify({ files: paths.map(path => ({ path })) })
}

const ONE = args('H:\\MaxNull\\WorkStation\\README.md')
const THREE = args(
  'H:\\MaxNull\\WorkStation\\a.ts',
  'H:\\MaxNull\\WorkStation\\b.ts',
  'H:\\MaxNull\\WorkStation\\c.ts',
)

describe('折叠摘要', () => {
  it('reports the bare file name for a single delivery', () => {
    expect(deliverableModel(settled(ONE)).summary).toBe('README.md')
  })

  it('collapses many files to the first name plus a count', () => {
    expect(deliverableModel(settled(THREE)).summary).toBe('a.ts 等 3 个文件')
  })

  it('falls back to the raw arguments while the call is still streaming', () => {
    // 半截 JSON：官方做法同样是原样显示参数文本，而不是当成「零个文件」。
    const partial = '{"files":[{"path":"H:\\\\a'
    const model = deliverableModel(running(partial))
    expect(model.summary).toBe(partial)
    expect(model.files).toEqual([])
  })

  it('never shows the raw arguments for an empty file list', () => {
    expect(deliverableModel(settled(args())).summary).toBe('')
  })
})

describe('文件行拆分', () => {
  it('splits name from directory on Windows separators', () => {
    expect(deliverableModel(settled(ONE)).files[0]).toEqual({
      path: 'H:\\MaxNull\\WorkStation\\README.md',
      name: 'README.md',
      dir: 'H:\\MaxNull\\WorkStation',
      badge: 'MD',
    })
  })

  it('splits on forward slashes too', () => {
    const model = deliverableModel(settled(args('/home/me/notes/a.txt')))
    expect(model.files[0]?.dir).toBe('/home/me/notes')
    expect(model.files[0]?.name).toBe('a.txt')
    expect(model.files[0]?.badge).toBe('TXT')
  })

  it('leaves the directory empty for a bare file name', () => {
    expect(deliverableModel(settled(args('a.ts'))).files[0]?.dir).toBe('')
  })

  it('truncates an over-long extension for the badge', () => {
    expect(deliverableModel(settled(args('a.markdown'))).files[0]?.badge).toBe('MARK')
  })

  it('has no badge without a usable extension', () => {
    // 末尾的点是文件名的一部分，不是扩展名；点开头的隐藏文件同理。
    expect(deliverableModel(settled(args('a.'))).files[0]?.badge).toBeNull()
    expect(deliverableModel(settled(args('.gitignore'))).files[0]?.badge).toBeNull()
    expect(deliverableModel(settled(args('Makefile'))).files[0]?.badge).toBeNull()
  })

  it('keeps every file in argument order', () => {
    expect(deliverableModel(settled(THREE)).files.map(file => file.name)).toEqual(['a.ts', 'b.ts', 'c.ts'])
  })

  it('skips entries without a string path', () => {
    const model = deliverableModel(settled(JSON.stringify({ files: [{ path: 'a.ts' }, {}, { path: 7 }, 'x'] })))
    expect(model.files.map(file => file.name)).toEqual(['a.ts'])
    // 摘要按**可用的**条目数报，无效条目不计入。
    expect(model.summary).toBe('a.ts')
  })
})

describe('四态判定', () => {
  it('is running before the call settles', () => {
    expect(deliverableModel(running(ONE)).state).toBe('running')
  })

  it('is ok once settled without an error', () => {
    expect(deliverableModel(settled(ONE)).state).toBe('ok')
  })

  it('reports an interrupted call as stopped, not failed', () => {
    const model = deliverableModel(settled(ONE, [], { error: { name: 'AbortError', code: 'interrupted' } }))
    expect(model.state).toBe('stopped')
  })

  it('reports a failed call as error', () => {
    expect(deliverableModel(settled(ONE, [], { isError: true })).state).toBe('error')
  })
})

describe('结果文本', () => {
  it('joins text parts and counts the lines', () => {
    const model = deliverableModel(settled(ONE, [{ type: 'text', text: '第一行\n第二行' }]))
    expect(model.details).toBe('第一行\n第二行')
    expect(model.lineCount).toBe(2)
  })

  it('stringifies non-text parts', () => {
    const model = deliverableModel(settled(ONE, [{ type: 'image', text: undefined }]))
    expect(model.details).toBe('{"type":"image"}')
  })

  it('falls back to the error description when there is no output', () => {
    const model = deliverableModel(settled(ONE, [], { isError: true, error: { name: 'EPERM', code: 'EACCES' } }))
    expect(model.details).toBe('EPERM: EACCES')
    expect(model.lineCount).toBe(1)
  })

  it('omits a missing error code instead of printing undefined', () => {
    expect(deliverableModel(settled(ONE, [], { isError: true, error: { name: 'EPERM' } })).details).toBe('EPERM')
  })

  it('is empty when nothing was recorded', () => {
    const model = deliverableModel(settled(ONE))
    expect(model.details).toBe('')
    expect(model.lineCount).toBe(0)
  })
})

describe('可展开', () => {
  it('opens for the file list even without result text', () => {
    // 比官方宽：官方只在有结果文本时可展开，交付了文件却展不开就看不到清单。
    expect(deliverableModel(settled(ONE)).expandable).toBe(true)
  })

  it('opens for result text even without files', () => {
    const model = deliverableModel(settled('{"files":[]}', [{ type: 'text', text: 'ok' }]))
    expect(model.expandable).toBe(true)
  })

  it('stays shut when there is nothing to show', () => {
    expect(deliverableModel(settled(args())).expandable).toBe(false)
  })
})
