import { describe, it, expect } from 'vitest'
import { buildAliasMap, nameOf, migrateEntry, migrateEntries } from '#src/store/roster'

describe('nameOf', () => {
  it('自訂別名優先於 Discord 顯示名', () => {
    expect(nameOf({ discordHandle: '@a', discordNickName: '天天(UnRealSKY)', alias: '天天' })).toBe('天天')
  })
  it('沒有自訂別名時用 Discord 顯示名', () => {
    expect(nameOf({ discordHandle: '@a', discordNickName: '天天(UnRealSKY)' })).toBe('天天(UnRealSKY)')
  })
  it('兩者都沒有時退回 handle', () => {
    expect(nameOf({ discordHandle: '@a', discordNickName: '' })).toBe('@a')
  })
})

describe('buildAliasMap', () => {
  it('建立 handle→顯示名映射，自訂別名優先', () => {
    const m = buildAliasMap([
      { discordHandle: '@.unrealsky', discordNickName: '天天(UnRealSKY)', alias: '天天' },
      { discordHandle: '@trm.andy', discordNickName: '妍' },
    ])
    expect(m.get('@.unrealsky')).toBe('天天')
    expect(m.get('@trm.andy')).toBe('妍')
  })
  it('略過缺 handle 或完全沒有名字的項目', () => {
    const m = buildAliasMap([
      { discordHandle: '', discordNickName: 'x' },
      { discordHandle: '@a', discordNickName: '' },
      { discordHandle: '@b', discordNickName: '乙' },
    ])
    expect(m.has('')).toBe(false)
    expect(m.has('@a')).toBe(false) // 沒有任何可讀名字 → displayName 會退回顯示 handle
    expect(m.get('@b')).toBe('乙')
  })
})

describe('migrateEntry', () => {
  it('舊格式的 alias 歸入 discordNickName，alias 不保留', () => {
    expect(migrateEntry({ handle: '@a', alias: '天天', id: '123' })).toEqual({
      discordHandle: '@a',
      discordNickName: '天天',
      discordId: '123',
    })
  })

  it('舊格式沒有 id 時不產生 discordId 欄位', () => {
    expect(migrateEntry({ handle: '@a', alias: '天天' })).toEqual({
      discordHandle: '@a',
      discordNickName: '天天',
    })
  })

  it('新格式原樣通過，保留 alias', () => {
    const e = { discordHandle: '@a', discordNickName: '天天(UnRealSKY)', discordId: '1', alias: '天天' }
    expect(migrateEntry(e)).toEqual(e)
  })

  it('新格式缺 discordNickName 時補空字串', () => {
    expect(migrateEntry({ discordHandle: '@a' })).toEqual({ discordHandle: '@a', discordNickName: '' })
  })

  it('無法辨識的資料回 null', () => {
    expect(migrateEntry(null)).toBeNull()
    expect(migrateEntry('x')).toBeNull()
    expect(migrateEntry({})).toBeNull()
    expect(migrateEntry({ handle: '' })).toBeNull()
  })
})

describe('migrateEntries', () => {
  it('過濾掉壞資料，混合新舊格式都吃得下', () => {
    expect(migrateEntries([
      { handle: '@old', alias: '舊', id: '1' },
      null,
      { discordHandle: '@new', discordNickName: '新', alias: '自訂' },
      {},
    ])).toEqual([
      { discordHandle: '@old', discordNickName: '舊', discordId: '1' },
      { discordHandle: '@new', discordNickName: '新', alias: '自訂' },
    ])
  })

  it('非陣列回空', () => {
    expect(migrateEntries(null)).toEqual([])
    expect(migrateEntries({})).toEqual([])
  })
})
