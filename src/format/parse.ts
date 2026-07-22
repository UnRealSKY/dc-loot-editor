import type { LootRecord, LootItem, LootStatus, Stream, Consignment, SettleStatus } from '../types'

type Section = 'loot' | 'purchase' | 'stream' | 'consignment' | 'dist' | 'none'

const HEADER_RE = /^##\s+(\S+)\s+(.+?)\s*\/\s*(\d+)\s*$/
const STRUCK_RE = /^\*\s*~~(.+?)~~\s*$/
// 狀態 token 寬鬆捕捉，相容 :ok: 短碼與 🆗 unicode（DC 兩種編輯模式）
const LOOT_RE = /^\*\s*(\S+)\s+(.+?)x(\d+)\s*:\s*(.+?)\s*$/
const PRICE_RE = /^(\d+)x(\d+)(?:\s*-\s*(\d+)\(剪刀\)x(\d+))?/
const PURCHASE_RE = /^(<@\d+>|@\S+?)\s*:\s*(.+?)x(\d+)\s*=\s*(\d+)x(\d+)\s*$/
// 代售行同內購寫法：@代售者: 品名xN = 單價xN
const CONSIGNMENT_RE = /^(<@\d+>|@\S+?)\s*:\s*(.+?)x(\d+)\s*=\s*(\d+)x(\d+)\s*$/
const STREAM_RE = /^\*\s*(.+?)\s*:\s*(https?:\/\/\S+)\s*$/
// 分配行只取結清狀態與團員 handle（相容 @名稱 與 <@數字ID>，不強制冒號）
const DIST_RE = /^\*\s*(\S+)\s+(<@\d+>|@[^\s:：]+)/
// 劃線項目內部形如 "上衣命60%x1: (價格太低不計入)" 或 "上衣命60%x1"
const STRUCK_INNER_RE = /^(.+?)x(\d+)(?:\s*:\s*(.+?))?\s*$/

const OK_TOKENS = new Set([':ok:', '🆗'])
const CART_TOKENS = new Set([':shopping_cart:', '🛒'])
const PENDING_TOKENS = new Set([':orange_square:', '🟧'])

function lootStatusFrom(token: string): LootStatus {
  if (OK_TOKENS.has(token)) return 'ok'
  if (CART_TOKENS.has(token)) return 'cart'
  return 'cart'
}
function settleFrom(token: string): SettleStatus {
  return PENDING_TOKENS.has(token) ? 'pending' : 'settled'
}
// 移除開頭的狀態 token（:shortcode: 或 emoji），保留品名
function stripLeadingStatus(s: string): string {
  return s.replace(/^\s*(?::\w+:|[^\s\w一-鿿]+)\s*/, '')
}

function parseLoot(line: string): LootItem | null {
  const struck = line.match(STRUCK_RE)
  if (struck) {
    const inner = stripLeadingStatus(struck[1].trim())
    const m2 = inner.match(STRUCK_INNER_RE)
    if (!m2) return { status: 'struck', name: inner.trim(), qty: 1, unitPrice: null }
    return {
      status: 'struck',
      name: m2[1].trim(),
      qty: Number(m2[2]),
      unitPrice: null,
      ...(m2[3] ? { note: m2[3].trim() } : {}),
    }
  }
  const m = line.match(LOOT_RE)
  if (!m) return null
  const price = m[4].match(PRICE_RE)
  const item: LootItem = {
    status: lootStatusFrom(m[1]),
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
    id: '', date: '', boss: '',
    members: [], lootItems: [], purchases: [], streams: [], consignments: [], createdAt: '', updatedAt: '',
  }
  const streams: Stream[] = record.streams!
  const consignments: Consignment[] = record.consignments!
  let section: Section = 'none'

  for (const raw of md.split('\n')) {
    const line = raw.trimEnd()
    if (!line.trim()) continue

    const header = line.match(HEADER_RE)
    if (header) {
      record.date = header[1]
      record.boss = header[2].trim()
      // header[3] 為 DC 標頭的人數，僅供辨識；本工具 N 由 members.length 推導
      section = 'loot'
      continue
    }
    if (/^##\s*內購區/.test(line)) { section = 'purchase'; continue }
    if (/^##\s*直播檔/.test(line)) { section = 'stream'; continue }
    if (/^##\s*代售/.test(line)) { section = 'consignment'; continue }
    if (/^##\s*分配/.test(line)) { section = 'dist'; continue }

    if (section === 'loot') {
      const item = parseLoot(line)
      if (item) record.lootItems.push(item)
    } else if (section === 'purchase') {
      const p = line.match(PURCHASE_RE)
      if (p) {
        record.purchases.push({
          buyer: p[1], name: p[2].trim(), qty: Number(p[3]), unitPrice: Number(p[4]),
        })
      }
    } else if (section === 'stream') {
      const s = line.match(STREAM_RE)
      if (s) streams.push({ label: s[1].trim(), url: s[2].trim() })
    } else if (section === 'consignment') {
      const c = line.match(CONSIGNMENT_RE)
      if (c) {
        consignments.push({
          seller: c[1], name: c[2].trim(), qty: Number(c[3]), unitPrice: Number(c[4]),
        })
      }
    } else if (section === 'dist') {
      const d = line.match(DIST_RE)
      if (d) record.members.push({ handle: d[2], settle: settleFrom(d[1]) })
    }
  }

  return record
}
