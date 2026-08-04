import { describe, it, expect } from 'vitest'
import {
  advance,
  dispelWindowStart,
  markDispel,
  phaseEnd,
  startFailed,
  startInterval,
  startShield,
  upcomingEvents,
} from '#src/shield/engine'

// 測試自己的固定參數：狀態機與產品預設值無關，改預設不該弄壞這裡
const P = { shieldDuration: 25, interval: 20, dispelDuration: 5 }
const T0 = 1_000_000 // 任意基準 ms

describe('階段轉換', () => {
  it('反盾 25 秒後自動進入間隔', () => {
    const s = startShield(T0)
    expect(phaseEnd(s, P)).toBe(T0 + 25_000)
    const next = advance(s, T0 + 25_000, P)
    expect(next.phase).toBe('interval')
    expect(next.phaseStart).toBe(T0 + 25_000)
  })

  it('間隔結束無魔消 → 反盾開始', () => {
    const s = startInterval(T0)
    const next = advance(s, T0 + 20_000, P)
    expect(next.phase).toBe('shield')
  })

  it('間隔結束有有效魔消 → 反盾失敗，失敗 25 秒後回間隔', () => {
    let s = startInterval(T0)
    s = markDispel(s, T0 + 16_000, P).state
    const failed = advance(s, T0 + 20_000, P)
    expect(failed.phase).toBe('failed')
    const backToInterval = advance(failed, T0 + 20_000 + 25_000, P)
    expect(backToInterval.phase).toBe('interval')
  })

  it('跨多段自動推進（反盾→間隔→無魔消→反盾）', () => {
    const s = startShield(T0)
    const next = advance(s, T0 + 25_000 + 20_000 + 3_000, P)
    expect(next.phase).toBe('shield')
    expect(next.phaseStart).toBe(T0 + 45_000)
  })

  it('校準按鈕立即切換階段', () => {
    expect(startShield(T0).phase).toBe('shield')
    expect(startInterval(T0).phase).toBe('interval')
    expect(startFailed(T0).phase).toBe('failed')
  })
})

describe('魔消驗證', () => {
  it('有效窗＝間隔最後「魔消持續」秒（第 15 秒起）', () => {
    expect(dispelWindowStart(P)).toBe(15)
    const s = startInterval(T0)
    expect(markDispel(s, T0 + 14_900, P).result).toBe('tooEarly')
    expect(markDispel(s, T0 + 15_000, P).result).toBe('valid')
    expect(markDispel(s, T0 + 19_900, P).result).toBe('valid')
  })

  it('非間隔階段點魔消無效', () => {
    expect(markDispel(startShield(T0), T0 + 16_000, P).result).toBe('wrongPhase')
    expect(markDispel(startFailed(T0), T0 + 16_000, P).result).toBe('wrongPhase')
  })

  it('tooEarly 不會標記 dispelValid', () => {
    const s = startInterval(T0)
    const { state } = markDispel(s, T0 + 5_000, P)
    expect(state.dispelValid).toBe(false)
    expect(advance(state, T0 + 20_000, P).phase).toBe('shield')
  })
})

describe('未來事件表', () => {
  it('反盾中：結束→魔消提醒→（無魔消）反盾開始', () => {
    const s = startShield(T0)
    const events = upcomingEvents(s, P, T0, 3)
    expect(events.map((e) => e.label)).toEqual([
      '反盾結束（可輸出）',
      '使用魔消！',
      '反盾開始（禁止輸出）',
    ])
    expect(events[0].at).toBe(T0 + 25_000)
    expect(events[1].at).toBe(T0 + 25_000 + 15_000)
    expect(events[2].at).toBe(T0 + 45_000)
  })

  it('已標記魔消：間隔結束顯示反盾失敗，之後接預定結束與下一輪', () => {
    let s = startInterval(T0)
    s = markDispel(s, T0 + 16_000, P).state
    const events = upcomingEvents(s, P, T0 + 16_000, 3)
    expect(events.map((e) => e.label)).toEqual([
      '反盾失敗開始（可輸出）',
      '反盾預定結束（間隔開始）',
      '使用魔消！',
    ])
  })

  it('已過的魔消提醒不列出', () => {
    const s = startInterval(T0)
    const events = upcomingEvents(s, P, T0 + 16_000, 2)
    expect(events[0].label).toBe('反盾開始（禁止輸出）')
  })
})
