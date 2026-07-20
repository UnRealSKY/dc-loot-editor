import type { LootRecord, LootItem, SettleStatus } from '../types'
import { netTotal, computeIncomes, purchaseValue } from '../calc/distribution'

function lootLine(it: LootItem): string {
  if (it.status === 'struck') {
    const notePart = it.note ? `: ${it.note}` : ''
    return `* ~~:shopping_cart: ${it.name}x${it.qty}${notePart}~~`
  }
  const emoji = it.status === 'ok' ? ':ok:' : ':shopping_cart:'
  let price = `${it.unitPrice ?? 0}x${it.qty}`
  if (it.scissorCount && it.scissorUnitPrice) {
    price += ` - ${it.scissorUnitPrice}(剪刀)x${it.scissorCount}`
  }
  return `* ${emoji} ${it.name}x${it.qty}: ${price}`
}

function settleEmoji(s: SettleStatus): string {
  return s === 'settled' ? ':ok:' : ':orange_square:'
}

export function serialize(record: LootRecord): string {
  const lines: string[] = []
  lines.push(`## ${record.date} ${record.boss} / ${record.memberCount}`)
  for (const it of record.lootItems) lines.push(lootLine(it))

  lines.push('', '## 內購區')
  for (const p of record.purchases) {
    lines.push(`${p.buyer}: ${p.name}x${p.qty} = ${p.unitPrice}x${p.qty}`)
  }

  const total = netTotal(record.lootItems)
  const n = record.memberCount
  const baseDisplay = Math.round(n > 0 ? total / n : 0)
  lines.push('', '## 分配')
  lines.push(`總共: ${total} / ${n} = ${baseDisplay}`)

  const incomeByHandle = new Map(computeIncomes(record).map((i) => [i.handle, i]))
  for (const m of record.members) {
    const inc = incomeByHandle.get(m.handle)
    if (!inc) continue
    let expr = `${baseDisplay}`
    if (inc.others > 0) expr += ` + ${inc.others}/${n - 1}`
    if (inc.own > 0) expr += ` - ${inc.own}`
    lines.push(`* ${settleEmoji(m.settle)} ${m.handle}: ${expr} = ${Math.round(inc.income)}`)
  }

  return lines.join('\n')
}
