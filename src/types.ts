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
  qty: number | null
  unitPrice: number | null
  scissorCount?: number
  scissorUnitPrice?: number
  note?: string
  id?: string
}

export type PurchaseMode = 'full' | 'split' // 全額：買家付全額給其他人分；均攤：買家只付 1/N

export interface Purchase {
  buyer: string            // @handle，須存在於 members
  name: string
  qty: number
  unitPrice: number
  mode?: PurchaseMode      // undefined 視為 full（全額，既有資料相容）
  id?: string
}

export interface Stream {
  label: string            // 例 "第一場混炎"
  url: string
  id?: string
}

export interface Consignment {
  seller: string           // 代售者 @handle，須存在於 members
  name: string
  qty: number
  unitPrice: number
  scissorCount?: number
  scissorUnitPrice?: number
  id?: string
}

export type DcImageKind = 'drop' | 'payout' | 'external'
// drop：掉落截圖（主貼附件）；payout：領錢截圖（串內訊息、綁團員）；external：外購截圖（串內訊息、可註解）

export interface DcImage {
  id: string               // 也是 IndexedDB blob key
  kind: DcImageKind
  filename: string         // 上傳檔名（id + 副檔名）
  memberHandle?: string    // payout：綁定團員
  note?: string            // external：註解
  url?: string             // DC CDN URL（上傳成功後；本地 blob 隨即刪除）
  attachmentId?: string    // drop：主貼附件 id（同步時保留清單用）
  dcMessageId?: string     // payout/external：串內訊息 id
  sentContent?: string     // payout/external：上次送出的訊息內文（變更偵測）
  removed?: boolean        // 已發佈圖片標記待刪，同步時執行
}

export interface DcBinding {
  threadId: string         // 討論串 id（webhook 無法枚舉，遺失即無法再編輯貼文）
  messageId: string        // 開頭訊息 id（PATCH 對象）
  publishedAt: string
  lastSyncAt?: string
  sentContent?: string     // 上次送出的主貼內文（本地判定同步狀態，不必打 API）
}

export type LeaderFeeMode = 'percent' | 'fixed'

// 團長辛苦費：先從團隊總額扣掉，剩下的均分給所有人（含團長），團長再額外拿走這筆。
// handle 與費用綁在同一個物件，「有辛苦費卻沒團長」這種狀態就無法表示。
export interface Leader {
  handle: string           // 須是 members 之一，否則辛苦費視為 0
  feeMode: LeaderFeeMode
  feeValue: number         // percent：5 表示 5%；fixed：直接是金額
}

export interface LootRecord {
  id: string
  groupId?: string         // 所屬 DC 群組；未設＝第一個群組（舊紀錄相容）
  date: string             // YYYY-MM-DD
  boss: string             // 王名，即紀錄標題（列表顯示用）
  members: Member[]        // 人數 N 由 members.length 推導
  leader?: Leader          // 未指定＝沒有團長，辛苦費 0
  lootItems: LootItem[]
  purchases: Purchase[]
  streams?: Stream[]        // 直播檔連結
  consignments?: Consignment[] // 代售：某團員代賣、手上握著的金額，併入結算
  shelved?: boolean         // 擱置：暫不列入未領總覽
  dc?: DcBinding            // 已發佈至 DC 論壇串的綁定
  images?: DcImage[]        // 三類截圖（檔案本體在 IndexedDB 或 DC CDN）
  createdAt: string
  updatedAt: string
}
