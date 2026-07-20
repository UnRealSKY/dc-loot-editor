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
  it('品名依頻率排序且嚴格去重', () => {
    const store = useRecordsStore()
    // 高頻品出現 3 次，低頻品出現 1 次
    store.create({
      title: 'r-freq', date: '2026-07-19', boss: '高頻龍',
      members: [{ handle: '@freq', settle: 'settled' }],
      lootItems: [
        { status: 'ok', name: '高頻品', qty: 1, unitPrice: 1000 },
        { status: 'ok', name: '高頻品', qty: 1, unitPrice: 1100 },
      ],
      purchases: [],
    })
    store.create({
      title: 'r-freq2', date: '2026-07-20', boss: '高頻龍2',
      members: [{ handle: '@freq2', settle: 'settled' }],
      lootItems: [
        { status: 'ok', name: '高頻品', qty: 1, unitPrice: 1200 },
      ],
      purchases: [],
    })
    store.create({
      title: 'r-low', date: '2026-07-20', boss: '低頻龍',
      members: [{ handle: '@low', settle: 'settled' }],
      lootItems: [
        { status: 'ok', name: '低頻品', qty: 1, unitPrice: 2000 },
      ],
      purchases: [],
    })
    const h = useHistory()
    const itemNames = h.itemNames.value
    // 驗證順序：高頻品應在低頻品之前
    expect(itemNames).toEqual(['高頻品', '低頻品'])
    // 驗證嚴格去重：高頻品只出現一次
    expect(itemNames.filter(n => n === '高頻品')).toHaveLength(1)
    expect(itemNames.filter(n => n === '低頻品')).toHaveLength(1)
  })
})
