import type { LootItem, Purchase, Consignment, LootRecord } from '../types'

export function itemNet(item: LootItem): number {
  if (item.status === 'struck') return 0
  const price = (item.unitPrice ?? 0) * item.qty
  const scissor = (item.scissorUnitPrice ?? 0) * (item.scissorCount ?? 0)
  return price - scissor
}

export function netTotal(items: LootItem[]): number {
  return items.reduce((sum, it) => sum + itemNet(it), 0)
}

export function purchaseValue(p: Purchase): number {
  return p.unitPrice * p.qty
}

export function memberPurchaseTotal(purchases: Purchase[], handle: string): number {
  return purchases
    .filter((p) => p.buyer === handle)
    .reduce((s, p) => s + purchaseValue(p), 0)
}

export function consignmentValue(c: Consignment): number {
  const price = c.unitPrice * c.qty
  const scissor = (c.scissorUnitPrice ?? 0) * (c.scissorCount ?? 0)
  return price - scissor
}

// 某團員代售、手上握著的金額總和
export function memberConsignmentTotal(consignments: Consignment[], handle: string): number {
  return consignments
    .filter((c) => c.seller === handle)
    .reduce((s, c) => s + consignmentValue(c), 0)
}

export interface Income {
  handle: string
  base: number
  own: number
  others: number
  income: number
}

export function computeIncomes(record: LootRecord): Income[] {
  const n = record.members.length
  const base = n > 0 ? netTotal(record.lootItems) / n : 0
  const totalPurchase = record.purchases.reduce((s, p) => s + purchaseValue(p), 0)
  return record.members.map((m) => {
    const own = memberPurchaseTotal(record.purchases, m.handle)
    const others = totalPurchase - own
    const income = base + (n > 1 ? others / (n - 1) : 0) - own
    return { handle: m.handle, base, own, others, income }
  })
}
