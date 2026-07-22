import { describe, it, expect } from 'vitest'
import { parse } from '#src/format/parse'
import { serialize } from '#src/format/serialize'
import type { LootRecord } from '#src/types'

const sample = [
  '## 2026-07-19 混龍 / 5',
  '* :ok: 附加大師x6: 475x6',
  '* ~~:shopping_cart: 上衣命60%x1: (價格太低不計入)~~',
  '* :ok: 手攻60%x2: 288x2 - 80(剪刀)x2',
  '',
  '## 內購區',
  '@.unrealsky: 龍鍊x2 = 500x2',
  '',
  '## 分配',
  '總共: 3266 / 5 = 653',
  '* :ok: @.unrealsky: 653 - 1000 = -347',
  '* :orange_square: @xiangjiaojiu: 653 + 1000/4 = 903',
].join('\n')

describe('parse header', () => {
  const r = parse(sample)
  it('date/boss', () => {
    expect(r.date).toBe('2026-07-19')
    expect(r.boss).toBe('混龍')
  })
})

describe('parse loot items', () => {
  const r = parse(sample)
  it('一般項目', () => {
    expect(r.lootItems[0]).toMatchObject({ status: 'ok', name: '附加大師', qty: 6, unitPrice: 475 })
  })
  it('劃線項目 + 註解', () => {
    expect(r.lootItems[1]).toMatchObject({ status: 'struck', name: '上衣命60%', qty: 1, note: '(價格太低不計入)' })
  })
  it('剪刀項目', () => {
    expect(r.lootItems[2]).toMatchObject({
      status: 'ok', name: '手攻60%', qty: 2, unitPrice: 288, scissorUnitPrice: 80, scissorCount: 2,
    })
  })
})

describe('parse purchases', () => {
  const r = parse(sample)
  it('內購一筆', () => {
    expect(r.purchases[0]).toMatchObject({ buyer: '@.unrealsky', name: '龍鍊', qty: 2, unitPrice: 500 })
  })
})

describe('parse members（來自分配區）', () => {
  const r = parse(sample)
  it('handle 與結清狀態', () => {
    expect(r.members).toEqual([
      { handle: '@.unrealsky', settle: 'settled' },
      { handle: '@xiangjiaojiu', settle: 'pending' },
    ])
  })
})

describe('round-trip', () => {
  it('parse → serialize 產生等價標準格式的核心欄位', () => {
    const r: LootRecord = { ...parse(sample), id: '1', createdAt: '', updatedAt: '' }
    const out = serialize(r)
    expect(out).toContain('* :ok: 附加大師x6: 475x6')
    expect(out).toContain('* ~~:shopping_cart: 上衣命60%x1: (價格太低不計入)~~')
    expect(out).toContain('* :ok: 手攻60%x2: 288x2 - 80(剪刀)x2')
    expect(out).toContain('@.unrealsky: 龍鍊x2 = 500x2')
  })
})

describe('parse 直播檔', () => {
  const md = [
    '## 2026-07-19 混炎 / 1',
    '* :ok: 道具x1: 100x1',
    '',
    '## 直播檔',
    '* 第一場混炎: https://www.twitch.tv/x/clip/abc',
    '* 第二場混炎: https://www.twitch.tv/x/clip/def',
  ].join('\n')
  it('擷取直播檔 label 與 url', () => {
    const r = parse(md)
    expect(r.streams).toEqual([
      { label: '第一場混炎', url: 'https://www.twitch.tv/x/clip/abc' },
      { label: '第二場混炎', url: 'https://www.twitch.tv/x/clip/def' },
    ])
  })
})

describe('parse 代售', () => {
  const md = [
    '## 2026-07-19 測王 / 2',
    '* :ok: 道具x1: 1000x1',
    '',
    '## 代售',
    '@a: 物品x1 = 300x1',
    '@b: 別的x2 = 50x2',
  ].join('\n')
  it('擷取代售 seller/name/qty/unitPrice', () => {
    const r = parse(md)
    expect(r.consignments).toEqual([
      { seller: '@a', name: '物品', qty: 1, unitPrice: 300 },
      { seller: '@b', name: '別的', qty: 2, unitPrice: 50 },
    ])
  })
  it('解析代售剪刀', () => {
    const md2 = ['## 2026-07-19 測王 / 1', '## 代售', '@a: 物品x1 = 300x1 - 80(剪刀)x2'].join('\n')
    const r = parse(md2)
    expect(r.consignments![0]).toMatchObject({
      seller: '@a', name: '物品', qty: 1, unitPrice: 300, scissorUnitPrice: 80, scissorCount: 2,
    })
  })
})

describe('parse 相容 unicode emoji 與 <@id> mention', () => {
  const md = [
    '## 2026-07-19 混炎 / 2',
    '* 🆗 大師附加x2: 500x2',
    '* 🛒 待售品x1: 10x1',
    '',
    '## 分配',
    '總共: 1010 / 2 = 505',
    '* 🆗 <@446671606073393152> 505',
    '* 🟧 @别搞我啦 505',
  ].join('\n')
  const r = parse(md)
  it('emoji 狀態對應 ok / cart', () => {
    expect(r.lootItems[0]).toMatchObject({ status: 'ok', name: '大師附加', qty: 2, unitPrice: 500 })
    expect(r.lootItems[1]).toMatchObject({ status: 'cart', name: '待售品', qty: 1, unitPrice: 10 })
  })
  it('emoji 結清狀態與 <@id> / @名稱 handle', () => {
    expect(r.members).toEqual([
      { handle: '<@446671606073393152>', settle: 'settled' },
      { handle: '@别搞我啦', settle: 'pending' },
    ])
  })
})

describe('畸形行韌性', () => {
  it('混合畸形行與有效行不拋出異常，有效記錄正確提取', () => {
    const malformedInput = [
      '## 2026-07-20 測試副本 / 3',
      '這是一段亂寫的文字沒有格式',
      '* :ok: 附加大師x6: 475x6',
      '* :ok: 壞掉的行',
      '隨便一行不符合格式',
      '* :ok: 手攻60%x2: 288x2',
      '',
      '## 內購區',
      'abc不符合購買格式',
      '@.user1: 龍鍊x2 = 500x2',
      '又是垃圾行',
      '@.user2:這樣也不對',
      '',
      '## 分配',
      '* :ok: @.user1: 1000',
      '* :ok: @.user3: 800',
    ].join('\n')

    // 不拋出異常
    expect(() => parse(malformedInput)).not.toThrow()

    const result = parse(malformedInput)

    // 有效的頭部欄位被正確提取
    expect(result.date).toBe('2026-07-20')
    expect(result.boss).toBe('測試副本')

    // 有效的掠奪行被提取（2 行有效）
    expect(result.lootItems).toHaveLength(2)
    expect(result.lootItems[0]).toMatchObject({ status: 'ok', name: '附加大師', qty: 6, unitPrice: 475 })
    expect(result.lootItems[1]).toMatchObject({ status: 'ok', name: '手攻60%', qty: 2, unitPrice: 288 })

    // 有效的購買行被提取（1 行有效）
    expect(result.purchases).toHaveLength(1)
    expect(result.purchases[0]).toMatchObject({ buyer: '@.user1', name: '龍鍊', qty: 2, unitPrice: 500 })

    // 有效的分配行被提取（2 行有效）
    expect(result.members).toHaveLength(2)
    expect(result.members[0]).toMatchObject({ handle: '@.user1', settle: 'settled' })
    expect(result.members[1]).toMatchObject({ handle: '@.user3', settle: 'settled' })
  })
})
