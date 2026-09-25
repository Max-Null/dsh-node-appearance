/**
 * Unit tests for the Host-half Config schema: defaults must produce the
 * complete initial palette and switch, so the browser half always has a
 * coherent section even when the user document is empty.
 */

import { describe, expect, it } from 'vitest'
import { Config, DEFAULT_COLORS, NODE_APPEARANCE_NS } from '../src/index.ts'

describe('Config schema', () => {
  // 0.1.7：可变字段用 `.volatile()` 声明，解析结果里它们是 `Volatile<T>` 包装，
  // 读值要经 `.get()`（见 `settings/src/schema.ts` 的 `plainConfig`：对 volatile
  // 值会先 `.get()` 再展开）。所以这里的断言都走 `.get()`。
  it('resolves the full initial palette from an empty entry', () => {
    // schemastery schemas are callable: schema(value) normalizes and defaults;
    // the value type is strict, so partial inputs are asserted (runtime is permissive).
    const parsed = Config({} as never)
    expect(parsed.showThinking.get()).toBe(true)
    expect(parsed.colors.get()).toEqual(DEFAULT_COLORS)
    expect(parsed.toolColors.get()).toEqual({})
  })

  it('accepts partial overrides and keeps the remaining defaults', () => {
    const parsed = Config({ colors: { search: '#ff0000' }, showThinking: false } as never)
    expect(parsed.colors.get().search).toBe('#ff0000')
    expect(parsed.colors.get().agent).toBe(DEFAULT_COLORS.agent)
    expect(parsed.showThinking.get()).toBe(false)
  })

  it('accepts tool color overrides', () => {
    const parsed = Config({ toolColors: { web_search: '#123456' } } as never)
    expect(parsed.toolColors.get()).toEqual({ web_search: '#123456' })
  })

  it('owns the documented namespace id', () => {
    // Branded: compare through String so the namespace contract stays spelled.
    expect(String(NODE_APPEARANCE_NS)).toBe('node-appearance')
  })
})
