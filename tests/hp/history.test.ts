import { describe, it, expect } from 'vitest'
import { pushPoint, sparklinePoints, recentDps, MAX_POINTS, type HpPoint } from '#src/hp/history'

const T0 = 1_000_000
const at = (sec: number, ratio: number): HpPoint => ({ t: T0 + sec * 1000, ratio })

describe('血量曲線記錄', () => {
  it('照順序累積', () => {
    let pts: HpPoint[] = []
    pts = pushPoint(pts, T0, 1)
    pts = pushPoint(pts, T0 + 1000, 0.98)
    expect(pts).toEqual([at(0, 1), at(1, 0.98)])
  })

  it('血量沒動時不重複堆點，只把最後那點往後移', () => {
    let pts = [at(0, 1), at(1, 1)]
    pts = pushPoint(pts, T0 + 2000, 1)
    expect(pts).toEqual([at(0, 1), at(2, 1)])
  })

  it('血量一動就留下轉折點', () => {
    let pts = [at(0, 1), at(1, 1)]
    pts = pushPoint(pts, T0 + 2000, 0.9)
    expect(pts).toEqual([at(0, 1), at(1, 1), at(2, 0.9)])
  })

  it('超過上限丟最舊的', () => {
    let pts: HpPoint[] = []
    for (let i = 0; i < MAX_POINTS + 10; i++) pts = pushPoint(pts, T0 + i * 1000, 1 - i / 10000)
    expect(pts.length).toBe(MAX_POINTS)
    expect(pts[0].t).toBeGreaterThan(T0)
  })
})

describe('曲線座標', () => {
  it('時間往右、血量往上', () => {
    const pts = [at(0, 1), at(10, 0.5)]
    expect(sparklinePoints(pts, 100, 40)).toBe('0.0,0.0 100.0,20.0')
  })

  it('只有一點畫不出線', () => {
    expect(sparklinePoints([at(0, 1)], 100, 40)).toBe('')
  })
})

describe('最近的掉血速度', () => {
  it('每秒掉幾個百分點', () => {
    const pts = [at(0, 1), at(10, 0.8)]
    expect(recentDps(pts)).toBeCloseTo(2, 5) // 10 秒掉 20 個百分點
  })

  it('只看最近這段時間，前面打得快不算數', () => {
    const pts = [at(0, 1), at(100, 0.5), at(110, 0.49)]
    expect(recentDps(pts, 20_000)).toBeCloseTo(0.1, 5)
  })

  it('資料不夠就沒有速度', () => {
    expect(recentDps([])).toBeNull()
    expect(recentDps([at(0, 1)])).toBeNull()
  })
})
