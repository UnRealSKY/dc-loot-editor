import { defineStore } from 'pinia'
import { ref, toRaw, watch } from 'vue'
import type { LootRecord } from '../types'

export const STORAGE_KEY = 'dc-loot-records'

function load(): LootRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
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

export const useRecordsStore = defineStore('records', () => {
  const records = ref<LootRecord[]>(load())

  // flush: 'sync' 為刻意設計：確保紀錄異動立即寫入 localStorage，
  // 資料量小，不需為了效能批次延遲持久化。
  watch(
    records,
    (val) => localStorage.setItem(STORAGE_KEY, JSON.stringify(val)),
    { deep: true, flush: 'sync' },
  )

  function get(id: string): LootRecord | undefined {
    return records.value.find((r) => r.id === id)
  }

  function create(partial: Partial<LootRecord> = {}): LootRecord {
    const ts = nowIso()
    const rec: LootRecord = {
      title: '',
      date: '',
      boss: '',
      memberCount: 0,
      members: [],
      lootItems: [],
      purchases: [],
      ...partial,
      id: crypto.randomUUID(),
      createdAt: ts,
      updatedAt: ts,
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
    return create({ ...structuredClone(toRaw(src)), title: `${src.title} (複製)` })
  }

  return { records, get, create, upsert, remove, duplicate }
})
