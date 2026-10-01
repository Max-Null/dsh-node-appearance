import { describe, expect, it } from 'vitest'
import { parseSkillContent, skillModel, skillName } from '../src/client/skill-model.ts'

/** 一份 `renderSkillContent` 的精确形状（照 dsh-skill 的实现拼）。 */
function renderSkill(name: string, resources: string, body: string): string {
  return [
    `<skill_content name="${name}">`,
    '<skill_resources>',
    resources,
    '</skill_resources>',
    '',
    '<skill_instructions>',
    body,
    '</skill_instructions>',
    '</skill_content>',
  ].join('\n')
}

/** 已结算的调用块。 */
function settled(argsRaw: string, output: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'tool-result',
    callId: 'call-1',
    call: { argsRaw },
    content: [{ type: 'text', text: output }],
    ...overrides,
  }
}

describe('parseSkillContent', () => {
  it('splits the canonical block into its resources and instructions', () => {
    const block = renderSkill(
      'ssid-plugin-release',
      'Base directory for this skill: C:\\Users\\MaxNull\\.dsh\\skills\\ssid-plugin-release\nLoad referenced resources only as needed.',
      '# 插件收尾与发布\n\n正文第一段。',
    )
    expect(parseSkillContent(block)).toEqual({
      resources: 'Base directory for this skill: C:\\Users\\MaxNull\\.dsh\\skills\\ssid-plugin-release\nLoad referenced resources only as needed.',
      instructions: '# 插件收尾与发布\n\n正文第一段。',
    })
  })

  it('keeps a closing tag that appears verbatim inside the body', () => {
    // 官方测试里就有这种用例：正文可以原样包含标签字面量。
    const block = renderSkill('x', 'Resources: runtime memory', 'Keep </skill_instructions> and <tags> as-is.')
    expect(parseSkillContent(block)?.instructions).toBe('Keep </skill_instructions> and <tags> as-is.')
  })

  it('accepts a trailing blank line after the closing tag', () => {
    expect(parseSkillContent(`${renderSkill('x', 'r', 'b')}\n`)?.instructions).toBe('b')
  })

  it('returns null when the head is not the canonical opening tag', () => {
    expect(parseSkillContent('plain text result')).toBeNull()
    expect(parseSkillContent('<skill_content name="x">\nno resources here')).toBeNull()
  })

  it('returns null when a section is missing', () => {
    const missingInstructions = [
      '<skill_content name="x">',
      '<skill_resources>',
      'r',
      '</skill_resources>',
      '</skill_content>',
    ].join('\n')
    expect(parseSkillContent(missingInstructions)).toBeNull()
  })

  it('returns null when the closing shape differs', () => {
    const block = renderSkill('x', 'r', 'b').replace('</skill_content>', '</skill_content_typo>')
    expect(parseSkillContent(block)).toBeNull()
  })

  it('returns null for an empty output', () => {
    expect(parseSkillContent('')).toBeNull()
  })
})

describe('skillName', () => {
  it('reads the name from the call arguments', () => {
    expect(skillName('{"name":"ssid-release"}', 'call-1')).toBe('ssid-release')
  })

  it('falls back to the first line of a truncated JSON prefix', () => {
    expect(skillName('{"name":"ssid-rel', 'call-1')).toBe('{"name":"ssid-rel')
  })

  it('falls back to the call id when there are no arguments', () => {
    expect(skillName('', 'call-9')).toBe('call-9')
  })
})

describe('skillModel', () => {
  it('reports running while the call has not settled', () => {
    const model = skillModel({ argsRaw: '{"name":"demo"}', callId: 'c' })
    expect(model.state).toBe('running')
    expect(model.expandable).toBe(false)
    expect(model.name).toBe('demo')
  })

  it('peels the shell on a settled result', () => {
    const model = skillModel(settled('{"name":"demo"}', renderSkill('demo', 'Resource base: /s', '正文')) as never)
    expect(model.state).toBe('ok')
    expect(model.parsed).toBe(true)
    expect(model.instructions).toBe('正文')
    expect(model.resources).toBe('Resource base: /s')
  })

  it('keeps the raw output when the shape does not match, so the row is never blank', () => {
    const model = skillModel(settled('{"name":"demo"}', 'not a skill block') as never)
    expect(model.parsed).toBe(false)
    expect(model.raw).toBe('not a skill block')
    expect(model.expandable).toBe(true)
  })

  it('maps an interrupted call to stopped', () => {
    const model = skillModel(settled('{"name":"demo"}', '', { error: { code: 'interrupted' } }) as never)
    expect(model.state).toBe('stopped')
  })

  it('maps a failure to error and keeps its first line as the summary', () => {
    const model = skillModel(settled('{"name":"demo"}', 'SkillError: missing resource\nmore', { isError: true }) as never)
    expect(model.state).toBe('error')
    expect(model.errorSummary).toBe('SkillError: missing resource')
  })
})
