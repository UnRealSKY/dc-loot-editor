import type { LootRecord, Member } from '../types'
import { teamTotal, leaderFee, computeIncomes, memberConsignmentTotal, roundDisplay } from '../calc/distribution'

export interface DistSummary {
  total: number // 團隊總收益（總表淨額 ＋ 代售淨額）
  fee: number // 團長辛苦費（沒有團長為 0）
  n: number
  base: number // 顯示用均分額（無條件進位）
}

export function distSummary(record: LootRecord): DistSummary {
  const total = teamTotal(record)
  const fee = leaderFee(record)
  const n = record.members.length
  const base = Math.ceil(n > 0 ? (total - fee) / n : 0)
  // fee 與 base 同為顯示用（base 進位、fee 截到 2 位），計算一律用上面的原值
  return { total, fee: roundDisplay(fee), n, base }
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
    // 辛苦費緊接 base（同屬分配所得），內購與代售是之後的調整項
    if (inc.fee > 0) expr += ` + ${roundDisplay(inc.fee)}`
    if (n > 1 && inc.others > 0) expr += ` + ${roundDisplay(inc.others)}/${n - 1}`
    if (inc.own > 0) expr += ` - ${roundDisplay(inc.own)}`
    if (held > 0) expr += ` - ${held}`
    out.push({ member: m, expr, amount: Math.ceil(inc.income) - held })
  }
  return out
}

// 分配區塊的「總共」行。有辛苦費時一定要括號，
// 否則 "10000 - 500 / 5" 按四則運算會算成 9900。
export function summaryLine(record: LootRecord): string {
  const { total, fee, n, base } = distSummary(record)
  return fee > 0
    ? `總共: (${total} - ${fee}(辛苦費)) / ${n} = ${base}`
    : `總共: ${total} / ${n} = ${base}`
}

// 每人分配行的算式部分：沒有運算時算式本身就是答案，不再重複寫一次
export function distLine(d: MemberDist): string {
  return d.expr === String(d.amount) ? d.expr : `${d.expr} = ${d.amount}`
}
