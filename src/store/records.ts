import { defineStore } from 'pinia'
import { ref, toRaw, watch } from 'vue'
import type { LootRecord } from '../types'
import { runMigrations } from './migrations'
import { deleteBlob } from '../db/imageBlobs'
import { activeGroup } from './groups'
import { RECORDS_KEY } from '../storageKeys'

// 匯出／測試會用到，維持原本的名字
export { RECORDS_KEY as STORAGE_KEY }

// 遊戲交易手續費，新紀錄的預設值
export const DEFAULT_SERVICE_FEE_PERCENT = 3

function load(): LootRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as LootRecord[]) : []
  } catch {
    return []
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function todayLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const useRecordsStore = defineStore('records', () => {
  // 一次性遷移：有變更立即寫回，避免「僅載入未編輯」時流失遷移結果
  const migrated = runMigrations(load())
  if (migrated.changed) localStorage.setItem(RECORDS_KEY, JSON.stringify(migrated.records))
  const records = ref<LootRecord[]>(migrated.records)

  // flush: 'sync' 為刻意設計：確保紀錄異動立即寫入 localStorage，
  // 資料量小，不需為了效能批次延遲持久化。
  watch(
    records,
    (val) => localStorage.setItem(RECORDS_KEY, JSON.stringify(val)),
    { deep: true, flush: 'sync' },
  )

  // 跨分頁同步：其他分頁（如未領總覽開的編輯分頁）寫入時，本分頁狀態跟著更新
  window.addEventListener('storage', (e) => {
    if (e.key !== RECORDS_KEY || e.newValue == null) return
    try {
      const parsed = JSON.parse(e.newValue)
      if (Array.isArray(parsed)) records.value = parsed
    } catch {
      // 略過壞資料
    }
  })

  function get(id: string): LootRecord | undefined {
    return records.value.find((r) => r.id === id)
  }

  function create(partial: Partial<LootRecord> = {}): LootRecord {
    const ts = nowIso()
    const rec: LootRecord = {
      date: '',
      boss: '',
      members: [],
      lootItems: [],
      purchases: [],
      ...partial,
      id: crypto.randomUUID(),
      createdAt: ts,
      updatedAt: ts,
    }
    if (!rec.date) rec.date = todayLocal()
    // 新紀錄預設落在設定頁選中的群組
    if (!rec.groupId) rec.groupId = activeGroup()?.id
    // 手續費固定存在，新紀錄帶預設值；舊紀錄沒有這欄就是 0，金額不受影響
    if (rec.serviceFeePercent == null) rec.serviceFeePercent = DEFAULT_SERVICE_FEE_PERCENT
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
    const target = get(id)
    records.value = records.value.filter((r) => r.id !== id)
    // 清掉尚未上傳的圖片 blob（已上傳的本地檔早已刪除）
    for (const img of target?.images ?? []) {
      if (!img.url) deleteBlob(img.id).catch(() => {})
    }
  }

  function duplicate(id: string): LootRecord | undefined {
    const src = get(id)
    if (!src) return undefined
    // dc 綁定與圖片不複製：複本是新場次，沿用會誤同步到原貼文／共用 blob
    return create({
      ...structuredClone(toRaw(src)),
      boss: `${src.boss} (複製)`,
      dc: undefined,
      images: undefined,
    })
  }

  return { records, get, create, upsert, remove, duplicate }
})
