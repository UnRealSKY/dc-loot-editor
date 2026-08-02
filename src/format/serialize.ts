import type { LootRecord, LootItem, SettleStatus } from '../types'
import { distSummary, memberDists } from './dist'

function lootLine(it: LootItem): string {
  const q = it.qty ?? ''
  if (it.status === 'struck') {
    const notePart = it.note ? `: ${it.note}` : ''
    return `* ~~:heavy_multiplication_x: ${it.name}x${q}${notePart}~~`
  }
  const emoji = it.status === 'ok' ? ':ok:' : ':shopping_cart:'
  let price = `${it.unitPrice ?? 0}x${q}`
  if (it.scissorCount && it.scissorUnitPrice) {
    price += ` - ${it.scissorUnitPrice}(剪刀)x${it.scissorCount}`
  }
  return `* ${emoji} ${it.name}x${q}: ${price}`
}

function settleEmoji(s: SettleStatus): string {
  return s === 'settled' ? ':ok:' : ':orange_square:'
}

export function serialize(record: LootRecord): string {
  const lines: string[] = []
  lines.push(`## ${record.date} ${record.boss} / ${record.members.length}`)
  for (const it of record.lootItems) lines.push(lootLine(it))

  if (record.purchases.length) {
    lines.push('', '## 內購區')
    for (const p of record.purchases) {
      lines.push(`${p.buyer}: ${p.name}x${p.qty} = ${p.unitPrice}x${p.qty}`)
    }
  }

  const streams = record.streams ?? []
  if (streams.length) {
    lines.push('', '## 直播檔')
    for (const s of streams) {
      lines.push(`* ${s.label}: ${s.url}`)
    }
  }

  const consignments = record.consignments ?? []
  if (consignments.length) {
    lines.push('', '## 代售')
    for (const c of consignments) {
      let amt = `${c.unitPrice}x${c.qty}`
      if (c.scissorCount && c.scissorUnitPrice) {
        amt += ` - ${c.scissorUnitPrice}(剪刀)x${c.scissorCount}`
      }
      lines.push(`${c.seller}: ${c.name}x${c.qty} = ${amt}`)
    }
  }

  const { total, n, base } = distSummary(record)
  lines.push('', '## 分配')
  lines.push(`總共: ${total} / ${n} = ${base}`)

  for (const d of memberDists(record)) {
    lines.push(`* ${settleEmoji(d.member.settle)} ${d.member.handle}: ${d.expr} = ${d.amount}`)
  }

  return lines.join('\n')
}
