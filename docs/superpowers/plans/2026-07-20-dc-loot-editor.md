# DC 打王分寶 Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一個部署於 GitHub Pages 的表單化 editor，把 Discord 打王分寶紀錄貼入 → 表單編輯並自動計算分配 → 產生標準格式 markdown 貼回。

**Architecture:** 純前端靜態 SPA。純函式模組（calc / format）負責計算與 markdown 解析／產生，Pinia store 管理多筆紀錄並持久化到 localStorage，Vue 元件負責 UI。資料流：localStorage ⇄ Pinia ⇄ 元件；markdown 僅作進出口。

**Tech Stack:** Vue 3 + Vite + TypeScript + Pinia + Vue Router + Vitest（+ @vue/test-utils + jsdom）；pnpm 管相依；changeset 管版本；GitHub Actions 部署 Pages。

## Global Constraints

- 套件管理器一律用 **pnpm**（不可用 npm/yarn）。
- 語言：**TypeScript**，`strict: true`。
- 領域介面名稱用 `LootRecord`（**不要**用 `Record`，避免與 TS 內建工具型別衝突）。
- markdown 策略：**輸出無損、輸入盡力**。序列化產生標準格式；解析盡力，解不掉的欄位留空／預設。
- 分配公式（唯一真理）：`個人收入 = 總表淨額/人數 + 他人內購總額/(人數-1) - 自己內購總額`。
- 金額顯示與輸出以 `Math.round` 取整；內部計算保留實數。
- localStorage key：`dc-loot-records`。
- 設計文件：`docs/superpowers/specs/2026-07-20-dc-loot-editor-design.md`（型別與格式以該文件為準）。

## File Structure

```
dc-loot-editor/                 ← repo 根（工作名，可改）
├── package.json
├── pnpm-workspace.yaml         ← 預留，單 package
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts             ← 含 vitest 設定與 base
├── index.html
├── .gitignore
├── .nvmrc
├── .changeset/config.json
├── .github/workflows/ci.yml
├── .github/workflows/deploy.yml
├── .github/workflows/release.yml
└── src/
    ├── main.ts
    ├── App.vue
    ├── router.ts
    ├── types.ts                       ← 領域型別
    ├── calc/distribution.ts           ← 淨額、baseShare、個人收入
    ├── calc/distribution.test.ts
    ├── format/serialize.ts            ← LootRecord → markdown
    ├── format/serialize.test.ts
    ├── format/parse.ts                ← markdown → LootRecord（盡力）
    ├── format/parse.test.ts
    ├── store/records.ts               ← Pinia，localStorage 持久化
    ├── store/records.test.ts
    ├── store/history.ts               ← autocomplete 聚合
    ├── store/history.test.ts
    └── components/
        ├── AutocompleteInput.vue
        ├── AutocompleteInput.test.ts
        ├── RecordList.vue
        ├── RecordEditor.vue
        ├── LootTable.vue
        ├── LootRow.vue
        ├── PurchaseTable.vue
        ├── PurchaseRow.vue
        ├── DistributionPanel.vue
        ├── ImportDialog.vue
        └── ExportDialog.vue
```

**檔名說明**：所有路徑相對於 repo 根 `dc-loot-editor/`。若你在 `C:\xampp\htdocs\dc` 直接建立，把 `dc-loot-editor/` 視為當前目錄根即可（本專案就是這個 repo）。

---

## Task 1: 專案骨架

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `.gitignore`, `.nvmrc`, `src/main.ts`, `src/App.vue`

**Interfaces:**
- Produces: 可執行的 `pnpm dev` / `pnpm test` / `pnpm build`；掛載 Pinia 與 Router 的 App 殼。

- [ ] **Step 1: 建立 `.gitignore`**

```
node_modules
dist
*.local
.DS_Store
```

- [ ] **Step 2: 建立 `.nvmrc`**

```
20
```

- [ ] **Step 3: 建立 `package.json`**

```json
{
  "name": "dc-loot-editor",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "vue": "^3.4.0",
    "vue-router": "^4.3.0",
    "pinia": "^2.1.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "@vue/test-utils": "^2.4.0",
    "jsdom": "^24.0.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.5.0",
    "vue-tsc": "^2.0.0"
  }
}
```

- [ ] **Step 4: 建立 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 5: 建立 `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 6: 建立 `vite.config.ts`**（含 base 與 vitest 設定）

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// GitHub Pages 子路徑；改 repo 名時同步改這裡
const REPO = 'dc-loot-editor'

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? `/${REPO}/` : '/',
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
```

- [ ] **Step 7: 建立 `index.html`**

```html
<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DC 打王分寶 Editor</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 8: 建立 `src/App.vue`**（暫時佔位，Task 8 換成 router-view）

```vue
<template>
  <main class="app">
    <h1>DC 打王分寶 Editor</h1>
  </main>
</template>
```

- [ ] **Step 9: 建立 `src/main.ts`**

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

createApp(App).use(createPinia()).mount('#app')
```

- [ ] **Step 10: 安裝相依並驗證**

Run: `pnpm install`
Expected: 安裝成功，產生 `pnpm-lock.yaml`。

- [ ] **Step 11: 驗證 build 通過**

Run: `pnpm build`
Expected: 產生 `dist/`，無型別錯誤。

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: 初始化 Vue3+Vite+TS+Pinia 專案骨架"
```

---

## Task 2: 領域型別與分配計算

**Files:**
- Create: `src/types.ts`, `src/calc/distribution.ts`, `src/calc/distribution.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`：`SettleStatus`, `LootStatus`, `Member`, `LootItem`, `Purchase`, `LootRecord`
  - `distribution.ts`：
    - `itemNet(item: LootItem): number`
    - `netTotal(items: LootItem[]): number`
    - `purchaseValue(p: Purchase): number`
    - `memberPurchaseTotal(purchases: Purchase[], handle: string): number`
    - `computeIncomes(record: LootRecord): Income[]`，`Income = { handle: string; base: number; own: number; others: number; income: number }`

- [ ] **Step 1: 建立 `src/types.ts`**

```ts
export type SettleStatus = 'settled' | 'pending'   // :ok: / :orange_square:
export type LootStatus = 'ok' | 'cart' | 'struck'  // :ok: / :shopping_cart: / 劃線(不計入)

export interface Member {
  handle: string           // 例 "@.unrealsky"
  settle: SettleStatus
}

export interface LootItem {
  status: LootStatus
  name: string
  qty: number
  unitPrice: number | null
  scissorCount?: number
  scissorUnitPrice?: number
  note?: string
}

