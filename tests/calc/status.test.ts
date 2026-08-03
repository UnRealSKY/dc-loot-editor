import { describe, it, expect } from 'vitest'
import { allSold, allSettled } from '#src/calc/status'
import type { LootRecord } from '#src/types'

function makeRecord(over: Partial<LootRecord>): LootRecord {
  return {
    id: 'r1', date: '2026-08-02', boss: '測王',
    members: [], lootItems: [], purchases: [],
    createdAt: '', updatedAt: '',
    ...over,
  }
}

describe('allSold', () => {
  it('無待售項目即全數賣出（不計入也算已處理）', () => {
    const r = makeRecord({
      lootItems: [
        { status: 'ok', name: 'a', qty: 1, unitPrice: 100 },
        { status: 'struck', name: 'b', qty: 1, unitPrice: null },
      ],
    })
    expect(allSold(r)).toBe(true)
  })
  it('有待售項目或無項目時為 false', () => {
    expect(allSold(makeRecord({ lootItems: [{ status: 'cart', name: 'a', qty: 1, unitPrice: null }] }))).toBe(false)
    expect(allSold(makeRecord({}))).toBe(false)
  })
})

describe('allSettled', () => {
  it('全員結清為 true，任一未結清或無團員為 false', () => {
    expect(allSettled(makeRecord({ members: [{ handle: '@a', settle: 'settled' }] }))).toBe(true)
    expect(
      allSettled(makeRecord({ members: [{ handle: '@a', settle: 'settled' }, { handle: '@b', settle: 'pending' }] })),
    ).toBe(false)
    expect(allSettled(makeRecord({}))).toBe(false)
  })
})
