import type { LootRecord } from '../types'

const VERSION_KEY = 'dc-loot-migration'
const CURRENT_VERSION = 1

// v1（2026-08-02）：品名標準化——潛能__%、手攻__%、大師附加、附加奇幻
const RENAME_V1: Record<string, string> = {
  附加大師: '大師附加',
  奇幻附加: '附加奇幻',
  '潛在70%': '潛能70%',
  '潛在90%': '潛能90%',
  '手套攻擊10%': '手攻10%',
  '手套攻擊60%': '手攻60%',
}

export function renameItemNames(
  records: LootRecord[],
  rename: Record<string, string>,
): LootRecord[] {
  return records.map((r) => {
    const out: LootRecord = {
      ...r,
      lootItems: r.lootItems.map((it) => ({ ...it, name: rename[it.name] ?? it.name })),
      purchases: r.purchases.map((p) => ({ ...p, name: rename[p.name] ?? p.name })),
    }
    if (r.consignments) {
      out.consignments = r.consignments.map((c) => ({ ...c, name: rename[c.name] ?? c.name }))
    }
    return out
  })
}

// 一次性資料遷移：跑過即記版本，之後載入不再執行
export function runMigrations(records: LootRecord[]): {
  records: LootRecord[]
  changed: boolean
} {
  const done = Number(localStorage.getItem(VERSION_KEY) ?? '0')
  if (done >= CURRENT_VERSION) return { records, changed: false }
  const migrated = renameItemNames(records, RENAME_V1)
  localStorage.setItem(VERSION_KEY, String(CURRENT_VERSION))
  return { records: migrated, changed: true }
}
