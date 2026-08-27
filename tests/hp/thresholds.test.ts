import { describe, it, expect } from 'vitest'
import { nextThreshold, crossedThresholds, thresholdState } from '#src/hp/thresholds'

const T = [80, 60, 40, 20]

describe('下一個門檻', () => {
  it('血量往下掉，下一個就是比現在低的那些裡最高的', () => {
    expect(nextThreshold(100, T)).toBe(80)
    expect(nextThreshold(80.1, T)).toBe(80)
    expect(nextThreshold(80, T)).toBe(60) // 剛好在門檻上，下一個是再下面那個
    expect(nextThreshold(35, T)).toBe(20)
  })

  it('全部過完就沒有下一個', () => {
    expect(nextThreshold(15, T)).toBeNull()
    expect(nextThreshold(0, T)).toBeNull()
  })
})

describe('這次跨過了哪些門檻', () => {
  it('掉過一個就抓到一個', () => {
    expect(crossedThresholds(81, 79, T)).toEqual([80])
  })

  it('一口氣掉很多要全部抓到，由高到低', () => {
    expect(crossedThresholds(85, 35, T)).toEqual([80, 60, 40])
  })

  it('剛好停在門檻上算跨過', () => {
    expect(crossedThresholds(81, 80, T)).toEqual([80])
  })

  it('血量沒掉（或回血）不算', () => {
    expect(crossedThresholds(79, 79, T)).toEqual([])
    expect(crossedThresholds(50, 70, T)).toEqual([])
  })
})

describe('要不要提醒', () => {
  it('進到門檻上方的提前量之內就先喊', () => {
    expect(thresholdState(84, T, 5).level).toBe('near')
    expect(thresholdState(85, T, 5).level).toBe('near')
    expect(thresholdState(86, T, 5).level).toBe('none')
  })

  it('剛跨過去的當下再確認一次', () => {
    expect(thresholdState(79, T, 5, true).level).toBe('hit')
  })

  it('提前量可以自己調', () => {
    expect(thresholdState(88, T, 10).level).toBe('near')
    expect(thresholdState(88, T, 5).level).toBe('none')
  })

  it('回報距離下一個門檻還有幾個百分點', () => {
    expect(thresholdState(83.5, T).gap).toBe(3.5)
    expect(thresholdState(83.5, T).next).toBe(80)
  })

  it('全部過完就沒有門檻也沒有提醒', () => {
    const s = thresholdState(10, T)
    expect(s.next).toBeNull()
    expect(s.gap).toBeNull()
    expect(s.level).toBe('none')
  })
})
