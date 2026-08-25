import { describe, it, expect } from 'vitest'
import {
  secondsLeft,
  cyclesElapsed,
  nudgeClock,
  triggerAt,
  upcomingCycleEvents,
} from '#src/shield/cycle'

const T0 = 1_000_000
const sec = (n: number) => T0 + n * 1000

describe('循環倒數', () => {
  it('還沒按過觸發就沒有倒數', () => {
    expect(secondsLeft(undefined, 60, sec(30))).toBeNull()
  })

  it('剛觸發時是整個間隔', () => {
    expect(secondsLeft(T0, 60, T0)).toBe(60)
  })

  it('過一秒少一秒', () => {
    expect(secondsLeft(T0, 60, sec(1))).toBe(59)
    expect(secondsLeft(T0, 60, sec(59))).toBe(1)
  })

  it('到點自動接下一輪，不必再按', () => {
    expect(secondsLeft(T0, 60, sec(60))).toBe(60)
    expect(secondsLeft(T0, 60, sec(61))).toBe(59)
    expect(secondsLeft(T0, 60, sec(121))).toBe(59)
  })

  it('不同間隔各自算自己的', () => {
    expect(secondsLeft(T0, 90, sec(100))).toBe(80)
    expect(secondsLeft(T0, 80, sec(100))).toBe(60)
  })

  it('無條件進位到整秒——顯示 0 卻還沒到會誤導', () => {
    expect(secondsLeft(T0, 60, T0 + 59_500)).toBe(1)
  })
})

describe('已觸發輪數（響鈴用）', () => {
  it('未開始是 0', () => {
    expect(cyclesElapsed(undefined, 60, sec(600))).toBe(0)
  })

  it('第一輪還沒到是 0，到了就 1', () => {
    expect(cyclesElapsed(T0, 60, sec(59))).toBe(0)
    expect(cyclesElapsed(T0, 60, sec(60))).toBe(1)
    expect(cyclesElapsed(T0, 60, sec(119))).toBe(1)
    expect(cyclesElapsed(T0, 60, sec(120))).toBe(2)
  })
})

describe('觸發與微調', () => {
  it('按觸發＝從現在重數', () => {
    const clock = triggerAt(sec(35))
    expect(secondsLeft(clock, 60, sec(35))).toBe(60)
  })

  it('＋1 秒讓倒數多一秒，−1 秒少一秒', () => {
    expect(secondsLeft(nudgeClock(T0, 1), 60, sec(10))).toBe(51)
    expect(secondsLeft(nudgeClock(T0, -1), 60, sec(10))).toBe(49)
  })

  it('還沒開始的循環微調不了', () => {
    expect(nudgeClock(undefined, 1)).toBeUndefined()
  })
})

describe('接下來會觸發什麼', () => {
  const CYCLES = [
    { id: 'a', name: '活屍', interval: 60 },
    { id: 'b', name: '鎖潛能', interval: 90 },
  ]

  it('沒開始的機制不列進去', () => {
    expect(upcomingCycleEvents(CYCLES, { a: T0 }, T0, 3).every((e) => e.name === '活屍')).toBe(true)
  })

  it('依時間排序，混合不同間隔', () => {
    const list = upcomingCycleEvents(CYCLES, { a: T0, b: T0 }, T0, 4)
    expect(list.map((e) => [e.name, (e.at - T0) / 1000])).toEqual([
      ['活屍', 60],
      ['鎖潛能', 90],
      ['活屍', 120],
      ['活屍', 180],
    ])
  })

  it('只列現在之後的，過去的那幾輪跳過', () => {
    const list = upcomingCycleEvents(CYCLES, { a: T0 }, sec(130), 2)
    expect(list.map((e) => (e.at - T0) / 1000)).toEqual([180, 240])
  })

  it('全部都沒開始就是空的', () => {
    expect(upcomingCycleEvents(CYCLES, {}, T0)).toEqual([])
  })
})
