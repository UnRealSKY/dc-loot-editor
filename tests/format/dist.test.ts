import { describe, it, expect } from 'vitest'
import { distSummary, memberDists } from '#src/format/dist'
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
    expect(distSummary(r)).toEqual({ total: 3266, n: 5, base: 654 })
  })
  it('無團員時 base 為 0', () => {
    const r = makeRecord({ lootItems: [{ status: 'ok', name: 'x', qty: 1, unitPrice: 100 }] })
    expect(distSummary(r)).toEqual({ total: 100, n: 0, base: 0 })
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
    // @a: base 500 − 自己內購 300 → income 200
    expect(a.expr).toBe('500 - 300')
    expect(a.amount).toBe(200)
    // @b: base 500 + 他人內購 300/1 − 代售持有 140 → 800 − 140 = 660
    expect(b.expr).toBe('500 + 300/1 - 140')
    expect(b.amount).toBe(660)
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
