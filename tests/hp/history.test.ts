import { describe, it, expect } from 'vitest'
import {
  pushPoint,
  recentDps,
  pushDps,
  peakDps,
  sameBar,
  MAX_POINTS,
  etaSeconds,
  type HpPoint,
} from '#src/hp/history'

const T0 = 1_000_000
const RED = '220,30,10'
const RED2 = '235,45,20' // 同一條血的明暗差異
const BLUE = '4,120,207' // 換階段／換王
const at = (sec: number, ratio: number, color: string | null = RED): HpPoint => ({
  t: T0 + sec * 1000,
  ratio,
  color,
})

describe('是不是同一條血', () => {
  it('色相接近就是同一條（血條本身有明暗漸層）', () => {
    expect(sameBar(RED, RED)).toBe(true)
    expect(sameBar(RED, RED2)).toBe(true)
  })

  it('換了色系就是換階段或換王', () => {
    expect(sameBar(RED, BLUE)).toBe(false)
  })

  it('沒有顏色資訊時只當兩邊都沒有才算同一條', () => {
    expect(sameBar(null, null)).toBe(true)
    expect(sameBar(RED, null)).toBe(false)
  })
})

describe('血量序列', () => {
  it('照順序累積', () => {
    let pts: HpPoint[] = []
    pts = pushPoint(pts, T0, 1, RED)
    pts = pushPoint(pts, T0 + 1000, 0.98, RED)
    expect(pts).toEqual([at(0, 1), at(1, 0.98)])
  })

  it('血量沒動時不重複堆點，只把最後那點往後移', () => {
    let pts = [at(0, 1), at(1, 1)]
    pts = pushPoint(pts, T0 + 2000, 1, RED)
    expect(pts).toEqual([at(0, 1), at(2, 1)])
  })

  it('換了血條顏色就算血量一樣也要留點——那是新的一條', () => {
    let pts = [at(0, 1), at(1, 1)]
    pts = pushPoint(pts, T0 + 2000, 1, BLUE)
    expect(pts).toHaveLength(3)
    expect(pts[2].color).toBe(BLUE)
  })

  it('超過上限丟最舊的', () => {
    let pts: HpPoint[] = []
    for (let i = 0; i < MAX_POINTS + 10; i++) pts = pushPoint(pts, T0 + i * 1000, 1 - i / 10000, RED)
    expect(pts.length).toBe(MAX_POINTS)
    expect(pts[0].t).toBeGreaterThan(T0)
  })
})

describe('輸出速度', () => {
  it('每秒掉幾個百分點', () => {
    expect(recentDps([at(0, 1), at(10, 0.8)])).toBeCloseTo(2, 5)
  })

  it('只看最近這段時間，前面打得快不算數', () => {
    const pts = [at(0, 1), at(100, 0.5), at(110, 0.49)]
    expect(recentDps(pts, 20_000)).toBeCloseTo(0.1, 5)
  })

  it('中間回血不倒扣，只累計掉的部分', () => {
    // 100 → 90（掉 10）→ 95（回 5，忽略）→ 85（掉 10）：20 秒掉了 20 個百分點
    const pts = [at(0, 1), at(5, 0.9), at(10, 0.95), at(20, 0.85)]
    expect(recentDps(pts, 30_000)).toBeCloseTo(1, 5)
  })

  it('整段都在回血時速度是 0，不會變負數', () => {
    expect(recentDps([at(0, 0.5), at(10, 0.7)])).toBe(0)
  })

  it('換階段（血條換色）之後只算新這條，不跨著算', () => {
    // 前一條打到剩 20% 之後換新的一條滿血，10 秒掉到 90%
    const pts = [at(0, 1, RED), at(30, 0.2, RED), at(31, 1, BLUE), at(41, 0.9, BLUE)]
    expect(recentDps(pts, 60_000)).toBeCloseTo(1, 5) // 只算 BLUE 那段
  })

  it('剛換色只有一個點時還算不出速度', () => {
    const pts = [at(0, 1, RED), at(30, 0.2, RED), at(31, 1, BLUE)]
    expect(recentDps(pts, 60_000)).toBeNull()
  })

  it('資料不夠就沒有速度', () => {
    expect(recentDps([])).toBeNull()
    expect(recentDps([at(0, 1)])).toBeNull()
  })
})

describe('峰值速度', () => {
  const samples = [
    { t: T0, dps: 1, color: RED },
    { t: T0 + 30_000, dps: 4.5, color: RED }, // 打得最順的時候
    { t: T0 + 90_000, dps: 0, color: RED }, // 機制停手
    { t: T0 + 100_000, dps: 2, color: RED },
  ]

  it('這條血的全程峰值', () => {
    expect(peakDps(samples)).toBe(4.5)
  })

  it('60 秒峰值只看最近這段——停手前的高點不算', () => {
    expect(peakDps(samples, 60_000)).toBe(2)
  })

  it('只算目前這條血的樣本，別的階段不混進來', () => {
    const mixed = [
      { t: T0, dps: 9, color: RED }, // 上一階段打得很快
      { t: T0 + 10_000, dps: 3, color: BLUE },
      { t: T0 + 20_000, dps: 1, color: BLUE },
    ]
    expect(peakDps(mixed, undefined, BLUE)).toBe(3)
    expect(peakDps(mixed, undefined, RED)).toBe(9)
  })

  it('沒有樣本就沒有峰值', () => {
    expect(peakDps([])).toBeNull()
  })

  it('剛換色還沒有這條血的樣本時，不拿舊階段的數字充數', () => {
    const old = [{ t: T0, dps: 9, color: RED }]
    expect(peakDps(old, undefined, BLUE)).toBeNull()
  })

  it('累積樣本時帶著顏色', () => {
    let s = pushDps([], T0, 1, RED)
    s = pushDps(s, T0 + 1000, 2, RED)
    expect(s).toEqual([
      { t: T0, dps: 1, color: RED },
      { t: T0 + 1000, dps: 2, color: RED },
    ])
  })
})

describe('預估倒數', () => {
  it('剩下的血除以目前的 DPS', () => {
    expect(etaSeconds(50, 2)).toBe(25)
    expect(etaSeconds(62.4, 1.8)).toBeCloseTo(34.7, 1)
  })

  it('沒在掉血就估不出來', () => {
    expect(etaSeconds(50, 0)).toBeNull()
    expect(etaSeconds(50, null)).toBeNull()
  })

  it('還沒讀到血量也估不出來', () => {
    expect(etaSeconds(null, 2)).toBeNull()
  })
})
