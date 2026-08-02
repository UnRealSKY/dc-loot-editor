import { describe, it, expect } from 'vitest'
import { fuzzyFilter, matchScore } from '#src/fuzzy'

const ITEMS = ['大師附加', '附加奇幻', '可疑附加', '大師附加碎片', '珍珠手杖(+4AD)', '神秘技能書']

describe('matchScore', () => {
  it('前綴 > 子字串 > 子序列 > 不符', () => {
    expect(matchScore('大師', '大師附加')).toBe(3)
    expect(matchScore('附加', '大師附加')).toBe(2)
    expect(matchScore('大附', '大師附加')).toBe(1)
    expect(matchScore('龍', '大師附加')).toBe(0)
  })
  it('英文不分大小寫', () => {
    expect(matchScore('4ad', '珍珠手杖(+4AD)')).toBe(2)
  })
})

describe('fuzzyFilter', () => {
  it('空查詢回傳前 N 筆（維持原順序）', () => {
    expect(fuzzyFilter('', ITEMS)).toEqual(ITEMS)
  })
  it('「附加」命中所有含附加者，前綴優先', () => {
    expect(fuzzyFilter('附加', ITEMS)).toEqual(['附加奇幻', '大師附加', '可疑附加', '大師附加碎片'])
  })
  it('「大附」以子序列命中大師附加', () => {
    expect(fuzzyFilter('大附', ITEMS)).toEqual(['大師附加', '大師附加碎片'])
  })
  it('同分維持原順序', () => {
    expect(fuzzyFilter('大師', ITEMS)).toEqual(['大師附加', '大師附加碎片'])
  })
  it('無符合回空陣列', () => {
    expect(fuzzyFilter('楓祝', ITEMS)).toEqual([])
  })
})
