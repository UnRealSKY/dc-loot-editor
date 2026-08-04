import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})
afterEach(() => vi.unstubAllGlobals())

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('名冊來源模式', () => {
  it('預設模式抓官方 members.json 並回寫快取', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, [{ handle: '@a', alias: 'A' }]))
    vi.stubGlobal('fetch', fetchMock)
    const roster = await import('#src/store/roster')
    await roster.initRoster()
    const [calledUrl] = fetchMock.mock.calls[0] as unknown as [string]
    expect(calledUrl).toContain('members.json')
    expect(roster.rosterHandles()).toEqual(['@a'])
    expect(JSON.parse(localStorage.getItem('dc-loot-roster')!)).toHaveLength(1)
  })

  it('自訂 URL 模式抓指定網址', async () => {
    localStorage.setItem('dc-roster-source', JSON.stringify({ mode: 'url', url: 'https://x/m.json' }))
    const fetchMock = vi.fn(async () => jsonResponse(200, [{ handle: '@b', alias: 'B' }]))
    vi.stubGlobal('fetch', fetchMock)
    const roster = await import('#src/store/roster')
    await roster.initRoster()
    const [calledUrl] = fetchMock.mock.calls[0] as unknown as [string]
    expect(calledUrl).toBe('https://x/m.json')
    expect(roster.rosterHandles()).toEqual(['@b'])
  })

  it('本機自訂模式不抓網路、沿用本機資料', async () => {
    localStorage.setItem('dc-roster-source', JSON.stringify({ mode: 'local' }))
    localStorage.setItem('dc-loot-roster', JSON.stringify([{ handle: '@c', alias: 'C' }]))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const roster = await import('#src/store/roster')
    await roster.initRoster()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(roster.rosterHandles()).toEqual(['@c'])
  })

  it('fetchRoster 拒絕非陣列與缺欄位格式', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, { not: 'array' })))
    const roster = await import('#src/store/roster')
    await expect(roster.fetchRoster('https://x')).rejects.toThrow('JSON 陣列')
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, [{ nope: 1 }])))
    await expect(roster.fetchRoster('https://x')).rejects.toThrow('handle 與 alias')
  })

  it('setRosterSource 持久化，重載後生效', async () => {
    const roster = await import('#src/store/roster')
    roster.setRosterSource({ mode: 'url', url: 'https://x/m.json' })
    vi.resetModules()
    const again = await import('#src/store/roster')
    expect(again.rosterSource().value).toEqual({ mode: 'url', url: 'https://x/m.json' })
  })
})

describe('品名來源模式', () => {
  it('自訂 URL 模式抓指定網址並套用', async () => {
    localStorage.setItem('dc-items-source', JSON.stringify({ mode: 'url', url: 'https://x/i.json' }))
    const fetchMock = vi.fn(async () => jsonResponse(200, ['大師附加', '附加奇幻']))
    vi.stubGlobal('fetch', fetchMock)
    const items = await import('#src/store/sharedItems')
    await items.initSharedItems()
    const [calledUrl] = fetchMock.mock.calls[0] as unknown as [string]
    expect(calledUrl).toBe('https://x/i.json')
    expect(items.sharedItemNames()).toEqual(['大師附加', '附加奇幻'])
  })

  it('本機自訂模式不抓網路，saveItemsLocal 生效', async () => {
    localStorage.setItem('dc-items-source', JSON.stringify({ mode: 'local' }))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const items = await import('#src/store/sharedItems')
    await items.initSharedItems()
    expect(fetchMock).not.toHaveBeenCalled()
    items.saveItemsLocal(['楓祝30'])
    expect(items.sharedItemNames()).toEqual(['楓祝30'])
    expect(JSON.parse(localStorage.getItem('dc-loot-items')!)).toEqual(['楓祝30'])
  })

  it('fetchItems 拒絕非字串陣列', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, [1, 2])))
    const items = await import('#src/store/sharedItems')
    await expect(items.fetchItems('https://x')).rejects.toThrow('字串品名')
  })
})
