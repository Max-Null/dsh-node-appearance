/**
 * Unit tests for the palette/CSS generator — the plugin's core pure logic.
 */

import { describe, expect, it } from 'vitest'
import {
  buildCss, DEFAULT_COLORS, isCssColor, resolveColors, TOOL_CATEGORIES,
} from '../src/client/palette.ts'

describe('isCssColor', () => {
  it('accepts hex colors', () => {
    expect(isCssColor('#3b82f6')).toBe(true)
    expect(isCssColor('#abc')).toBe(true)
    expect(isCssColor('#a1b2c3dd')).toBe(true)
  })

  it('accepts color functions', () => {
    expect(isCssColor('rgb(1, 2, 3)')).toBe(true)
    expect(isCssColor('hsl(120 50% 50%)')).toBe(true)
    expect(isCssColor('oklch(0.7 0.1 250)')).toBe(true)
  })

  it('rejects empty and malformed values', () => {
    expect(isCssColor('')).toBe(false)
    expect(isCssColor('  ')).toBe(false)
    expect(isCssColor('not-a-color')).toBe(false)
    expect(isCssColor('#zzz')).toBe(false)
  })
})

describe('resolveColors', () => {
  it('returns defaults for an empty settings object', () => {
    expect(resolveColors({})).toEqual(DEFAULT_COLORS)
  })

  it('merges configured colors over defaults', () => {
    const colors = resolveColors({ colors: { search: '#ff0000' } })
    expect(colors.search).toBe('#ff0000')
    expect(colors.agent).toBe(DEFAULT_COLORS.agent)
  })

  it('ignores invalid configured colors', () => {
    const colors = resolveColors({ colors: { file: 'banana' as never } })
    expect(colors.file).toBe(DEFAULT_COLORS.file)
  })

  it('ignores a non-object colors field', () => {
    expect(resolveColors({ colors: 'red' as never }).search).toBe(DEFAULT_COLORS.search)
  })
})

describe('buildCss', () => {
  it('paints every shipped tool with its category color', () => {
    const css = buildCss({})
    for (const [category, tools] of Object.entries(TOOL_CATEGORIES)) {
      for (const tool of tools) {
        expect(css).toContain(`[data-tool="${tool}"] { --ncolor-accent: ${DEFAULT_COLORS[category as keyof typeof DEFAULT_COLORS]}; }`)
      }
    }
  })

  it('paints command nodes, Think rows, and context rows', () => {
    const css = buildCss({})
    expect(css).toContain(`[data-chat-flow-kind="command"] { --ncolor-accent: ${DEFAULT_COLORS.command}; }`)
    expect(css).toContain(`[data-variant="think"] { --ncolor-accent: ${DEFAULT_COLORS.thinking}; }`)
    expect(css).toContain(`[data-chat-flow-kind="context"] { --ncolor-accent: ${DEFAULT_COLORS.context}; }`)
  })

  it('emits the shared rail + wash paint rule with icon-safe padding', () => {
    const css = buildCss({})
    expect(css).toContain('box-shadow: inset 3px 0 0 var(--ncolor-accent);')
    expect(css).toContain('color-mix(in srgb, var(--ncolor-accent) 8%, transparent)')
    expect(css).toContain('padding-left: 3px;')
    // The paint targets the ToolRow root only, never its wrapper callRow.
    expect(css).toContain('[data-chat-flow-kind="tool-call"] [data-tool][data-variant]')
  })

  it('hides Think rows only when showThinking is false', () => {
    expect(buildCss({})).not.toContain('display: none')
    expect(buildCss({ showThinking: true })).not.toContain('display: none')
    // !important outranks the module stylesheet's same-specificity .root rule.
    expect(buildCss({ showThinking: false })).toContain(`[data-variant="think"] { display: none !important; }`)
  })

  it('gives explicit tool overrides priority over category colors', () => {
    const css = buildCss({ toolColors: { web_search: '#123456' } })
    expect(css).toContain(`[data-tool="web_search"] { --ncolor-accent: #123456; }`)
    expect(css).not.toContain(`[data-tool="web_search"] { --ncolor-accent: ${DEFAULT_COLORS.search}; }`)
  })

  it('ignores an invalid tool override and keeps the category color', () => {
    const css = buildCss({ toolColors: { web_search: 'oops' } })
    expect(css).toContain(`[data-tool="web_search"] { --ncolor-accent: ${DEFAULT_COLORS.search}; }`)
  })

  it('paints unlisted tools with the other color', () => {
    const css = buildCss({})
    expect(css).toContain(`[data-chat-flow-kind="tool-call"] [data-tool] { --ncolor-accent: ${DEFAULT_COLORS.other}; }`)
  })

  it('resolves a missing context color from defaults (old stored sections)', () => {
    const colors = resolveColors({ colors: { search: '#111111' } })
    expect(colors.context).toBe(DEFAULT_COLORS.context)
  })

  it('handles undefined settings', () => {
    expect(buildCss(undefined)).toContain(`--ncolor-accent: ${DEFAULT_COLORS.search}`)
  })
})
