# DC 打王分寶 Editor — 設計文件

- 日期：2026-07-20
- 狀態：設計定案，待撰寫實作計畫
- 工作名（repo）：`dc-loot-editor`（未定，僅影響 Vite `base` 與 Pages 網址，部署前可改）

## 1. 目標與範圍

一個部署在 GitHub Pages 的**表單化 editor**，讓使用者把 Discord 上的「打王分寶」紀錄貼進來，透過表單快速編輯（自動計算總額與分配），再產生標準格式 markdown 貼回 Discord。

核心價值：**表單化輸入 + 自動計算 + 歷史建議**。markdown 只是進出口（讀入 / 寫出），不提供 markdown 文字編輯功能。

範圍：
- 多筆紀錄管理，存於瀏覽器 localStorage，以 `title` 列表。
- 貼上 DC markdown → 解析成結構化表單（盡力解析，解不掉的欄位留空）。
- 表單編輯，即時計算總額與每人分配。
- 產生標準格式 markdown + 一鍵複製。
- 欄位歷史建議（autocomplete）：品名、@團員、單價（帶日期）、王名。

不在範圍：
- 後端 / 帳號 / 雲端同步（純靜態，資料僅存本機瀏覽器）。
- markdown 自由文字編輯。
- 完全無損的任意舊格式雙向轉換（採「輸出無損、輸入盡力」策略）。

## 2. 領域概念

分寶由兩種價值流組成：

- **總表（均分）**：所有戰利品賣出所得，全體團員均分。
- **內購（特定人付錢給其他人）**：某團員把某件實物買下自己留著，付錢給**其他**團員（不含買家）。內購品**不列入**總表。

**剪刀成本**：某些道具必須消耗「剪刀」才能交易，剪刀本身也是時價，且**剪刀數 ≠ 物品數**（剪刀數為獨立欄位）。剪刀成本從該項目扣除，即淨額進總表，等於剪刀成本由**全體均分承擔**。剪刀綁在單一總表項目上（逐項計算）。內購品不涉及剪刀。

**分配公式（每位團員）：**

```
個人收入 = 總表淨額 / 人數
         + 他人內購總額 / (人數 − 1)
         − 自己內購總額
```

- 總表淨額 = Σ（未劃線項目的淨額）
- 項目淨額 = 單價 × 數量 − 剪刀單價 × 剪刀數
- 某人的「內購總額」= 該人所有內購項目 value 之和（value = 單價 × 數量）
- 「他人內購總額」= 除自己外所有人的內購總額之和

驗證（範例）：總表淨額 11288、5 人、unrealsky 內購 1500、其餘 0
- unrealsky：11288/5 + 0/4 − 1500 = 2258 − 1500 = 758
- 其他人：11288/5 + 1500/4 − 0 = 2258 + 375 = 2633

## 3. 資料模型

```ts
type SettleStatus = 'settled' | 'pending'   // :ok: / :orange_square:
type LootStatus   = 'ok' | 'cart' | 'struck' // :ok: / :shopping_cart: / 劃線(不計入)

interface Member {
  handle: string          // 例 "@.unrealsky"
  settle: SettleStatus
}

interface LootItem {
  status: LootStatus
  name: string
  qty: number
  unitPrice: number | null      // 劃線項目可為 null
  scissorCount?: number         // 剪刀數（獨立於 qty）
  scissorUnitPrice?: number     // 剪刀單價（時價）
  note?: string                 // 例 "(價格太低不計入)"
}

interface Purchase {            // 內購一筆
  buyer: string                 // @handle，須存在於 members
  name: string
  qty: number
  unitPrice: number
}

interface Record {
  id: string
  title: string                 // 必填，列表用
  date: string                  // YYYY-MM-DD
  boss: string                  // 王名
  memberCount: number           // N
  members: Member[]
  lootItems: LootItem[]
  purchases: Purchase[]
  createdAt: string
  updatedAt: string
}
```

計算結果（衍生，不儲存）：
- `netTotal` = Σ 未劃線項目淨額
- `baseShare` = netTotal / memberCount
- 每位 member 的 `income`（依分配公式）

## 4. DC 標準格式規範

工具**產生**的 markdown 一律為此標準格式（輸出無損、可再解析）；**貼入**時盡力解析，解不掉的欄位留空。

```
## <date> <boss> / <N>
* :ok: 附加大師x6: 475x6
* ~~:shopping_cart: 上衣命60%x1: (價格太低不計入)~~
* :ok: 手攻60%x2: 288x2 - 80(剪刀)x2

## 內購區
@trm.andy: 龍鍊x2 = 500x2
@.unrealsky: 龍蛋x1 = 500x1

## 分配
總共: 11288 / 5 = 2258
* :ok: @.unrealsky: 2258 - 1500 = 758
* :orange_square: @xiangjiaojiu: 2258 + 1500/4 = 2633
```

