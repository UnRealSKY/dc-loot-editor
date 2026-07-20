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
