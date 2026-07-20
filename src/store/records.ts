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
    { deep: true, flush: 'sync' },
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
