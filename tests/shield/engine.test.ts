import { describe, it, expect } from 'vitest'
import {
  advance,
  dispelWindowStart,
  markDispel,
  phaseDuration,
  phaseEnd,
  resistRemaining,
  cooldownRemaining,
  IDLE,
  startBlocked,
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

  it('間隔結束有有效魔消 → 反盾被阻止，25 秒後回間隔', () => {
    let s = startInterval(T0)
    s = markDispel(s, T0 + 16_000, P).state
    const blocked = advance(s, T0 + 20_000, P)
    expect(blocked.phase).toBe('blocked')
    const backToInterval = advance(blocked, T0 + 20_000 + 25_000, P)
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
    expect(startBlocked(T0).phase).toBe('blocked')
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
    expect(markDispel(startBlocked(T0), T0 + 16_000, P).result).toBe('wrongPhase')
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

  it('已標記魔消：間隔結束顯示反盾阻止成功，之後接預定結束與下一輪', () => {
    let s = startInterval(T0)
    s = markDispel(s, T0 + 16_000, P).state
    const events = upcomingEvents(s, P, T0 + 16_000, 3)
    // 第三個不是「使用魔消！」——剛放過，下一輪那個時間點還在 80 秒耐性內
    expect(events.map((e) => e.label)).toEqual([
      '反盾阻止成功（可輸出）',
      '反盾預定結束（間隔開始）',
      '反盾開始（禁止輸出）',
    ])
  })

  it('已過的魔消提醒不列出', () => {
    const s = startInterval(T0)
    const events = upcomingEvents(s, P, T0 + 16_000, 2)
    expect(events[0].label).toBe('反盾開始（禁止輸出）')
  })
})

describe('反盾間隔浮動', () => {
  // 反盾可能延到 間隔+浮動 才重施，buff 要撐到最晚那一刻才擋得住
  it('有效窗起點用「間隔＋浮動」往回推', () => {
    expect(dispelWindowStart({ shieldDuration: 25, interval: 20, dispelDuration: 20, intervalFloat: 3 })).toBe(3)
  })

  it('沒有浮動時維持原本的算法', () => {
    expect(dispelWindowStart({ shieldDuration: 20, interval: 25, dispelDuration: 20 })).toBe(5)
  })

  it('持續時間長到蓋過整段間隔時起點是 0，不會變負數', () => {
    expect(dispelWindowStart({ shieldDuration: 25, interval: 20, dispelDuration: 60, intervalFloat: 3 })).toBe(0)
  })

  it('浮動不影響階段長度——可輸出時間仍以間隔本身為準', () => {
    const p = { shieldDuration: 25, interval: 20, dispelDuration: 20, intervalFloat: 3 }
    expect(phaseDuration('interval', p)).toBe(20)
    const s = startInterval(T0)
    expect(phaseEnd(s, p)).toBe(T0 + 20_000)
    expect(advance(s, T0 + 20_000, p).phase).toBe('shield')
  })
})

describe('魔消耐性與冷卻', () => {
  const P2 = { shieldDuration: 25, interval: 20, dispelDuration: 20, intervalFloat: 3 }

  it('沒有魔消紀錄時兩者都是 0', () => {
    expect(resistRemaining(IDLE, T0)).toBe(0)
    expect(cooldownRemaining(IDLE, T0)).toBe(0)
  })

  it('標記魔消後記住施放時刻', () => {
    const s = startInterval(T0)
    const { state } = markDispel(s, T0 + 5_000, P2)
    expect(state.lastDispelAt).toBe(T0 + 5_000)
  })

  it('耐性從施放當下起算 80 秒', () => {
    const s = { ...startInterval(T0), lastDispelAt: T0 }
    expect(resistRemaining(s, T0)).toBe(80)
    expect(resistRemaining(s, T0 + 30_000)).toBe(50)
    expect(resistRemaining(s, T0 + 80_000)).toBe(0)
    expect(resistRemaining(s, T0 + 999_000)).toBe(0)
  })

  it('冷卻從施放當下起算 60 秒，一定比耐性早結束', () => {
    const s = { ...startInterval(T0), lastDispelAt: T0 }
    expect(cooldownRemaining(s, T0)).toBe(60)
    expect(cooldownRemaining(s, T0 + 60_000)).toBe(0)
    // 冷卻歸零時耐性還剩 20 秒——真正的節流是耐性
    expect(resistRemaining(s, T0 + 60_000)).toBe(20)
  })

  it('耐性中仍可標記魔消：按錯了要能改回來，程式不擋人', () => {
    const s = { ...startInterval(T0), lastDispelAt: T0 - 10_000 }
    const { state, result } = markDispel(s, T0 + 19_000, P2)
    expect(result).toBe('valid')
    expect(state.dispelValid).toBe(true)
    expect(state.lastDispelAt).toBe(T0 + 19_000)
  })

  it('重置會清掉魔消紀錄', () => {
    expect(IDLE.lastDispelAt).toBeUndefined()
  })
})

describe('事件表考慮耐性', () => {
  const P2 = { shieldDuration: 25, interval: 20, dispelDuration: 20, intervalFloat: 3 }

  it('耐性還在的輪次不提示使用魔消', () => {
    // 剛在間隔開始時放過，接下來這一輪（第 20 秒結束）整段都在耐性內
    const s = { ...startInterval(T0), lastDispelAt: T0 }
    const labels = upcomingEvents(s, P2, T0, 4).map((e) => e.label)
    expect(labels).not.toContain('使用魔消！')
  })

  it('耐性過了之後的輪次照常提示', () => {
    const s = { ...startInterval(T0), lastDispelAt: T0 - 100_000 }
    const labels = upcomingEvents(s, P2, T0, 4).map((e) => e.label)
    expect(labels).toContain('使用魔消！')
  })

  it('沒有魔消紀錄時每輪都提示', () => {
    const labels = upcomingEvents(startShield(T0), P2, T0, 6).map((e) => e.label)
    expect(labels.filter((l) => l === '使用魔消！').length).toBeGreaterThan(0)
  })
})
