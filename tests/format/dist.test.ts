import { describe, it, expect } from 'vitest'
import { distSummary, memberDists, summaryLine } from '#src/format/dist'
import type { LootRecord } from '#src/types'

function makeRecord(over: Partial<LootRecord>): LootRecord {
  return {
    id: 'r1', date: '2026-08-02', boss: '測王',
    members: [], lootItems: [], purchases: [],
    createdAt: '', updatedAt: '',
    ...over,
  }
}

describe('distSummary', () => {
  it('總額與均分額（無條件進位）', () => {
    const r = makeRecord({
      members: ['@a', '@b', '@c', '@d', '@e'].map((h) => ({ handle: h, settle: 'pending' as const })),
      lootItems: [{ status: 'ok', name: 'x', qty: 1, unitPrice: 3266 }],
    })
    expect(distSummary(r)).toEqual({ total: 3266, service: 0, fee: 0, n: 5, base: 654 })
  })
  it('無團員時 base 為 0', () => {
    const r = makeRecord({ lootItems: [{ status: 'ok', name: 'x', qty: 1, unitPrice: 100 }] })
    expect(distSummary(r)).toEqual({ total: 100, service: 0, fee: 0, n: 0, base: 0 })
  })
  it('有團長時 base 用扣掉辛苦費後的餘額均分', () => {
    const r = makeRecord({
      members: ['@a', '@b', '@c', '@d', '@e'].map((h) => ({ handle: h, settle: 'pending' as const })),
      lootItems: [{ status: 'ok', name: 'x', qty: 1, unitPrice: 10000 }],
      leader: { handle: '@a', feeMode: 'percent', feeValue: 5 },
    })
    expect(distSummary(r)).toEqual({ total: 10000, service: 0, fee: 500, n: 5, base: 1900 })
  })
})

describe('memberDists 團長辛苦費', () => {
  const r = makeRecord({
    members: ['@a', '@b'].map((h) => ({ handle: h, settle: 'pending' as const })),
    lootItems: [{ status: 'ok', name: 'x', qty: 1, unitPrice: 10000 }],
    leader: { handle: '@a', feeMode: 'fixed', feeValue: 1000 },
  })

  it('團長算式接上辛苦費，團員維持原樣', () => {
    const [a, b] = memberDists(r)
    expect(a.expr).toBe('4500 + 1000')
    expect(a.amount).toBe(5500)
    expect(b.expr).toBe('4500')
    expect(b.amount).toBe(4500)
    expect(a.amount + b.amount).toBe(10000)
  })

  it('辛苦費排在 base 之後、內購調整之前', () => {
    const withPurchase = makeRecord({
      ...r,
      purchases: [{ buyer: '@b', name: 'z', qty: 1, unitPrice: 300 }],
    })
    const [a] = memberDists(withPurchase)
    expect(a.expr).toBe('4500 + 1000 + 300/1')
  })
})

describe('memberDists', () => {
  it('公式含他人內購、自己內購與代售持有額', () => {
    const r = makeRecord({
      members: [
        { handle: '@a', settle: 'pending' },
        { handle: '@b', settle: 'pending' },
      ],
      lootItems: [{ status: 'ok', name: 'x', qty: 1, unitPrice: 1000 }],
      purchases: [{ buyer: '@a', name: 'y', qty: 1, unitPrice: 300 }],
      consignments: [{ seller: '@b', name: 'z', qty: 1, unitPrice: 300, scissorUnitPrice: 80, scissorCount: 2 }],
    })
    const [a, b] = memberDists(r)
    // 團隊總額 = 總表 1000 ＋ 代售淨額 (300 − 80×2 = 140) = 1140 → base 570
    // @a: base 570 − 自己內購 300 → 270
    expect(a.expr).toBe('570 - 300')
    expect(a.amount).toBe(270)
    // @b: base 570 + 他人內購 300/1 − 代售持有 140 → 870 − 140 = 730
    expect(b.expr).toBe('570 + 300/1 - 140')
    expect(b.amount).toBe(730)
    // 兩人結算加總 = 還在團長手上的錢 = 總表淨額 1000
    expect(a.amount + b.amount).toBe(1000)
  })
  it('n=1 時不出現 /0 且忽略他人內購', () => {
    const r = makeRecord({
      members: [{ handle: '@me', settle: 'pending' }],
      lootItems: [{ status: 'ok', name: 'x', qty: 1, unitPrice: 1000 }],
      purchases: [{ buyer: '@other', name: 'y', qty: 1, unitPrice: 500 }],
    })
    const [me] = memberDists(r)
    expect(me.expr).toBe('1000')
    expect(me.amount).toBe(1000)
  })
})

