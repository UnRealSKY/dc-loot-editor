import { describe, it, expect } from 'vitest'
import { computeIncomes, purchaseCharge } from '#src/calc/distribution'
import type { LootRecord, Purchase } from '#src/types'

const record: LootRecord = {
  id: 'r', date: '2026-08-03', boss: '測王',
  members: ['@a', '@b', '@c', '@d', '@e'].map((h) => ({ handle: h, settle: 'pending' as const })),
  lootItems: [],
  purchases: [{ buyer: '@a', name: '混龍鍊', qty: 1, unitPrice: 500, mode: 'split' }],
  createdAt: '', updatedAt: '',
}

describe('內購 全額/均攤', () => {
  it('purchaseCharge：全額付原價、均攤付 1/N', () => {
    const p: Purchase = { buyer: '@a', name: 'x', qty: 1, unitPrice: 500 }
    expect(purchaseCharge(p, 5)).toBe(500)
    expect(purchaseCharge({ ...p, mode: 'split' }, 5)).toBe(100)
  })

  it('均攤 500（5 人團）：買家付 100、其他 4 人各得 25', () => {
    const incomes = computeIncomes(record)
    const a = incomes.find((i) => i.handle === '@a')!
    const b = incomes.find((i) => i.handle === '@b')!
    expect(a.own).toBe(100)
    expect(a.income).toBe(-100)
    expect(b.others).toBe(100)
    expect(b.income).toBe(25)
  })

  it('混合全額與均攤：非買家得 (100 + 400)/4 = 125', () => {
    const r: LootRecord = {
      ...record,
      purchases: [
        { buyer: '@a', name: 'x', qty: 1, unitPrice: 500, mode: 'split' },
        { buyer: '@b', name: 'y', qty: 1, unitPrice: 400 },
      ],
    }
    const c = computeIncomes(r).find((i) => i.handle === '@c')!
    expect(c.income).toBe(125)
  })
})
