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
