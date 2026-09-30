/**
 * Unit tests for the palette/CSS generator — the plugin's core pure logic.
 */

import { describe, expect, it } from 'vitest'
import {
  buildCss, DEFAULT_COLORS, isCssColor, PROCESS_ACTIVITIES, resolveColors, TOOL_CATEGORIES,
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

  it('gives the presented-files row its own deliver accent', () => {
    // 交付行有独立类别：与 file（read/write）共用绿色时，本轮生成的文件与交付的文件同屏分不清。
    expect(TOOL_CATEGORIES.deliver).toEqual(['present'])
    expect(TOOL_CATEGORIES.file).not.toContain('present')
    expect(buildCss({})).toContain(`[data-tool="present"] { --ncolor-accent: ${DEFAULT_COLORS.deliver}; }`)
    expect(DEFAULT_COLORS.deliver).not.toBe(DEFAULT_COLORS.file)
  })

  it('paints command nodes, Think rows, and context rows', () => {
    const css = buildCss({})
    expect(css).toContain(`[data-chat-flow-kind="command"] { --ncolor-accent: ${DEFAULT_COLORS.command}; }`)
    expect(css).toContain(`[data-variant="think"] { --ncolor-accent: ${DEFAULT_COLORS.thinking}; }`)
    expect(css).toContain(`[data-chat-flow-kind="context"] { --ncolor-accent: ${DEFAULT_COLORS.context}; }`)
  })

  it('paints a collapsed Turn summary bar on its hairline, not with a rail', () => {
    // Turn 级摘要条（「已完成工作 · 用时 35 秒」）在内核里是**整行宽的分节线**
    // （`padding: 0` + 底部发丝线），不是块状行。套块状行的 rail 会紧贴文字，
    // 而补偿用的 3px 内缩又让它与上下所有行错位（2026-09-29 用户反馈）。
    // 所以它把类别色取在**内核本来就画的那条底线上**，不加轨、不内缩。
    const css = buildCss({})
    expect(css).toContain(`[data-turn-process]:not([data-open]) { --ncolor-accent: ${DEFAULT_COLORS.summary}; }`)
    const rule = css.match(/\[data-turn-process\]:not\(\[data-open\]\) \{\n([^}]*)\}/)
    expect(rule).not.toBeNull()
    expect(rule?.[1]).toContain('border-bottom-color: var(--ncolor-accent);')
    expect(rule?.[1]).toContain('color-mix(in srgb, var(--ncolor-accent) 8%, transparent)')
    expect(rule?.[1]).not.toContain('box-shadow')
    expect(rule?.[1]).not.toContain('padding-left')
    // 成员展开时不涂：它们各自带色，容器再涂就是两层色块叠在一起。
    expect(css).not.toContain('[data-turn-process] {')
  })

  it('follows a configured summary color', () => {
    const css = buildCss({ colors: { summary: '#010203' } })
    expect(css).toContain(`[data-turn-process]:not([data-open]) { --ncolor-accent: #010203; }`)
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

  it('hides the restored injection rows only when showContextInjection is false', () => {
    expect(buildCss({})).not.toContain('context-injection"] { display: none')
    expect(buildCss({ showContextInjection: true })).not.toContain('context-injection"] { display: none')
    expect(buildCss({ showContextInjection: false }))
      .toContain(`[data-chat-flow-kind="context-injection"] { display: none !important; }`)
  })

  it('paints the official and the restored injection rows with one context color', () => {
    // 0.2.0 起官方那条 context 行不再渲染，配色要靠本插件自己的 kind 接住；
    // 两个选择器同色，恢复出来的行才与它在同一条视觉轴上。
    const css = buildCss({})
    expect(css).toContain(`[data-chat-flow-kind="context"] { --ncolor-accent: ${DEFAULT_COLORS.context}; }`)
    expect(css).toContain(`[data-chat-flow-kind="context-injection"] { --ncolor-accent: ${DEFAULT_COLORS.context}; }`)
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

  it('declares the unlisted-tool fallback before category rules so categories win the cascade', () => {
    // The fallback `[data-chat-flow-kind="tool-call"] [data-tool]` and a
    // category rule `… [data-tool="web_search"]` carry equal specificity (two
    // attribute selectors each); of two conflicting declarations the later
    // one wins. A fallback emitted after the category rules would override
    // every category color, which shipped in v0.1.0 as "everything gray".
    const css = buildCss({})
    const fallbackAt = css.indexOf('[data-chat-flow-kind="tool-call"] [data-tool] {')
    const categoryAt = css.indexOf('[data-tool="web_search"] {')
    expect(categoryAt).toBeGreaterThan(fallbackAt)
    expect(fallbackAt).toBeGreaterThanOrEqual(0)
  })

  it('resolves a missing context color from defaults (old stored sections)', () => {
    const colors = resolveColors({ colors: { search: '#111111' } })
    expect(colors.context).toBe(DEFAULT_COLORS.context)
  })

  it('handles undefined settings', () => {
    expect(buildCss(undefined)).toContain(`--ncolor-accent: ${DEFAULT_COLORS.search}`)
  })
})

describe('step-process group headers', () => {
  // 收起态的组头（「已读取文件并执行了命令」）是内核把一串工具调用折成的一行，
  // 颜色取自内核在 data-process-activity 上给出的类别，而不是解析标题文本。
  const collapsed = (activity?: string): string =>
    `[data-step-process] [data-process-activity${activity === undefined ? '' : `="${activity}"`}][aria-expanded="false"]`

  it('paints a collapsed header with its activity category color', () => {
    const css = buildCss({})
    for (const [activity, category] of Object.entries(PROCESS_ACTIVITIES)) {
      expect(css).toContain(`${collapsed(activity)} { --ncolor-accent: ${DEFAULT_COLORS[category]}; }`)
    }
  })

  it('maps code search to the file category, not the web search category', () => {
    // 组头的 `search` 指 grep/glob（file 类别），`webSearch`/`webFetch` 才是联网。
    // 两者混同会让「已搜索代码」与「已搜索网页」同色。
    expect(PROCESS_ACTIVITIES.search).toBe('file')
    expect(PROCESS_ACTIVITIES.webSearch).toBe('search')
    expect(collapsed('search')).not.toBe(collapsed('webSearch'))
  })

  it('falls back to the other color for an activity this build does not know', () => {
    // 内核新增类别时映射表不会报错（TypeScript 只保证本表的 key 全覆盖），
    // 兜底让新类别仍有颜色，而不是让 --ncolor-accent 缺失、涂色声明整条失效。
    expect(buildCss({})).toContain(`${collapsed()} { --ncolor-accent: ${DEFAULT_COLORS.other}; }`)
  })

  it('declares the general fallback before the mappings so mappings win the cascade', () => {
    // `[attr]` 与 `[attr="value"]` 的特异性完全相等（各算一个属性选择器），
    // 所以具名规则不是"压过"兜底，而是"后声明"赢。兜底一旦挪到后面，
    // 所有组头都会变灰 —— 与 unlisted-tool 兜底同一机制、同一个坑。
    const css = buildCss({})
    const fallbackAt = css.indexOf(`${collapsed()} {`)
    const namedAt = css.indexOf(`${collapsed('read')} {`)
    expect(fallbackAt).toBeGreaterThanOrEqual(0)
    expect(namedAt).toBeGreaterThan(fallbackAt)
  })

  it('follows configured category colors', () => {
    // 组头复用既有 colors 配置，不引入新的设置字段。
    const css = buildCss({ colors: { file: '#ff0000' } })
    expect(css).toContain(`${collapsed('read')} { --ncolor-accent: #ff0000; }`)
    expect(css).toContain(`${collapsed('commands')} { --ncolor-accent: ${DEFAULT_COLORS.execute}; }`)
  })

  it('keeps the collapsed header inside the shared rail + wash paint rule', () => {
    const css = buildCss({})
    const paintAt = css.indexOf('box-shadow: inset 3px 0 0 var(--ncolor-accent);')
    expect(paintAt).toBeGreaterThanOrEqual(0)
    // 涂色规则的联合选择器里必须含组头，否则颜色赋了也没人读。
    const ruleHead = css.slice(0, paintAt)
    expect(ruleHead).toContain(collapsed())
  })

  it('does not paint an expanded header and holds its position', () => {
    const css = buildCss({})
    const open = '[data-step-process] [data-process-activity][aria-expanded="true"]'
    // 展开后成员行各自带色，组头让位；但内距要留着，否则开合时组头横移。
    expect(css).toContain(`${open} { padding-left: 8px; }`)
    // 只出现这一次：若它落进涂色联合选择器，就会出现第二次。
    expect(css.split(open).length - 1).toBe(1)
  })

  it('gives the group header rail more air than a tool row, declared after the shared rule', () => {
    // 组头以图标起头，共享的 3px 会让轨贴住图标（看着像一道杂线）。
    // 覆盖必须排在共享涂色规则**之后** —— 两者同特异性，后写的赢；
    // 挪到前面就会被共享规则的 3px 盖回去，且不会有任何报错。
    const css = buildCss({})
    const sharedAt = css.indexOf('box-shadow: inset 3px 0 0 var(--ncolor-accent);')
    const headerPadAt = css.indexOf(`${collapsed()} { padding-left: 8px; }`)
    expect(sharedAt).toBeGreaterThanOrEqual(0)
    expect(headerPadAt).toBeGreaterThan(sharedAt)
  })
})
