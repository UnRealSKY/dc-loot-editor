import type { LootRecord, LootItem, Member, Purchase, SettleStatus } from '../types'

type Section = 'loot' | 'purchase' | 'dist' | 'none'

const HEADER_RE = /^##\s+(\S+)\s+(.+?)\s*\/\s*(\d+)\s*$/
const STRUCK_RE = /^\*\s*~~\s*(?::\w+:)?\s*(.+?)~~\s*$/
const LOOT_RE = /^\*\s*(:\w+:)\s+(.+?)x(\d+)\s*:\s*(.+?)\s*$/
const PRICE_RE = /^(\d+)x(\d+)(?:\s*-\s*(\d+)\(剪刀\)x(\d+))?/
const PURCHASE_RE = /^(@\S+)\s*:\s*(.+?)x(\d+)\s*=\s*(\d+)x(\d+)\s*$/
const DIST_RE = /^\*\s*(:\w+:)\s*(@\S+)\s*:/
// 劃線項目內部形如 "上衣命60%x1: (價格太低不計入)" 或 "上衣命60%x1"
const STRUCK_INNER_RE = /^(.+?)x(\d+)(?:\s*:\s*(.+?))?\s*$/

function parseLoot(line: string): LootItem | null {
  const struck = line.match(STRUCK_RE)
  if (struck) {
    const inner = struck[1].match(STRUCK_INNER_RE)
    if (!inner) return { status: 'struck', name: struck[1].trim(), qty: 1, unitPrice: null }
    return {
      status: 'struck',
      name: inner[1].trim(),
      qty: Number(inner[2]),
      unitPrice: null,
      ...(inner[3] ? { note: inner[3].trim() } : {}),
    }
  }
  const m = line.match(LOOT_RE)
  if (!m) return null
  const status = m[1] === ':ok:' ? 'ok' : 'cart'
  const price = m[4].match(PRICE_RE)
  const item: LootItem = {
    status,
    name: m[2].trim(),
    qty: Number(m[3]),
    unitPrice: price ? Number(price[1]) : null,
  }
  if (price && price[3] && price[4]) {
    item.scissorUnitPrice = Number(price[3])
    item.scissorCount = Number(price[4])
  }
  return item
}

export function parse(md: string): LootRecord {
  const record: LootRecord = {
    id: '', title: '', date: '', boss: '', memberCount: 0,
    members: [], lootItems: [], purchases: [], createdAt: '', updatedAt: '',
  }
  let section: Section = 'none'

  for (const raw of md.split('\n')) {
    const line = raw.trimEnd()
    if (!line.trim()) continue

    const header = line.match(HEADER_RE)
    if (header) {
      record.date = header[1]
      record.boss = header[2].trim()
      record.memberCount = Number(header[3])
      section = 'loot'
      continue
    }
    if (/^##\s*內購區/.test(line)) { section = 'purchase'; continue }
    if (/^##\s*分配/.test(line)) { section = 'dist'; continue }

    if (section === 'loot') {
      const item = parseLoot(line)
      if (item) record.lootItems.push(item)
    } else if (section === 'purchase') {
      const p = line.match(PURCHASE_RE)
      if (p) {
        const purchase: Purchase = {
          buyer: p[1], name: p[2].trim(), qty: Number(p[3]), unitPrice: Number(p[4]),
        }
        record.purchases.push(purchase)
      }
    } else if (section === 'dist') {
      const d = line.match(DIST_RE)
      if (d) {
        const settle: SettleStatus = d[1] === ':ok:' ? 'settled' : 'pending'
        const member: Member = { handle: d[2], settle }
        record.members.push(member)
      }
    }
  }

  return record
}
