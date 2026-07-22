import { describe, it, expect } from 'vitest'
import { itemNet, netTotal, purchaseValue, memberPurchaseTotal, computeIncomes, consignmentValue, memberConsignmentTotal } from '#src/calc/distribution'
import type { LootItem, LootRecord } from '#src/types'

const ok = (over: Partial<LootItem>): LootItem =>
  ({ status: 'ok', name: 'x', qty: 1, unitPrice: 0, ...over })

describe('itemNet', () => {
  it('單價×數量', () => {
    expect(itemNet(ok({ unitPrice: 475, qty: 6 }))).toBe(2850)
  })
  it('扣除剪刀成本', () => {
    expect(itemNet(ok({ unitPrice: 288, qty: 2, scissorUnitPrice: 80, scissorCount: 2 }))).toBe(416)
  })
  it('劃線項目不計入（回傳 0）', () => {
    expect(itemNet(ok({ status: 'struck', unitPrice: 999, qty: 3 }))).toBe(0)
  })
  it('unitPrice 為 null 視為 0', () => {
    expect(itemNet(ok({ unitPrice: null, qty: 3 }))).toBe(0)
  })
})

describe('netTotal', () => {
  it('加總未劃線項目淨額', () => {
    const items: LootItem[] = [
      ok({ unitPrice: 475, qty: 6 }),
      ok({ status: 'struck', unitPrice: 100, qty: 1 }),
      ok({ unitPrice: 168, qty: 2 }),
    ]
    expect(netTotal(items)).toBe(2850 + 336)
  })
})

describe('purchaseValue / memberPurchaseTotal', () => {
  it('單價×數量', () => {
    expect(purchaseValue({ buyer: '@a', name: 'x', qty: 2, unitPrice: 500 })).toBe(1000)
  })
  it('依買家加總', () => {
    const ps = [
      { buyer: '@a', name: 'x', qty: 2, unitPrice: 500 },
      { buyer: '@a', name: 'y', qty: 1, unitPrice: 500 },
      { buyer: '@b', name: 'z', qty: 1, unitPrice: 300 },
    ]
    expect(memberPurchaseTotal(ps, '@a')).toBe(1500)
    expect(memberPurchaseTotal(ps, '@b')).toBe(300)
  })
})

describe('consignmentValue / memberConsignmentTotal', () => {
  it('單價×數量', () => {
    expect(consignmentValue({ seller: '@a', name: 'x', qty: 2, unitPrice: 300 })).toBe(600)
  })
  it('依代售者加總', () => {
    const cs = [
      { seller: '@a', name: 'x', qty: 1, unitPrice: 300 },
      { seller: '@a', name: 'y', qty: 2, unitPrice: 50 },
      { seller: '@b', name: 'z', qty: 1, unitPrice: 100 },
    ]
    expect(memberConsignmentTotal(cs, '@a')).toBe(400)
    expect(memberConsignmentTotal(cs, '@b')).toBe(100)
  })
})

describe('computeIncomes', () => {
  const base: LootRecord = {
    id: '1', date: '2026-07-19', boss: '混龍',
    members: [
      { handle: '@.unrealsky', settle: 'settled' },
      { handle: '@xiangjiaojiu', settle: 'pending' },
      { handle: '@must0505110', settle: 'pending' },
      { handle: '@auwoo', settle: 'pending' },
      { handle: '@x', settle: 'pending' },
    ],
    lootItems: [{ status: 'ok', name: '總表', qty: 1, unitPrice: 11288 }],
    purchases: [{ buyer: '@.unrealsky', name: '龍', qty: 3, unitPrice: 500 }],
    createdAt: '', updatedAt: '',
  }

  it('買家 = base - 自己內購', () => {
    const r = computeIncomes(base)
    const u = r.find((x) => x.handle === '@.unrealsky')!
    expect(Math.round(u.income)).toBe(758) // 11288/5 + 0 - 1500 = 757.6 → 758
  })
  it('其他人 = base + 他人內購/(N-1)', () => {
    const r = computeIncomes(base)
    const o = r.find((x) => x.handle === '@xiangjiaojiu')!
    expect(Math.round(o.income)).toBe(2633) // 2257.6 + 375 = 2632.6 → 2633
  })
})
