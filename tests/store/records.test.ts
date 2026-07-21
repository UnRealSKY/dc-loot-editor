import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRecordsStore, STORAGE_KEY } from '../../src/store/records'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('records store', () => {
  it('create 產生帶 id 的紀錄並存入', () => {
    const store = useRecordsStore()
    const r = store.create({ boss: '測試' })
    expect(r.id).toBeTruthy()
    expect(r.boss).toBe('測試')
    expect(store.records).toHaveLength(1)
  })

  it('持久化到 localStorage', () => {
    const store = useRecordsStore()
    store.create({ boss: 'A' })
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(saved).toHaveLength(1)
    expect(saved[0].boss).toBe('A')
  })

  it('upsert 更新既有紀錄', () => {
    const store = useRecordsStore()
    const r = store.create({ boss: 'A' })
    store.upsert({ ...r, boss: 'B' })
    expect(store.get(r.id)!.boss).toBe('B')
    expect(store.records).toHaveLength(1)
  })

  it('remove 刪除', () => {
    const store = useRecordsStore()
    const r = store.create({ boss: 'A' })
    store.remove(r.id)
    expect(store.records).toHaveLength(0)
  })

  it('duplicate 複製為新 id', () => {
    const store = useRecordsStore()
    const r = store.create({ boss: 'A' })
    const copy = store.duplicate(r.id)!
    expect(copy.id).toBeTruthy()
    expect(copy.id).not.toBe(r.id)
    expect(store.records).toHaveLength(2)
  })

  it('duplicate 深拷貝巢狀陣列，不共用參照', () => {
    const store = useRecordsStore()
    const r = store.create({ boss: 'A', lootItems: [{ id: '1', name: '物品' } as any] })
    const copy = store.duplicate(r.id)!
    copy.lootItems.push({ id: '2', name: '新物品' } as any)
    expect(store.get(r.id)!.lootItems).toHaveLength(1)
    expect(copy.lootItems).toHaveLength(2)
  })

  it('duplicate 產生全新的時間戳記', () => {
    const store = useRecordsStore()
    const r = store.create({ boss: 'A' })
    const copy = store.duplicate(r.id)!
    expect(copy.createdAt).toBeTruthy()
    expect(typeof copy.createdAt).toBe('string')
    expect(copy.updatedAt).toBeTruthy()
  })

  it('load 遇到非陣列 JSON 時容錯為空陣列', () => {
    localStorage.setItem(STORAGE_KEY, '{}')
    setActivePinia(createPinia())
    const store = useRecordsStore()
    expect(Array.isArray(store.records)).toBe(true)
    expect(store.records).toHaveLength(0)
  })

  it('重新載入時從 localStorage 還原', () => {
    const s1 = useRecordsStore()
    s1.create({ boss: 'persist' })
    setActivePinia(createPinia())
    const s2 = useRecordsStore()
    expect(s2.records).toHaveLength(1)
    expect(s2.records[0].boss).toBe('persist')
  })
})
