import type { LootItem, Purchase, Consignment, LootRecord } from '../types'

export function itemNet(item: LootItem): number {
  if (item.status === 'struck') return 0
  const price = (item.unitPrice ?? 0) * (item.qty ?? 0)
  const scissor = (item.scissorUnitPrice ?? 0) * (item.scissorCount ?? 0)
  return price - scissor
}

export function netTotal(items: LootItem[]): number {
  return items.reduce((sum, it) => sum + itemNet(it), 0)
}

// 團隊總收益＝總表淨額 ＋ 代售淨額。
// 代售是團員代替團隊賣掉的東西，錢暫時握在他手上，但收益屬於團隊，
// 必須先進總額被分掉；他手上那份於結算時扣抵（見 memberConsignmentTotal）。
export function teamTotal(record: LootRecord): number {
  const consigned = (record.consignments ?? []).reduce((s, c) => s + consignmentValue(c), 0)
  return netTotal(record.lootItems) + consigned
}

export function purchaseValue(p: Purchase): number {
  return p.unitPrice * p.qty
}

// 買家實付額：全額付原價；均攤只付 1/N
export function purchaseCharge(p: Purchase, n: number): number {
  const v = purchaseValue(p)
  return p.mode === 'split' && n > 0 ? v / n : v
}

export function memberPurchaseTotal(purchases: Purchase[], handle: string): number {
  return purchases
    .filter((p) => p.buyer === handle)
    .reduce((s, p) => s + purchaseValue(p), 0)
}

// 顯示用：小數截到 2 位（整數維持原樣）
export function roundDisplay(x: number): number {
  return Math.round(x * 100) / 100
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

// 團長辛苦費金額。夾在 0 ~ 團隊總額之間：填超過總額就取總額（base 歸零），
// 不讓 base 變負數導致其他人倒貼。
export function leaderFee(record: LootRecord): number {
  const l = record.leader
  // 團長被移出團員列表時視同沒有團長，否則這筆錢會發給不在分配名單上的人
  if (!l || !record.members.some((m) => m.handle === l.handle)) return 0
  const total = teamTotal(record)
  const fee = l.feeMode === 'percent' ? (total * l.feeValue) / 100 : l.feeValue
  return Math.max(0, Math.min(fee, total))
}

export interface Income {
  handle: string
  base: number
  own: number
  others: number
  fee: number // 該人拿到的辛苦費（非團長為 0）
  income: number
}

export function computeIncomes(record: LootRecord): Income[] {
  const n = record.members.length
  const fee = leaderFee(record)
  const base = n > 0 ? (teamTotal(record) - fee) / n : 0
  // own/others 以「實付額」計：均攤內購買家只付 1/N，其他人仍分 (實付)/(N-1)
  const totalCharge = record.purchases.reduce((s, p) => s + purchaseCharge(p, n), 0)
  return record.members.map((m) => {
    const own = record.purchases
      .filter((p) => p.buyer === m.handle)
      .reduce((s, p) => s + purchaseCharge(p, n), 0)
    const others = totalCharge - own
    const ownFee = m.handle === record.leader?.handle ? fee : 0
    const income = base + (n > 1 ? others / (n - 1) : 0) - own + ownFee
    return { handle: m.handle, base, own, others, fee: ownFee, income }
  })
}
