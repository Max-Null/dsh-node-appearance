/**
 * 目标折行的单测：分条要断、不该断的不能断、没有圈号时逐字不动。
 *
 * 这条纯函数只服务展示层，最坏后果是「多折了一行」，所以用例的重点不是穷举
 * 中文排版，而是钉住三件事：不动原文、不留空行、没圈号就原样返回。
 */

import { describe, expect, it } from 'vitest'
import { objectiveLines } from '../src/client/objective.ts'

describe('objectiveLines', () => {
  it('在圈号前断行', () => {
    expect(objectiveLines('做三件事：① 甲；② 乙；③ 丙')).toBe('做三件事：\n① 甲；\n② 乙；\n③ 丙')
  })

  it('圈号前没有空格也能断', () => {
    expect(objectiveLines('甲①乙②丙')).toBe('甲\n①乙\n②丙')
  })

  it('本来就在行首的圈号不留空行', () => {
    expect(objectiveLines('① 甲\n② 乙')).toBe('① 甲\n② 乙')
  })

  it('圈号前多余的空白不残留', () => {
    expect(objectiveLines('甲   \t ① 乙')).toBe('甲\n① 乙')
  })

  it('没有圈号时逐字返回原串（连多点空格也不动）', () => {
    const plain = '一条没有分条的目标，  双空格也保留。'
    expect(objectiveLines(plain)).toBe(plain)
  })

  it('不碰圆圈以外的编号写法', () => {
    // `1.` / `(2)` / `一、` 都不是本函数的判据范围 —— 保持原样，别自作主张。
    const other = '1. 甲 (2) 乙 三、丙'
    expect(objectiveLines(other)).toBe(other)
  })

  it('支持到 ⑳，且不改动圈号本身', () => {
    expect(objectiveLines('⑲ 甲 ⑳ 乙')).toBe('⑲ 甲\n⑳ 乙')
  })

  it('空串返回空串', () => {
    expect(objectiveLines('')).toBe('')
  })
})
