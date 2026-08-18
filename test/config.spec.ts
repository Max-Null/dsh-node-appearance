/**
 * Unit tests for the Host-half Config schema: defaults must produce the
 * complete initial palette and switch, so the browser half always has a
 * coherent section even when the user document is empty.
 */

import { describe, expect, it } from 'vitest'
import { Config, DEFAULT_COLORS, NODE_APPEARANCE_NS } from '../src/index.ts'

describe('Config schema', () => {
  it('resolves the full initial palette from an empty entry', () => {
    // schemastery schemas are callable: schema(value) normalizes and defaults;
    // the value type is strict, so partial inputs are asserted (runtime is permissive).
    const parsed = Config({} as never)
    expect(parsed.showThinking).toBe(true)
    expect(parsed.colors).toEqual(DEFAULT_COLORS)
    expect(parsed.toolColors).toEqual({})
  })

  it('accepts partial overrides and keeps the remaining defaults', () => {
    const parsed = Config({ colors: { search: '#ff0000' }, showThinking: false } as never)
    expect(parsed.colors.search).toBe('#ff0000')
    expect(parsed.colors.agent).toBe(DEFAULT_COLORS.agent)
    expect(parsed.showThinking).toBe(false)
  })

  it('accepts tool color overrides', () => {
    const parsed = Config({ toolColors: { web_search: '#123456' } } as never)
    expect(parsed.toolColors).toEqual({ web_search: '#123456' })
  })

  it('owns the documented namespace id', () => {
    // Branded: compare through String so the namespace contract stays spelled.
    expect(String(NODE_APPEARANCE_NS)).toBe('node-appearance')
  })
})
