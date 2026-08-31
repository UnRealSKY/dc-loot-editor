import type { LootRecord } from '../types'
import { MIGRATION_KEY as VERSION_KEY } from '../storageKeys'

const CURRENT_VERSION = 2

// v1（2026-08-02）：品名標準化——潛能__%、手攻__%、大師附加、附加奇幻
const RENAME_V1: Record<string, string> = {
  附加大師: '大師附加',
  奇幻附加: '附加奇幻',
  '潛在70%': '潛能70%',
  '潛在90%': '潛能90%',
  '手套攻擊10%': '手攻10%',
  '手套攻擊60%': '手攻60%',
}

// v2（2026-08-03）：製作法家族統一全名（百列→百烈）；珍珠手杖統一
const RENAME_V2: Record<string, string> = {
  閃亮綠弓製作法: '閃亮的綠色弓箭手標記製作法',
  閃綠色魔法製作法: '閃亮的綠色魔法標記製作法',
  閃綠色百烈製作法: '閃亮的綠色百烈戰鬥標記製作法',
  閃亮的綠色百列戰鬥標記製作法: '閃亮的綠色百烈戰鬥標記製作法',
  閃流氓綠色製作法: '閃亮的綠色流氓標記製作法',
}
const PEARL = { from: '珍珠手杖(+4AD)', to: '龍之珍珠手杖', note: '(+4AD)' }

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

// 總表的珍珠手杖改名並把屬性後綴移到註解（已有註解則保留）
function migratePearl(records: LootRecord[]): LootRecord[] {
  return records.map((r) => ({
    ...r,
    lootItems: r.lootItems.map((it) =>
      it.name === PEARL.from ? { ...it, name: PEARL.to, note: it.note ?? PEARL.note } : it,
    ),
  }))
}

// 一次性資料遷移：跑過即記版本，之後載入不再執行
export function runMigrations(records: LootRecord[]): {
  records: LootRecord[]
  changed: boolean
} {
  const done = Number(localStorage.getItem(VERSION_KEY) ?? '0')
  if (done >= CURRENT_VERSION) return { records, changed: false }
  let migrated = records
  if (done < 1) migrated = renameItemNames(migrated, RENAME_V1)
  if (done < 2) {
    migrated = renameItemNames(migratePearl(migrated), { ...RENAME_V2, [PEARL.from]: PEARL.to })
  }
  localStorage.setItem(VERSION_KEY, String(CURRENT_VERSION))
  return { records: migrated, changed: true }
}
