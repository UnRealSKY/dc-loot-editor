import { describe, it, expect } from 'vitest'
import { pendingBlocks } from '#src/format/pending'
import type { LootRecord } from '#src/types'

const ALIASES: Record<string, string> = {
  '@awai0774': '阿歪',
  '@kyle5278001': '蘇察哈爾燦',
  '@xiangjiaojiu': '咕嘎幻影',
  '@.unrealsky': '天天(UnRealSKY)',
}
const display = (h: string) => ALIASES[h] ?? h

function makeRecord(over: Partial<LootRecord>): LootRecord {
  return {
    id: 'r', date: '2026-08-02', boss: '測王',
    members: [], lootItems: [], purchases: [],
    createdAt: '', updatedAt: '',
    ...over,
  }
}

// 對照使用者範例：第一場 4566/6=761、他人內購 1000/5；第二場 1259/5=252、他人內購 200/4
const r1 = makeRecord({
  id: 'r1', boss: '混龍第一場',
  members: [
    { handle: '@awai0774', settle: 'pending' },
    { handle: '@kyle5278001', settle: 'settled' },
    { handle: '@xiangjiaojiu', settle: 'settled' },
    { handle: '@.unrealsky', settle: 'settled' },
    { handle: '@e', settle: 'settled' },
    { handle: '@f', settle: 'settled' },
  ],
  lootItems: [{ status: 'ok', name: 'x', qty: 1, unitPrice: 4566 }],
  purchases: [
    { buyer: '@kyle5278001', name: '混龍鍊', qty: 1, unitPrice: 500 },
    { buyer: '@xiangjiaojiu', name: '混龍鍊', qty: 1, unitPrice: 500 },
  ],
})
const r2 = makeRecord({
  id: 'r2', boss: '混龍第二場',
  members: [
    { handle: '@awai0774', settle: 'pending' },
    { handle: '@.unrealsky', settle: 'settled' },
    { handle: '@c', settle: 'settled' },
    { handle: '@d', settle: 'settled' },
    { handle: '@e', settle: 'settled' },
  ],
  lootItems: [
    { status: 'ok', name: 'x', qty: 1, unitPrice: 1259 },
    { status: 'cart', name: '待售品', qty: 1, unitPrice: null },
  ],
  purchases: [{ buyer: '@.unrealsky', name: '白衣5%', qty: 1, unitPrice: 200 }],
})

describe('pendingBlocks', () => {
  const blocks = pendingBlocks([r2, r1], display) // 故意反序，驗證排序

  it('僅未結清團員成塊，已結清者不出現', () => {
    expect(blocks.map((b) => b.handle)).toEqual(['@awai0774'])
  })

  it('逐行內容符合範例格式（標題、他人內購、總共、公式）', () => {
    const [b] = blocks
    expect(b.display).toBe('阿歪')
    expect(b.records[0].lines).toEqual([
      '2026-08-02 混龍第一場 / 6',
      '蘇察哈爾燦: 內購 混龍鍊x1 = 500x1',
      '咕嘎幻影: 內購 混龍鍊x1 = 500x1',
      '總共: 4566 / 6 = 761',
      '阿歪: 761 + 1000/5 = 961',
    ])
    expect(b.records[1].lines).toEqual([
      '2026-08-02 混龍第二場 / 5',
      '天天(UnRealSKY): 內購 白衣5%x1 = 200x1',
      '總共: 1259 / 5 = 252',
      '阿歪: 252 + 200/4 = 302',
    ])
  })

  it('同日期依團名排序（第一場在前）且應領加總', () => {
    const [b] = blocks
    expect(b.totalLine).toBe('應領: 961 + 302 = 1263')
    expect(b.total).toBe(1263)
  })

  it('hasCart 標記待售中的紀錄', () => {
    const [b] = blocks
    expect(b.records[0].hasCart).toBe(false)
    expect(b.records[1].hasCart).toBe(true)
  })

  it('單場時應領行不含加式', () => {
    const [b] = pendingBlocks([r1], display)
    expect(b.totalLine).toBe('應領: 961')
  })

  it('本人的內購不列行、只入公式減項', () => {
    const r = makeRecord({
      id: 'r3', boss: '測',
      members: [
        { handle: '@awai0774', settle: 'pending' },
        { handle: '@e', settle: 'settled' },
      ],
      lootItems: [{ status: 'ok', name: 'x', qty: 1, unitPrice: 1000 }],
      purchases: [{ buyer: '@awai0774', name: 'y', qty: 1, unitPrice: 300 }],
    })
    const [b] = pendingBlocks([r], display)
    expect(b.records[0].lines).toEqual([
      '2026-08-02 測 / 2',
      '總共: 1000 / 2 = 500',
      '阿歪: 500 - 300 = 200',
    ])
  })

  it('擱置中的紀錄不列入', () => {
    const shelved = { ...r1, id: 'r5', shelved: true }
    expect(pendingBlocks([shelved], display)).toEqual([])
    // 取消擱置後恢復列入
    expect(pendingBlocks([{ ...shelved, shelved: false }], display)).toHaveLength(1)
  })

  it('不同日期依日期舊到新排序', () => {
    const old = makeRecord({
      id: 'r4', date: '2026-07-19', boss: '舊場',
      members: [{ handle: '@awai0774', settle: 'pending' }, { handle: '@e', settle: 'settled' }],
      lootItems: [{ status: 'ok', name: 'x', qty: 1, unitPrice: 100 }],
    })
    const [b] = pendingBlocks([r1, old], display)
    expect(b.records.map((x) => x.recordId)).toEqual(['r4', 'r1'])
  })
})