export interface Purchase {
  buyer: string            // @handle，須存在於 members
  name: string
  qty: number
  unitPrice: number
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
```

- [ ] **Step 2: 寫失敗測試 `src/calc/distribution.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { itemNet, netTotal, purchaseValue, memberPurchaseTotal, computeIncomes } from './distribution'
import type { LootItem, LootRecord } from '../types'

const ok = (over: Partial<LootItem>): LootItem =>
  ({ status: 'ok', name: 'x', qty: 1, unitPrice: 0, ...over })

describe('itemNet', () => {
  it('單價×數量', () => {
    expect(itemNet(ok({ unitPrice: 475, qty: 6 }))).toBe(2850)
  })
  it('扣除剪刀成本', () => {
    expect(itemNet(ok({ unitPrice: 288, qty: 2, scissorUnitPrice: 80, scissorCount: 2 }))).toBe(416)
  })
  it('劃線項目不計入（回傳 0）', () => {
    expect(itemNet(ok({ status: 'struck', unitPrice: 999, qty: 3 }))).toBe(0)
  })
  it('unitPrice 為 null 視為 0', () => {
    expect(itemNet(ok({ unitPrice: null, qty: 3 }))).toBe(0)
  })
})

describe('netTotal', () => {
  it('加總未劃線項目淨額', () => {
    const items: LootItem[] = [
      ok({ unitPrice: 475, qty: 6 }),
      ok({ status: 'struck', unitPrice: 100, qty: 1 }),
      ok({ unitPrice: 168, qty: 2 }),
    ]
    expect(netTotal(items)).toBe(2850 + 336)
  })
})

describe('purchaseValue / memberPurchaseTotal', () => {
  it('單價×數量', () => {
    expect(purchaseValue({ buyer: '@a', name: 'x', qty: 2, unitPrice: 500 })).toBe(1000)
  })
  it('依買家加總', () => {
    const ps = [
      { buyer: '@a', name: 'x', qty: 2, unitPrice: 500 },
      { buyer: '@a', name: 'y', qty: 1, unitPrice: 500 },
      { buyer: '@b', name: 'z', qty: 1, unitPrice: 300 },
    ]
    expect(memberPurchaseTotal(ps, '@a')).toBe(1500)
    expect(memberPurchaseTotal(ps, '@b')).toBe(300)
  })
})

describe('computeIncomes', () => {
  const base: LootRecord = {
    id: '1', title: 't', date: '2026-07-19', boss: '混龍', memberCount: 5,
    members: [
      { handle: '@.unrealsky', settle: 'settled' },
      { handle: '@xiangjiaojiu', settle: 'pending' },
      { handle: '@must0505110', settle: 'pending' },
      { handle: '@auwoo', settle: 'pending' },
      { handle: '@x', settle: 'pending' },
    ],
    lootItems: [{ status: 'ok', name: '總表', qty: 1, unitPrice: 11288 }],
    purchases: [{ buyer: '@.unrealsky', name: '龍', qty: 3, unitPrice: 500 }],
    createdAt: '', updatedAt: '',
  }

  it('買家 = base - 自己內購', () => {
    const r = computeIncomes(base)
    const u = r.find((x) => x.handle === '@.unrealsky')!
    expect(Math.round(u.income)).toBe(758) // 11288/5 + 0 - 1500 = 757.6 → 758
  })
  it('其他人 = base + 他人內購/(N-1)', () => {
    const r = computeIncomes(base)
    const o = r.find((x) => x.handle === '@xiangjiaojiu')!
    expect(Math.round(o.income)).toBe(2633) // 2257.6 + 375 = 2632.6 → 2633
  })
})
```

- [ ] **Step 3: 執行測試確認失敗**

Run: `pnpm test`
Expected: FAIL（`distribution` 模組不存在）。

- [ ] **Step 4: 實作 `src/calc/distribution.ts`**

```ts
import type { LootItem, Purchase, LootRecord } from '../types'

export function itemNet(item: LootItem): number {
  if (item.status === 'struck') return 0
  const price = (item.unitPrice ?? 0) * item.qty
  const scissor = (item.scissorUnitPrice ?? 0) * (item.scissorCount ?? 0)
  return price - scissor
}

export function netTotal(items: LootItem[]): number {
  return items.reduce((sum, it) => sum + itemNet(it), 0)
}

export function purchaseValue(p: Purchase): number {
  return p.unitPrice * p.qty
}

export function memberPurchaseTotal(purchases: Purchase[], handle: string): number {
  return purchases
    .filter((p) => p.buyer === handle)
    .reduce((s, p) => s + purchaseValue(p), 0)
}

export interface Income {
  handle: string
  base: number
  own: number
  others: number
  income: number
}

export function computeIncomes(record: LootRecord): Income[] {
  const n = record.memberCount
  const base = n > 0 ? netTotal(record.lootItems) / n : 0
  const totalPurchase = record.purchases.reduce((s, p) => s + purchaseValue(p), 0)
  return record.members.map((m) => {
    const own = memberPurchaseTotal(record.purchases, m.handle)
    const others = totalPurchase - own
    const income = base + (n > 1 ? others / (n - 1) : 0) - own
    return { handle: m.handle, base, own, others, income }
  })
}
```

- [ ] **Step 5: 執行測試確認通過**

Run: `pnpm test`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/calc
git commit -m "feat: 領域型別與分配計算（淨額、剪刀成本、個人收入公式）"
```

---

## Task 3: 序列化 LootRecord → markdown

**Files:**
- Create: `src/format/serialize.ts`, `src/format/serialize.test.ts`

**Interfaces:**
- Consumes: `types.ts`、`calc/distribution.ts`（`netTotal`, `computeIncomes`）
- Produces: `serialize(record: LootRecord): string`

- [ ] **Step 1: 寫失敗測試 `src/format/serialize.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { serialize } from './serialize'
import type { LootRecord } from '../types'

const record: LootRecord = {
  id: '1', title: 't', date: '2026-07-19', boss: '混龍', memberCount: 5,
  members: [
    { handle: '@.unrealsky', settle: 'settled' },
    { handle: '@xiangjiaojiu', settle: 'pending' },
    { handle: '@must0505110', settle: 'pending' },
    { handle: '@auwoo', settle: 'pending' },
    { handle: '@x', settle: 'pending' },
  ],
  lootItems: [
    { status: 'ok', name: '附加大師', qty: 6, unitPrice: 475 },
    { status: 'struck', name: '上衣命60%', qty: 1, unitPrice: null, note: '(價格太低不計入)' },
    { status: 'ok', name: '手攻60%', qty: 2, unitPrice: 288, scissorUnitPrice: 80, scissorCount: 2 },
  ],
  purchases: [{ buyer: '@.unrealsky', name: '龍鍊', qty: 2, unitPrice: 500 }],
  createdAt: '', updatedAt: '',
}

describe('serialize', () => {
  const out = serialize(record)

  it('header', () => {
    expect(out).toContain('## 2026-07-19 混龍 / 5')
  })
  it('一般項目', () => {
    expect(out).toContain('* :ok: 附加大師x6: 475x6')
  })
  it('劃線項目含註解', () => {
    expect(out).toContain('* ~~:shopping_cart: 上衣命60%x1: (價格太低不計入)~~')
  })
  it('剪刀項目', () => {
    expect(out).toContain('* :ok: 手攻60%x2: 288x2 - 80(剪刀)x2')
  })
  it('內購區', () => {
    expect(out).toContain('## 內購區')
    expect(out).toContain('@.unrealsky: 龍鍊x2 = 500x2')
  })
  it('分配總共行', () => {
    // netTotal = 2850 + 0 + (288*2-80*2=416) = 3266; base=round(3266/5)=653
    expect(out).toContain('## 分配')
    expect(out).toContain('總共: 3266 / 5 = 653')
  })
  it('買家分配行（減自己內購）', () => {
    // base_raw=653.2 → 顯示 653；income=653.2+0-1000=-346.8 → -347
    expect(out).toContain('* :ok: @.unrealsky: 653 - 1000 = -347')
  })
  it('其他人分配行（加他人內購/(N-1)）', () => {
    // income=653.2+1000/4=903.2 → 903
    expect(out).toContain('* :orange_square: @xiangjiaojiu: 653 + 1000/4 = 903')
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `pnpm test src/format/serialize.test.ts`
Expected: FAIL（`serialize` 不存在）。

- [ ] **Step 3: 實作 `src/format/serialize.ts`**

```ts
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
```

- [ ] **Step 4: 執行測試確認通過**

Run: `pnpm test src/format/serialize.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/format/serialize.ts src/format/serialize.test.ts
git commit -m "feat: LootRecord 序列化為 DC 標準格式 markdown"
```

---

## Task 4: 解析 markdown → LootRecord（盡力）

**Files:**
- Create: `src/format/parse.ts`, `src/format/parse.test.ts`

**Interfaces:**
- Consumes: `types.ts`
- Produces: `parse(md: string): LootRecord`（解不掉的欄位留空／預設；分配區忽略，由公式重算）

- [ ] **Step 1: 寫失敗測試 `src/format/parse.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { parse } from './parse'
import { serialize } from './serialize'
import type { LootRecord } from '../types'

const sample = [
  '## 2026-07-19 混龍 / 5',
  '* :ok: 附加大師x6: 475x6',
  '* ~~:shopping_cart: 上衣命60%x1: (價格太低不計入)~~',
  '* :ok: 手攻60%x2: 288x2 - 80(剪刀)x2',
  '',
  '## 內購區',
  '@.unrealsky: 龍鍊x2 = 500x2',
  '',
  '## 分配',
  '總共: 3266 / 5 = 653',
  '* :ok: @.unrealsky: 653 - 1000 = -347',
  '* :orange_square: @xiangjiaojiu: 653 + 1000/4 = 903',
].join('\n')

describe('parse header', () => {
  const r = parse(sample)
  it('date/boss/memberCount', () => {
    expect(r.date).toBe('2026-07-19')
    expect(r.boss).toBe('混龍')
    expect(r.memberCount).toBe(5)
  })
})

describe('parse loot items', () => {
  const r = parse(sample)
  it('一般項目', () => {
    expect(r.lootItems[0]).toMatchObject({ status: 'ok', name: '附加大師', qty: 6, unitPrice: 475 })
  })
  it('劃線項目 + 註解', () => {
    expect(r.lootItems[1]).toMatchObject({ status: 'struck', name: '上衣命60%', qty: 1, note: '(價格太低不計入)' })
  })
  it('剪刀項目', () => {
    expect(r.lootItems[2]).toMatchObject({
      status: 'ok', name: '手攻60%', qty: 2, unitPrice: 288, scissorUnitPrice: 80, scissorCount: 2,
    })
  })
})

describe('parse purchases', () => {
  const r = parse(sample)
  it('內購一筆', () => {
    expect(r.purchases[0]).toMatchObject({ buyer: '@.unrealsky', name: '龍鍊', qty: 2, unitPrice: 500 })
  })
})

describe('parse members（來自分配區）', () => {
  const r = parse(sample)
  it('handle 與結清狀態', () => {
    expect(r.members).toEqual([
      { handle: '@.unrealsky', settle: 'settled' },
      { handle: '@xiangjiaojiu', settle: 'pending' },
    ])
  })
})

describe('round-trip', () => {
  it('parse → serialize 產生等價標準格式的核心欄位', () => {
    const r: LootRecord = { ...parse(sample), id: '1', title: 't', createdAt: '', updatedAt: '' }
    const out = serialize(r)
    expect(out).toContain('* :ok: 附加大師x6: 475x6')
    expect(out).toContain('* ~~:shopping_cart: 上衣命60%x1: (價格太低不計入)~~')
    expect(out).toContain('* :ok: 手攻60%x2: 288x2 - 80(剪刀)x2')
    expect(out).toContain('@.unrealsky: 龍鍊x2 = 500x2')
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `pnpm test src/format/parse.test.ts`
Expected: FAIL（`parse` 不存在）。

- [ ] **Step 3: 實作 `src/format/parse.ts`**

```ts
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
```

- [ ] **Step 4: 執行測試確認通過**

Run: `pnpm test src/format/parse.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/format/parse.ts src/format/parse.test.ts
git commit -m "feat: 盡力解析 DC markdown 為 LootRecord（含 round-trip 測試）"
```

---

## Task 5: Pinia records store + localStorage 持久化

**Files:**
- Create: `src/store/records.ts`, `src/store/records.test.ts`

**Interfaces:**
- Consumes: `types.ts`
- Produces: `useRecordsStore()`，暴露
  - `records: Ref<LootRecord[]>`
  - `get(id: string): LootRecord | undefined`
  - `create(partial?: Partial<LootRecord>): LootRecord`（回傳新建、已存入）
  - `upsert(r: LootRecord): void`
  - `remove(id: string): void`
  - `duplicate(id: string): LootRecord | undefined`
  - 常數 `STORAGE_KEY = 'dc-loot-records'`

- [ ] **Step 1: 寫失敗測試 `src/store/records.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRecordsStore, STORAGE_KEY } from './records'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('records store', () => {
  it('create 產生帶 id 的紀錄並存入', () => {
    const store = useRecordsStore()
    const r = store.create({ title: '測試' })
    expect(r.id).toBeTruthy()
    expect(r.title).toBe('測試')
    expect(store.records).toHaveLength(1)
  })

  it('持久化到 localStorage', () => {
    const store = useRecordsStore()
    store.create({ title: 'A' })
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(saved).toHaveLength(1)
    expect(saved[0].title).toBe('A')
  })

  it('upsert 更新既有紀錄', () => {
    const store = useRecordsStore()
    const r = store.create({ title: 'A' })
    store.upsert({ ...r, title: 'B' })
    expect(store.get(r.id)!.title).toBe('B')
    expect(store.records).toHaveLength(1)
  })

  it('remove 刪除', () => {
    const store = useRecordsStore()
    const r = store.create({ title: 'A' })
    store.remove(r.id)
    expect(store.records).toHaveLength(0)
  })

  it('duplicate 複製為新 id', () => {
    const store = useRecordsStore()
    const r = store.create({ title: 'A' })
    const copy = store.duplicate(r.id)!
    expect(copy.id).not.toBe(r.id)
    expect(store.records).toHaveLength(2)
  })

  it('重新載入時從 localStorage 還原', () => {
    const s1 = useRecordsStore()
    s1.create({ title: 'persist' })
    setActivePinia(createPinia())
    const s2 = useRecordsStore()
    expect(s2.records).toHaveLength(1)
    expect(s2.records[0].title).toBe('persist')
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `pnpm test src/store/records.test.ts`
Expected: FAIL（`records` store 不存在）。

- [ ] **Step 3: 實作 `src/store/records.ts`**

```ts
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { LootRecord } from '../types'

export const STORAGE_KEY = 'dc-loot-records'

function load(): LootRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as LootRecord[]) : []
  } catch {
    return []
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

export const useRecordsStore = defineStore('records', () => {
  const records = ref<LootRecord[]>(load())

  watch(
    records,
    (val) => localStorage.setItem(STORAGE_KEY, JSON.stringify(val)),
    { deep: true },
  )

  function get(id: string): LootRecord | undefined {
    return records.value.find((r) => r.id === id)
  }

  function create(partial: Partial<LootRecord> = {}): LootRecord {
    const ts = nowIso()
    const rec: LootRecord = {
      id: crypto.randomUUID(),
      title: '',
      date: '',
      boss: '',
      memberCount: 0,
      members: [],
      lootItems: [],
      purchases: [],
      createdAt: ts,
      updatedAt: ts,
      ...partial,
    }
    records.value.push(rec)
    return rec
  }

  function upsert(r: LootRecord): void {
    const idx = records.value.findIndex((x) => x.id === r.id)
    const updated = { ...r, updatedAt: nowIso() }
    if (idx >= 0) records.value[idx] = updated
    else records.value.push(updated)
  }

  function remove(id: string): void {
    records.value = records.value.filter((r) => r.id !== id)
  }

  function duplicate(id: string): LootRecord | undefined {
    const src = get(id)
    if (!src) return undefined
    return create({ ...src, id: undefined, title: `${src.title} (複製)` } as Partial<LootRecord>)
  }

  return { records, get, create, upsert, remove, duplicate }
})
```

- [ ] **Step 4: 執行測試確認通過**

Run: `pnpm test src/store/records.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/store/records.ts src/store/records.test.ts
git commit -m "feat: Pinia records store 與 localStorage 持久化"
```

---

## Task 6: 歷史建議聚合

**Files:**
- Create: `src/store/history.ts`, `src/store/history.test.ts`

**Interfaces:**
- Consumes: `store/records.ts`、`types.ts`
- Produces: `useHistory()`，暴露
  - `itemNames: ComputedRef<string[]>`（去重，依出現次數排序）
  - `handles: ComputedRef<string[]>`
  - `bosses: ComputedRef<string[]>`
  - `priceSuggestions(name: string): { price: number; date: string }[]`（該品名歷史單價，依日期新到舊）

- [ ] **Step 1: 寫失敗測試 `src/store/history.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRecordsStore } from './records'
import { useHistory } from './history'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

function seed() {
  const store = useRecordsStore()
  store.create({
    title: 'r1', date: '2026-07-19', boss: '混龍',
    members: [{ handle: '@a', settle: 'settled' }],
    lootItems: [{ status: 'ok', name: '楓祝30', qty: 1, unitPrice: 6400 }],
    purchases: [],
  })
  store.create({
    title: 'r2', date: '2026-07-20', boss: '闇黑龍王',
    members: [{ handle: '@b', settle: 'pending' }],
    lootItems: [{ status: 'ok', name: '楓祝30', qty: 1, unitPrice: 6800 }],
    purchases: [],
  })
}

describe('history', () => {
  it('聚合品名', () => {
    seed()
    const h = useHistory()
    expect(h.itemNames.value).toContain('楓祝30')
  })
  it('聚合 handle', () => {
    seed()
    const h = useHistory()
    expect(h.handles.value).toEqual(expect.arrayContaining(['@a', '@b']))
  })
  it('聚合王名', () => {
    seed()
    const h = useHistory()
    expect(h.bosses.value).toEqual(expect.arrayContaining(['混龍', '闇黑龍王']))
  })
  it('單價建議依日期新到舊並帶日期', () => {
    seed()
    const h = useHistory()
    expect(h.priceSuggestions('楓祝30')).toEqual([
      { price: 6800, date: '2026-07-20' },
      { price: 6400, date: '2026-07-19' },
    ])
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `pnpm test src/store/history.test.ts`
Expected: FAIL（`history` 不存在）。

- [ ] **Step 3: 實作 `src/store/history.ts`**

```ts
import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useRecordsStore } from './records'

function uniqueByFrequency(values: string[]): string[] {
  const freq = new Map<string, number>()
  for (const v of values) {
    if (!v) continue
    freq.set(v, (freq.get(v) ?? 0) + 1)
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v)
}

export interface PriceSuggestion {
  price: number
  date: string
}

export function useHistory() {
  const store = useRecordsStore()

  const itemNames: ComputedRef<string[]> = computed(() =>
    uniqueByFrequency(store.records.flatMap((r) => r.lootItems.map((it) => it.name))),
  )

  const handles: ComputedRef<string[]> = computed(() =>
    uniqueByFrequency(store.records.flatMap((r) => r.members.map((m) => m.handle))),
  )

  const bosses: ComputedRef<string[]> = computed(() =>
    uniqueByFrequency(store.records.map((r) => r.boss)),
  )

  function priceSuggestions(name: string): PriceSuggestion[] {
    const out: PriceSuggestion[] = []
    for (const r of store.records) {
      for (const it of r.lootItems) {
        if (it.name === name && it.unitPrice != null) {
          out.push({ price: it.unitPrice, date: r.date })
        }
      }
    }
    return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }

  return { itemNames, handles, bosses, priceSuggestions }
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `pnpm test src/store/history.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/store/history.ts src/store/history.test.ts
git commit -m "feat: 歷史建議聚合（品名、handle、王名、帶日期單價）"
```

---

## Task 7: AutocompleteInput 共用元件

**Files:**
- Create: `src/components/AutocompleteInput.vue`, `src/components/AutocompleteInput.test.ts`

**Interfaces:**
- Produces: `<AutocompleteInput>` 元件
  - props：`modelValue: string`、`suggestions: string[]`、`placeholder?: string`
  - emits：`update:modelValue`（v-model）、`select`（選定某建議時）
  - 行為：輸入時以 `modelValue` 前綴過濾 `suggestions` 顯示下拉；點選填入並 emit。

- [ ] **Step 1: 寫失敗測試 `src/components/AutocompleteInput.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AutocompleteInput from './AutocompleteInput.vue'

describe('AutocompleteInput', () => {
  it('依輸入前綴過濾建議', async () => {
    const wrapper = mount(AutocompleteInput, {
      props: { modelValue: '', suggestions: ['附加大師', '附加奇幻', '楓祝30'] },
    })
    await wrapper.find('input').setValue('附加')
    const options = wrapper.findAll('.suggestion')
    expect(options).toHaveLength(2)
    expect(options[0].text()).toBe('附加大師')
  })

  it('點選建議會 emit update:modelValue 與 select', async () => {
    const wrapper = mount(AutocompleteInput, {
      props: { modelValue: '附', suggestions: ['附加大師'] },
    })
    await wrapper.find('input').setValue('附')
    await wrapper.find('.suggestion').trigger('mousedown')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['附加大師'])
    expect(wrapper.emitted('select')![0]).toEqual(['附加大師'])
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `pnpm test src/components/AutocompleteInput.test.ts`
Expected: FAIL（元件不存在）。

- [ ] **Step 3: 實作 `src/components/AutocompleteInput.vue`**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  modelValue: string
  suggestions: string[]
  placeholder?: string
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [value: string]
}>()

const open = ref(false)

const filtered = computed(() => {
  const q = props.modelValue.trim()
  if (!q) return props.suggestions.slice(0, 20)
  return props.suggestions.filter((s) => s.startsWith(q)).slice(0, 20)
})

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
  open.value = true
}

function choose(s: string) {
  emit('update:modelValue', s)
  emit('select', s)
  open.value = false
}
</script>

<template>
  <div class="autocomplete">
    <input
      :value="modelValue"
      :placeholder="placeholder"
      @input="onInput"
      @focus="open = true"
      @blur="open = false"
    />
    <ul v-if="open && filtered.length" class="suggestions">
      <li
        v-for="s in filtered"
        :key="s"
        class="suggestion"
        @mousedown.prevent="choose(s)"
      >
        {{ s }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.autocomplete { position: relative; }
.suggestions {
  position: absolute; z-index: 10; left: 0; right: 0; margin: 0; padding: 0;
  list-style: none; background: #fff; border: 1px solid #ccc; max-height: 200px; overflow-y: auto;
}
.suggestion { padding: 4px 8px; cursor: pointer; }
.suggestion:hover { background: #eef; }
</style>
```

- [ ] **Step 4: 執行測試確認通過**

Run: `pnpm test src/components/AutocompleteInput.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/components/AutocompleteInput.vue src/components/AutocompleteInput.test.ts
git commit -m "feat: AutocompleteInput 共用歷史建議輸入元件"
```

---

## Task 8: Router、App 殼與列表頁

**Files:**
- Create: `src/router.ts`, `src/components/RecordList.vue`
- Modify: `src/App.vue`, `src/main.ts`

**Interfaces:**
- Consumes: `store/records.ts`
- Produces: 路由 `/`（RecordList）、`/edit/:id`（RecordEditor，Task 9 建立）；App 顯示 `<router-view>`。

- [ ] **Step 1: 建立 `src/components/RecordList.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useRecordsStore } from '../store/records'
import { parse } from '../format/parse'

const store = useRecordsStore()
const router = useRouter()

const sorted = computed(() =>
  [...store.records].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
)

function createNew() {
  const r = store.create({ title: '未命名分寶' })
  router.push(`/edit/${r.id}`)
}

function importPaste() {
  const md = window.prompt('貼上 DC 內容：')
  if (!md) return
  const parsed = parse(md)
  const r = store.create({ ...parsed, title: parsed.boss || '匯入的分寶' })
  router.push(`/edit/${r.id}`)
}

function remove(id: string) {
  if (window.confirm('確定刪除這筆紀錄？')) store.remove(id)
}

function duplicate(id: string) {
  store.duplicate(id)
}
</script>

<template>
  <section>
    <div class="toolbar">
      <button @click="createNew">新增紀錄</button>
      <button @click="importPaste">貼上 DC 匯入</button>
    </div>
    <p v-if="!sorted.length">尚無紀錄。</p>
    <ul class="record-list">
      <li v-for="r in sorted" :key="r.id" class="record-item">
        <router-link :to="`/edit/${r.id}`">{{ r.title || '(無標題)' }}</router-link>
        <span class="date">{{ r.date }}</span>
        <button @click="duplicate(r.id)">複製</button>
        <button @click="remove(r.id)">刪除</button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.toolbar { margin-bottom: 12px; display: flex; gap: 8px; }
.record-list { list-style: none; padding: 0; }
.record-item { display: flex; gap: 12px; align-items: center; padding: 6px 0; border-bottom: 1px solid #eee; }
.date { color: #888; font-size: 0.9em; }
</style>
```

- [ ] **Step 2: 建立 `src/router.ts`**

```ts
import { createRouter, createWebHashHistory } from 'vue-router'
import RecordList from './components/RecordList.vue'

const routes = [
  { path: '/', component: RecordList },
  { path: '/edit/:id', component: () => import('./components/RecordEditor.vue') },
]

export const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})
```

> 用 hash history 避免 GitHub Pages 子路徑的深連結 404。

- [ ] **Step 3: 修改 `src/App.vue`**

```vue
<template>
  <main class="app">
    <header><router-link to="/"><h1>DC 打王分寶 Editor</h1></router-link></header>
    <router-view />
  </main>
</template>

<style>
.app { max-width: 900px; margin: 0 auto; padding: 16px; font-family: system-ui, sans-serif; }
header a { text-decoration: none; color: inherit; }
button { cursor: pointer; }
</style>
```

- [ ] **Step 4: 修改 `src/main.ts` 掛載 router**

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'

createApp(App).use(createPinia()).use(router).mount('#app')
```

- [ ] **Step 5: 建立佔位 `src/components/RecordEditor.vue`**（Task 9 完整實作，先讓路由可編譯）

```vue
<template>
  <p>編輯頁（待實作）</p>
</template>
```

- [ ] **Step 6: 驗證 build 通過**

Run: `pnpm build`
Expected: 無型別錯誤，`dist/` 產生。

- [ ] **Step 7: Commit**

```bash
git add src/router.ts src/App.vue src/main.ts src/components/RecordList.vue src/components/RecordEditor.vue
git commit -m "feat: router、App 殼與紀錄列表頁（新增／匯入／複製／刪除）"
```

---

## Task 9: 編輯頁容器與總表區

**Files:**
- Modify: `src/components/RecordEditor.vue`
- Create: `src/components/LootTable.vue`, `src/components/LootRow.vue`

**Interfaces:**
- Consumes: `store/records.ts`、`store/history.ts`、`AutocompleteInput.vue`、`types.ts`、`calc/distribution.ts`（`itemNet`）
- Produces:
  - `RecordEditor` 綁定當前紀錄的 header 欄位與 members，並嵌入 `LootTable`
  - `LootTable` props：`modelValue: LootItem[]`；emit `update:modelValue`
  - `LootRow` props：`modelValue: LootItem`；emit `update:modelValue`、`remove`

- [ ] **Step 1: 建立 `src/components/LootRow.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { LootItem, LootStatus } from '../types'
import { itemNet } from '../calc/distribution'
import { useHistory } from '../store/history'
import AutocompleteInput from './AutocompleteInput.vue'

const props = defineProps<{ modelValue: LootItem }>()
const emit = defineEmits<{ 'update:modelValue': [v: LootItem]; remove: [] }>()

const history = useHistory()
const STATUS_CYCLE: LootStatus[] = ['ok', 'cart', 'struck']
const STATUS_LABEL: Record<LootStatus, string> = { ok: ':ok:', cart: ':shopping_cart:', struck: '劃線' }

function patch(part: Partial<LootItem>) {
  emit('update:modelValue', { ...props.modelValue, ...part })
}
function cycleStatus() {
  const i = STATUS_CYCLE.indexOf(props.modelValue.status)
  patch({ status: STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length] })
}
function onNameSelect(name: string) {
  const s = history.priceSuggestions(name)
  if (s.length) patch({ name, unitPrice: s[0].price })
}
const net = computed(() => itemNet(props.modelValue))
const priceHints = computed(() =>
  history.priceSuggestions(props.modelValue.name).map((p) => `${p.price}（${p.date}）`),
)
</script>

<template>
  <tr>
    <td><button type="button" @click="cycleStatus">{{ STATUS_LABEL[modelValue.status] }}</button></td>
    <td>
      <AutocompleteInput
        :model-value="modelValue.name"
        :suggestions="history.itemNames.value"
        placeholder="品名"
        @update:model-value="patch({ name: $event })"
        @select="onNameSelect"
      />
    </td>
    <td><input type="number" :value="modelValue.qty" @input="patch({ qty: Number(($event.target as HTMLInputElement).value) })" style="width:4em" /></td>
    <td><input type="number" :value="modelValue.unitPrice ?? ''" @input="patch({ unitPrice: ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value) })" style="width:6em" list="none" /></td>
    <td><input type="number" :value="modelValue.scissorCount ?? ''" placeholder="剪數" @input="patch({ scissorCount: Number(($event.target as HTMLInputElement).value) || undefined })" style="width:4em" /></td>
    <td><input type="number" :value="modelValue.scissorUnitPrice ?? ''" placeholder="剪價" @input="patch({ scissorUnitPrice: Number(($event.target as HTMLInputElement).value) || undefined })" style="width:5em" /></td>
    <td><input :value="modelValue.note ?? ''" placeholder="註解" @input="patch({ note: ($event.target as HTMLInputElement).value || undefined })" /></td>
    <td class="net">{{ net }}</td>
    <td><button type="button" @click="emit('remove')">✕</button></td>
    <td class="hints">{{ priceHints.join(' / ') }}</td>
  </tr>
</template>

<style scoped>
.net { text-align: right; font-variant-numeric: tabular-nums; }
.hints { color: #999; font-size: 0.75em; }
</style>
```

- [ ] **Step 2: 建立 `src/components/LootTable.vue`**

```vue
<script setup lang="ts">
import type { LootItem } from '../types'
import LootRow from './LootRow.vue'

const props = defineProps<{ modelValue: LootItem[] }>()
const emit = defineEmits<{ 'update:modelValue': [v: LootItem[]] }>()

function updateAt(i: number, item: LootItem) {
  const next = [...props.modelValue]
  next[i] = item
  emit('update:modelValue', next)
}
function removeAt(i: number) {
  emit('update:modelValue', props.modelValue.filter((_, idx) => idx !== i))
}
function add() {
  emit('update:modelValue', [
    ...props.modelValue,
    { status: 'ok', name: '', qty: 1, unitPrice: null },
  ])
}
</script>

<template>
  <div>
    <h3>總表</h3>
    <table>
      <thead>
        <tr><th>狀態</th><th>品名</th><th>數量</th><th>單價</th><th>剪數</th><th>剪價</th><th>註解</th><th>淨額</th><th></th><th>歷史</th></tr>
      </thead>
      <tbody>
        <LootRow
          v-for="(it, i) in modelValue"
          :key="i"
          :model-value="it"
          @update:model-value="updateAt(i, $event)"
          @remove="removeAt(i)"
        />
      </tbody>
    </table>
    <button type="button" @click="add">＋ 新增項目</button>
  </div>
</template>
```

- [ ] **Step 3: 實作 `src/components/RecordEditor.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useRecordsStore } from '../store/records'
import { useHistory } from '../store/history'
import type { LootRecord, LootItem, Member } from '../types'
import LootTable from './LootTable.vue'
import AutocompleteInput from './AutocompleteInput.vue'

const route = useRoute()
const store = useRecordsStore()
const history = useHistory()

const record = computed<LootRecord | undefined>(() => store.get(route.params.id as string))

function patch(part: Partial<LootRecord>) {
  if (record.value) store.upsert({ ...record.value, ...part })
}
function setLootItems(items: LootItem[]) {
  patch({ lootItems: items })
}
function setMembers(members: Member[]) {
  patch({ members })
}
function addMember() {
  if (!record.value) return
  setMembers([...record.value.members, { handle: '', settle: 'pending' }])
}
function updateMember(i: number, part: Partial<Member>) {
  if (!record.value) return
  const next = [...record.value.members]
  next[i] = { ...next[i], ...part }
  setMembers(next)
}
function removeMember(i: number) {
  if (!record.value) return
  setMembers(record.value.members.filter((_, idx) => idx !== i))
}
</script>

<template>
  <section v-if="record">
    <div class="header-fields">
      <label>標題*<input :value="record.title" @input="patch({ title: ($event.target as HTMLInputElement).value })" /></label>
      <label>日期<input type="date" :value="record.date" @input="patch({ date: ($event.target as HTMLInputElement).value })" /></label>
      <label>王名
        <AutocompleteInput :model-value="record.boss" :suggestions="history.bosses.value"
          @update:model-value="patch({ boss: $event })" />
      </label>
      <label>人數<input type="number" :value="record.memberCount" style="width:4em"
        @input="patch({ memberCount: Number(($event.target as HTMLInputElement).value) })" /></label>
    </div>

    <h3>團員</h3>
    <ul class="members">
      <li v-for="(m, i) in record.members" :key="i">
        <AutocompleteInput :model-value="m.handle" :suggestions="history.handles.value"
          placeholder="@handle" @update:model-value="updateMember(i, { handle: $event })" />
        <button type="button" @click="updateMember(i, { settle: m.settle === 'settled' ? 'pending' : 'settled' })">
          {{ m.settle === 'settled' ? ':ok:' : ':orange_square:' }}
        </button>
        <button type="button" @click="removeMember(i)">✕</button>
      </li>
    </ul>
    <button type="button" @click="addMember">＋ 新增團員</button>

    <LootTable :model-value="record.lootItems" @update:model-value="setLootItems" />
  </section>
  <p v-else>找不到此紀錄。</p>
</template>

<style scoped>
.header-fields { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
.header-fields label { display: flex; flex-direction: column; font-size: 0.85em; }
.members { list-style: none; padding: 0; }
.members li { display: flex; gap: 8px; align-items: center; margin-bottom: 4px; }
</style>
```

- [ ] **Step 4: 驗證 build 通過**

Run: `pnpm build`
Expected: 無型別錯誤。

- [ ] **Step 5: 手動冒煙測試**

Run: `pnpm dev`，瀏覽器開 `/`，新增紀錄 → 編輯頁可填 header、團員、總表項目，淨額即時更新，狀態鈕可循環。
Expected: 皆正常。

- [ ] **Step 6: Commit**

```bash
git add src/components/RecordEditor.vue src/components/LootTable.vue src/components/LootRow.vue
git commit -m "feat: 編輯頁容器、header/團員欄位與總表區（即時淨額、歷史建議）"
```

---

## Task 10: 內購區與分配結果面板

**Files:**
- Create: `src/components/PurchaseTable.vue`, `src/components/PurchaseRow.vue`, `src/components/DistributionPanel.vue`
- Modify: `src/components/RecordEditor.vue`

**Interfaces:**
- Consumes: `types.ts`、`calc/distribution.ts`（`computeIncomes`, `purchaseValue`）、`store/history.ts`、`AutocompleteInput.vue`
- Produces:
  - `PurchaseTable` props：`modelValue: Purchase[]`、`members: Member[]`；emit `update:modelValue`
  - `PurchaseRow` props：`modelValue: Purchase`、`memberHandles: string[]`；emit `update:modelValue`、`remove`
  - `DistributionPanel` props：`record: LootRecord`（唯讀顯示每人收入）

- [ ] **Step 1: 建立 `src/components/PurchaseRow.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { Purchase } from '../types'
import { purchaseValue } from '../calc/distribution'
import { useHistory } from '../store/history'
import AutocompleteInput from './AutocompleteInput.vue'

const props = defineProps<{ modelValue: Purchase; memberHandles: string[] }>()
const emit = defineEmits<{ 'update:modelValue': [v: Purchase]; remove: [] }>()
const history = useHistory()

function patch(part: Partial<Purchase>) {
  emit('update:modelValue', { ...props.modelValue, ...part })
}
const value = computed(() => purchaseValue(props.modelValue))
</script>

<template>
  <tr>
    <td>
      <AutocompleteInput :model-value="modelValue.buyer" :suggestions="memberHandles"
        placeholder="@買家" @update:model-value="patch({ buyer: $event })" />
    </td>
    <td>
      <AutocompleteInput :model-value="modelValue.name" :suggestions="history.itemNames.value"
        placeholder="品名" @update:model-value="patch({ name: $event })" />
    </td>
    <td><input type="number" :value="modelValue.qty" style="width:4em"
      @input="patch({ qty: Number(($event.target as HTMLInputElement).value) })" /></td>
    <td><input type="number" :value="modelValue.unitPrice" style="width:6em"
      @input="patch({ unitPrice: Number(($event.target as HTMLInputElement).value) })" /></td>
    <td class="val">{{ value }}</td>
    <td><button type="button" @click="emit('remove')">✕</button></td>
  </tr>
</template>

<style scoped>
.val { text-align: right; font-variant-numeric: tabular-nums; }
</style>
```

- [ ] **Step 2: 建立 `src/components/PurchaseTable.vue`**

```vue
<script setup lang="ts">
import type { Purchase, Member } from '../types'
import { computed } from 'vue'
import PurchaseRow from './PurchaseRow.vue'

const props = defineProps<{ modelValue: Purchase[]; members: Member[] }>()
const emit = defineEmits<{ 'update:modelValue': [v: Purchase[]] }>()

const memberHandles = computed(() => props.members.map((m) => m.handle).filter(Boolean))

function updateAt(i: number, p: Purchase) {
  const next = [...props.modelValue]
  next[i] = p
  emit('update:modelValue', next)
}
function removeAt(i: number) {
  emit('update:modelValue', props.modelValue.filter((_, idx) => idx !== i))
}
function add() {
  emit('update:modelValue', [...props.modelValue, { buyer: '', name: '', qty: 1, unitPrice: 0 }])
}
</script>

<template>
  <div>
    <h3>內購區</h3>
    <table>
      <thead><tr><th>買家</th><th>品名</th><th>數量</th><th>單價</th><th>金額</th><th></th></tr></thead>
      <tbody>
        <PurchaseRow
          v-for="(p, i) in modelValue"
          :key="i"
          :model-value="p"
          :member-handles="memberHandles"
          @update:model-value="updateAt(i, $event)"
          @remove="removeAt(i)"
        />
      </tbody>
    </table>
    <button type="button" @click="add">＋ 新增內購</button>
  </div>
</template>
```

- [ ] **Step 3: 建立 `src/components/DistributionPanel.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { LootRecord } from '../types'
import { netTotal, computeIncomes } from '../calc/distribution'

const props = defineProps<{ record: LootRecord }>()

const total = computed(() => netTotal(props.record.lootItems))
const baseDisplay = computed(() =>
  Math.round(props.record.memberCount > 0 ? total.value / props.record.memberCount : 0),
)
const rows = computed(() =>
  computeIncomes(props.record).map((i) => ({ ...i, rounded: Math.round(i.income) })),
)
</script>

<template>
  <div class="dist">
    <h3>分配</h3>
    <p>總共: {{ total }} / {{ record.memberCount }} = {{ baseDisplay }}</p>
    <table>
      <thead><tr><th>團員</th><th>基本</th><th>他人內購/(N-1)</th><th>自己內購</th><th>收入</th></tr></thead>
      <tbody>
        <tr v-for="r in rows" :key="r.handle">
          <td>{{ r.handle }}</td>
          <td class="num">{{ baseDisplay }}</td>
          <td class="num">{{ record.memberCount > 1 ? Math.round(r.others / (record.memberCount - 1)) : 0 }}</td>
          <td class="num">{{ r.own }}</td>
          <td class="num strong">{{ r.rounded }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.num { text-align: right; font-variant-numeric: tabular-nums; }
.strong { font-weight: bold; }
</style>
```

- [ ] **Step 4: 在 `RecordEditor.vue` 嵌入內購與分配**

在 `<script setup>` 匯入區加入：

```ts
import PurchaseTable from './PurchaseTable.vue'
import DistributionPanel from './DistributionPanel.vue'
import type { Purchase } from '../types'
```

在 `setMembers` 之後新增方法：

```ts
function setPurchases(purchases: Purchase[]) {
  patch({ purchases })
}
```

在 template 的 `<LootTable ... />` 之後、`</section>` 之前插入：

```vue
    <PurchaseTable :model-value="record.purchases" :members="record.members"
      @update:model-value="setPurchases" />
    <DistributionPanel :record="record" />
```

- [ ] **Step 5: 驗證 build 通過**

Run: `pnpm build`
Expected: 無型別錯誤。

- [ ] **Step 6: 手動冒煙測試**

Run: `pnpm dev`，於編輯頁新增內購 → 分配面板每人收入即時更新，符合公式（買家減自己內購、其他人加他人內購/(N-1)）。
Expected: 數字正確。

- [ ] **Step 7: Commit**

```bash
git add src/components/PurchaseTable.vue src/components/PurchaseRow.vue src/components/DistributionPanel.vue src/components/RecordEditor.vue
git commit -m "feat: 內購區與即時分配結果面板"
```

---

## Task 11: 匯入 / 匯出對話框

**Files:**
- Create: `src/components/ImportDialog.vue`, `src/components/ExportDialog.vue`
- Modify: `src/components/RecordEditor.vue`, `src/components/RecordList.vue`

**Interfaces:**
- Consumes: `format/parse.ts`、`format/serialize.ts`、`types.ts`
- Produces:
  - `ImportDialog` props：`open: boolean`；emit `close`、`imported: Partial<LootRecord>`（解析結果）
  - `ExportDialog` props：`open: boolean`、`record: LootRecord`；emit `close`（內部產生 markdown 與複製按鈕）

- [ ] **Step 1: 建立 `src/components/ImportDialog.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { parse } from '../format/parse'
import type { LootRecord } from '../types'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; imported: [v: Partial<LootRecord>] }>()

const text = ref('')

function doImport() {
  emit('imported', parse(text.value))
  text.value = ''
  emit('close')
}
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <div class="dialog">
      <h3>貼上 DC 內容</h3>
      <textarea v-model="text" rows="12"></textarea>
      <div class="actions">
        <button type="button" @click="doImport">匯入</button>
        <button type="button" @click="emit('close')">取消</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; }
.dialog { background: #fff; padding: 16px; width: min(640px, 90vw); }
.dialog textarea { width: 100%; box-sizing: border-box; }
.actions { display: flex; gap: 8px; margin-top: 8px; }
</style>
```

- [ ] **Step 2: 建立 `src/components/ExportDialog.vue`**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { serialize } from '../format/serialize'
import type { LootRecord } from '../types'

const props = defineProps<{ open: boolean; record: LootRecord }>()
const emit = defineEmits<{ close: [] }>()

const md = computed(() => serialize(props.record))
const copied = ref(false)

async function copy() {
  await navigator.clipboard.writeText(md.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <div class="dialog">
      <h3>複製回 DC</h3>
      <textarea :value="md" rows="16" readonly></textarea>
      <div class="actions">
        <button type="button" @click="copy">{{ copied ? '已複製 ✓' : '複製' }}</button>
        <button type="button" @click="emit('close')">關閉</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; }
.dialog { background: #fff; padding: 16px; width: min(640px, 90vw); }
.dialog textarea { width: 100%; box-sizing: border-box; font-family: monospace; }
.actions { display: flex; gap: 8px; margin-top: 8px; }
</style>
```

- [ ] **Step 3: 在 `RecordEditor.vue` 加入匯出鈕與 ImportDialog（覆蓋匯入當前紀錄）**

在 `<script setup>` 匯入區加入：

```ts
import { ref } from 'vue'
import ExportDialog from './ExportDialog.vue'
import ImportDialog from './ImportDialog.vue'
```

在既有 script 內新增狀態與方法：

```ts
const showExport = ref(false)
const showImport = ref(false)
function applyImport(partial: Partial<LootRecord>) {
  if (record.value) store.upsert({ ...record.value, ...partial })
}
```

在 template 的 header-fields `<div>` 之前插入工具列：

```vue
    <div class="editor-toolbar">
      <button type="button" @click="showImport = true">重新貼上匯入</button>
      <button type="button" @click="showExport = true">複製回 DC</button>
    </div>
```

在 `</section>` 之前插入對話框：

```vue
    <ImportDialog :open="showImport" @close="showImport = false" @imported="applyImport" />
    <ExportDialog :open="showExport" :record="record" @close="showExport = false" />
```

- [ ] **Step 4: 驗證 build 通過**

Run: `pnpm build`
Expected: 無型別錯誤。

- [ ] **Step 5: 手動冒煙測試（完整 round-trip）**

Run: `pnpm dev`
1. 新增紀錄，於「重新貼上匯入」貼入設計文件的範例 markdown → 表單填入。
2. 補上 title。
3. 「複製回 DC」→ 檢視產生的標準格式與分配數字正確。
Expected: 進出一致，分配符合公式。

- [ ] **Step 6: Commit**

```bash
git add src/components/ImportDialog.vue src/components/ExportDialog.vue src/components/RecordEditor.vue src/components/RecordList.vue
git commit -m "feat: 匯入／匯出對話框與完整 DC round-trip"
```

---

## Task 12: changeset 與 GitHub Actions（CI / Pages / release）

**Files:**
- Create: `.changeset/config.json`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/workflows/release.yml`
- Modify: `package.json`（加 `@changesets/cli` 與 scripts）

**Interfaces:**
- Produces: PR 上跑測試與 build 的 CI；push main 部署 Pages；changeset version PR 流程。

- [ ] **Step 1: 加入 changesets 相依**

Run: `pnpm add -D @changesets/cli`
Expected: `package.json` devDependencies 出現 `@changesets/cli`。

- [ ] **Step 2: 於 `package.json` scripts 加入**

```json
    "changeset": "changeset",
    "version": "changeset version",
    "release": "changeset publish"
```

> 本專案為 GitHub Pages 靜態站、非發 npm 套件，`release` 僅作版本標記／CHANGELOG，不實際 publish。

- [ ] **Step 3: 建立 `.changeset/config.json`**

```json
{
  "$schema": "https://unpkg.com/@changesets/config/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

- [ ] **Step 4: 建立 `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 5: 建立 `.github/workflows/deploy.yml`**

```yaml
name: Deploy Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 6: 建立 `.github/workflows/release.yml`**

```yaml
name: Release
on:
  push:
    branches: [main]
permissions:
  contents: write
  pull-requests: write
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - uses: changesets/action@v1
        with:
          version: pnpm version
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 7: 建立一個初始 changeset**

Run: `pnpm changeset`（互動：選 patch，描述「初始版本」）
或手動建立 `.changeset/initial.md`：

```md
---
"dc-loot-editor": minor
---

初始版本：表單化 DC 打王分寶 editor，支援總表／內購／剪刀計算與 markdown round-trip。
```

- [ ] **Step 8: 驗證 build 與 test 全通過**

Run: `pnpm test && pnpm build`
Expected: 全 PASS，`dist/` 產生。

- [ ] **Step 9: Commit**

```bash
git add .changeset .github package.json pnpm-lock.yaml
git commit -m "ci: changeset 版本管控與 GitHub Actions（CI／Pages 部署／release）"
```

- [ ] **Step 10: 部署前置（人工，非程式步驟）**

於 GitHub repo Settings → Pages → Source 選「GitHub Actions」；若改 repo 名，同步更新 `vite.config.ts` 的 `REPO` 常數。推上 GitHub `main` 後 Actions 會自動部署。

---

## Self-Review 檢查結果

- **Spec coverage**：多筆管理（T5/T8）、必填 title（T9 header）、貼上匯入（T4/T11）、表單化＋自動計算（T2/T9/T10）、剪刀成本（T2/T3/T4/T9）、內購多買家（T2/T10）、狀態切換 :ok:/:shopping_cart:/劃線（T9）、結清狀態（T9/T3）、autocomplete 品名/handle/單價帶日期/王名（T6/T7/T9/T10）、標準格式產生與解析（T3/T4）、Vue3+Vite+Pinia+localStorage（T1/T5）、pnpm+changeset+Pages CI（T1/T12）。皆有對應任務。
- **Placeholder scan**：無 TBD/TODO；佔位僅 T8 的 RecordEditor stub，於 T9 完整實作，屬刻意分階段。
- **Type consistency**：`LootRecord`/`LootItem`/`Purchase`/`Member`/`Income` 名稱與方法簽章（`itemNet`/`netTotal`/`computeIncomes`/`purchaseValue`/`useRecordsStore`/`useHistory`/`priceSuggestions`）跨任務一致。
