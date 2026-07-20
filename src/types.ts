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

export interface LootRecord {
  id: string
  title: string
  date: string             // YYYY-MM-DD
  boss: string
  memberCount: number
  members: Member[]
  lootItems: LootItem[]
  purchases: Purchase[]
  createdAt: string
  updatedAt: string
}
