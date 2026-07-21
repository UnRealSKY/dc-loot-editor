export type SettleStatus = 'settled' | 'pending'   // :ok: / :orange_square:
export type LootStatus = 'ok' | 'cart' | 'struck'  // :ok: / :shopping_cart: / 劃線(不計入)

export interface Member {
  handle: string           // 例 "@.unrealsky"
  settle: SettleStatus
  id?: string
}

export interface LootItem {
  status: LootStatus
  name: string
  qty: number
  unitPrice: number | null
  scissorCount?: number
  scissorUnitPrice?: number
  note?: string
  id?: string
}

export interface Purchase {
  buyer: string            // @handle，須存在於 members
  name: string
  qty: number
  unitPrice: number
  id?: string
}

export interface Stream {
  label: string            // 例 "第一場混炎"
  url: string
  id?: string
}

export interface LootRecord {
  id: string
  date: string             // YYYY-MM-DD
  boss: string             // 王名，即紀錄標題（列表顯示用）
  members: Member[]        // 人數 N 由 members.length 推導
  lootItems: LootItem[]
  purchases: Purchase[]
  streams?: Stream[]       // 直播檔連結
  createdAt: string
  updatedAt: string
}