describe('手續費在 distSummary 與輸出', () => {
  const r = makeRecord({
    members: ['@a', '@b', '@c', '@d', '@e'].map((h) => ({ handle: h, settle: 'pending' as const })),
    lootItems: [{ status: 'ok', name: 'x', qty: 1, unitPrice: 10000 }],
    serviceFeePercent: 3,
  })

  it('base 用扣掉手續費後的餘額均分', () => {
    expect(distSummary(r)).toEqual({ total: 10000, service: 300, fee: 0, n: 5, base: 1940 })
  })

  it('總共行用百分比寫在算式裡，註記用方括號', () => {
    expect(summaryLine(r)).toBe('總共: 10000 * (1 - 3%[手續費]) / 5 = 1940')
  })

  it('手續費與辛苦費並列在同一個括號裡，手續費在前', () => {
    const withLeader = makeRecord({
      ...r,
      leader: { handle: '@a', feeMode: 'percent', feeValue: 5 },
    })
    expect(summaryLine(withLeader)).toBe('總共: 10000 * (1 - 3%[手續費] - 5%[辛苦費]) / 5 = 1840')
  })

  it('群組關閉辛苦費時只剩手續費', () => {
    const withLeader = makeRecord({
      ...r,
      leader: { handle: '@a', feeMode: 'percent', feeValue: 5 },
    })
    expect(summaryLine(withLeader, { leaderFeeEnabled: false })).toBe(
      '總共: 10000 * (1 - 3%[手續費]) / 5 = 1940',
    )
  })

  it('都沒有時維持原本不加括號的寫法', () => {
    expect(summaryLine(makeRecord({ ...r, serviceFeePercent: 0 }))).toBe('總共: 10000 / 5 = 2000')
  })
})

describe('summaryLine 各種組合', () => {
  const five = ['@a', '@b', '@c', '@d', '@e'].map((h) => ({ handle: h, settle: 'pending' as const }))
  const r = (over: Partial<LootRecord>) =>
    makeRecord({
      members: five,
      lootItems: [{ status: 'ok', name: 'x', qty: 1, unitPrice: 10000 }],
      ...over,
    })

  it('固定金額的辛苦費放在乘法外面減，運算順序才對', () => {
    const line = summaryLine(r({
      serviceFeePercent: 3,
      leader: { handle: '@a', feeMode: 'fixed', feeValue: 500 },
    }))
    expect(line).toBe('總共: (10000 * (1 - 3%[手續費]) - 500[辛苦費]) / 5 = 1840')
  })

  it('只有固定金額辛苦費時不出現乘法', () => {
    const line = summaryLine(r({ leader: { handle: '@a', feeMode: 'fixed', feeValue: 500 } }))
    expect(line).toBe('總共: (10000 - 500[辛苦費]) / 5 = 1900')
  })

  it('兩者都沒有時維持最單純的寫法', () => {
    expect(summaryLine(r({}))).toBe('總共: 10000 / 5 = 2000')
  })

  it('百分比帶小數也照原樣寫出來', () => {
    expect(summaryLine(r({ serviceFeePercent: 2.5 }))).toBe('總共: 10000 * (1 - 2.5%[手續費]) / 5 = 1950')
  })
})
