import type { LootRecord, Member } from '../types'
import { netTotal, computeIncomes, memberConsignmentTotal } from '../calc/distribution'

export interface DistSummary {
  total: number
  n: number
  base: number // 顯示用均分額（無條件進位）
}

export function distSummary(record: LootRecord): DistSummary {
  const total = netTotal(record.lootItems)
  const n = record.members.length
  const base = Math.ceil(n > 0 ? total / n : 0)
  return { total, n, base }
}

export interface MemberDist {
  member: Member
  expr: string // 例 "654 + 1000/4 - 300"，不含「= 金額」
  amount: number // ceil(income) − 代售持有額
}

// serialize 與未領總覽共用的每人分配公式，保證兩邊輸出一致
export function memberDists(record: LootRecord): MemberDist[] {
  const { n, base } = distSummary(record)
  const consignments = record.consignments ?? []
  const incomeByHandle = new Map(computeIncomes(record).map((i) => [i.handle, i]))
  const out: MemberDist[] = []
  for (const m of record.members) {
    const inc = incomeByHandle.get(m.handle)
    if (!inc) continue
    const held = memberConsignmentTotal(consignments, m.handle)
    let expr = `${base}`
    if (n > 1 && inc.others > 0) expr += ` + ${inc.others}/${n - 1}`
    if (inc.own > 0) expr += ` - ${inc.own}`
    if (held > 0) expr += ` - ${held}`
    out.push({ member: m, expr, amount: Math.ceil(inc.income) - held })
  }
  return out
}