格式規則：

- **Header**：`## <date> <boss> / <N>`
- **總表項目行**：`* <狀態emoji> <品名>x<數量>: <單價>x<數量>`
  - 劃線項目整行以 `~~ ... ~~` 包住，代表不計入；可保留 `: <註解>`（無數字價格）。
  - 需剪刀者在價格後接 ` - <剪刀單價>(剪刀)x<剪刀數>`，例 `288x2 - 80(剪刀)x2`。
- **內購區**：`## 內購區` 下，每行 `@<買家>: <品名>x<數量> = <單價>x<數量>`。
- **分配區**：`## 分配` 下
  - 首行 `總共: <總表淨額> / <N> = <baseShare>`
  - 每人一行 `* <結清emoji> @<handle>: <算式> = <結果>`
  - 算式攤開公式並省略為 0 的項，例：`2258 - 1500 = 758`、`2258 + 1500/4 = 2633`；多買家時如 `2258 + 900/4 - 1500 = ...`。
- 分配區為**輸出結果**，貼回 DC 用；解析時可忽略（由公式重算）。

## 5. 計算與四捨五入規則

- 內部以數值運算；顯示與輸出時以 `Math.round` 取整。
- `baseShare = Math.round(netTotal / N)`。
- 每人 `income` 先以實數計算再 `Math.round`。
- 各人取整後總和可能與 netTotal 有些微差（遊戲分寶可接受），不做強制配平。分配區算式顯示未整除的分數形式（如 `1500/4`）以保留可讀性。

## 6. 功能需求

### 6.1 列表頁（首頁）
- 列出所有紀錄，以 `title` + `date` 顯示，依 `updatedAt` 排序。
- 「新增紀錄」「貼上 DC 匯入」按鈕。
- 每筆可：開啟編輯、複製（duplicate）、刪除（需確認）。

### 6.2 編輯頁（單筆）
- Header 欄位：title（必填，未填不可儲存）、date、boss、人數 N、members（@handle + 結清狀態切換）。
- 總表區：逐列項目，欄位含狀態切換、品名、數量、單價、剪刀數、剪刀單價、註解、即時淨額；可新增／刪除列。
- 內購區：逐列 `{ 買家、品名、數量、單價 }`，即時 value。
- 分配結果：唯讀面板，即時算出每人收入。
- 匯出：產生標準 markdown，一鍵複製。

### 6.3 匯入
- 貼上 DC markdown → 解析填入表單；解不掉的欄位留空供補。

### 6.4 歷史建議（autocomplete）
從 localStorage 全部紀錄聚合：
- 品名：曾用品名。
- @團員：曾出現的 handle。
- 單價：選定品名後，建議該品名歷史單價，**選項顯示日期**（如 `楓祝30 — 6400（2026-07-19）`），選了帶入為預設值可再改；剪刀單價同理。
- 王名：曾用王名。

## 7. UI 結構

- 路由：`/`（列表）、`/edit/:id`（編輯）。
- 元件切分（每個單一職責、可獨立理解與測試）：
  - `RecordList` — 列表頁
  - `RecordEditor` — 編輯頁容器
  - `LootTable` / `LootRow` — 總表
  - `PurchaseTable` / `PurchaseRow` — 內購
  - `DistributionPanel` — 分配結果（唯讀）
  - `ImportDialog` / `ExportDialog` — 匯入 / 匯出
  - `AutocompleteInput` — 共用歷史建議輸入元件
- 純函式模組（無 UI，可單元測試）：
  - `format/parse.ts` — markdown → Record（盡力解析）
  - `format/serialize.ts` — Record → 標準 markdown
  - `calc/distribution.ts` — 分配公式與淨額計算
  - `store/history.ts` — 歷史聚合供 autocomplete

## 8. 技術架構與部署

- **Vue 3 + Vite + TypeScript**。
- **Pinia** 管理狀態（多筆紀錄、當前編輯），持久化到 **localStorage**（未來可能交接，集中管理較佳）。
- **pnpm** 管相依。
- **changeset** 管版本與 CHANGELOG（類似既有 hit/erp 流程，改置於 GitHub）。
- **GitHub Actions**：
  - push 到 `main` → `pnpm install` → `pnpm build` → 部署 GitHub Pages（`actions/deploy-pages`）。
  - Vite `base` 設為 `/<repo>/`。
  - changeset：PR 累積 changeset → version PR 自動 bump 版本與 CHANGELOG。

## 9. 待確認 / 已知細節

- repo 名稱未定（影響 Vite `base` 與 Pages 網址），部署前決定。
- 內購品是否可能需剪刀：目前設計為否；若實務有例外再擴充。
- 多買家分配行的算式呈現順序（先加他人、後減自己）以本文件為準。
- 各人取整後總和與 netTotal 的微小差異不強制配平。
