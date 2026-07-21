import { describe, it, expect } from 'vitest'
import { serialize } from './serialize'
import type { LootRecord } from '../types'

const record: LootRecord = {
  id: '1', date: '2026-07-19', boss: '混龍',
  members: [
    { handle: '@.unrealsky', settle: 'settled' },
    { handle: '@xiangjiaojiu', settle: 'pending' },
    { handle: '@must0505110', settle: 'pending' },
    { handle: '@auwoo', settle: 'pending' },
    { handle: '@x', settle: 'pending' },
  ],
  lootItems: [
    { status: 'ok', name: '附加大師', qty: 6, unitPrice: 475 },
    { status: 'struck', name: '上衣命60%', qty: 1, unitPrice: null, note: '(價格太低不計入)' },
    { status: 'ok', name: '手攻60%', qty: 2, unitPrice: 288, scissorUnitPrice: 80, scissorCount: 2 },
  ],
  purchases: [{ buyer: '@.unrealsky', name: '龍鍊', qty: 2, unitPrice: 500 }],
  createdAt: '', updatedAt: '',
}

describe('serialize', () => {
  const out = serialize(record)

  it('header', () => {
    expect(out).toContain('## 2026-07-19 混龍 / 5')
  })
  it('一般項目', () => {
    expect(out).toContain('* :ok: 附加大師x6: 475x6')
  })
  it('劃線項目含註解', () => {
    expect(out).toContain('* ~~:shopping_cart: 上衣命60%x1: (價格太低不計入)~~')
  })
  it('剪刀項目', () => {
    expect(out).toContain('* :ok: 手攻60%x2: 288x2 - 80(剪刀)x2')
  })
  it('內購區', () => {
    expect(out).toContain('## 內購區')
    expect(out).toContain('@.unrealsky: 龍鍊x2 = 500x2')
  })
  it('分配總共行', () => {
    // netTotal = 2850 + 0 + (288*2-80*2=416) = 3266; base=round(3266/5)=653
    expect(out).toContain('## 分配')
    expect(out).toContain('總共: 3266 / 5 = 653')
  })
  it('買家分配行（減自己內購）', () => {
    // base_raw=653.2 → 顯示 653；income=653.2+0-1000=-346.8 → -347
    expect(out).toContain('* :ok: @.unrealsky: 653 - 1000 = -347')
  })
  it('其他人分配行（加他人內購/(N-1)）', () => {
    // income=653.2+1000/4=903.2 → 903
    expect(out).toContain('* :orange_square: @xiangjiaojiu: 653 + 1000/4 = 903')
  })
})

describe('serialize 直播檔與空區塊', () => {
  it('有直播檔則輸出 ## 直播檔 區塊', () => {
    const r: LootRecord = {
      id: '3', date: '2026-07-19', boss: '混炎',
      members: [{ handle: '@a', settle: 'settled' }],
      lootItems: [{ status: 'ok', name: '道具', qty: 1, unitPrice: 100 }],
      purchases: [],
      streams: [{ label: '第一場', url: 'https://x.tv/clip/abc' }],
      createdAt: '', updatedAt: '',
    }
    const out = serialize(r)
    expect(out).toContain('## 直播檔')
    expect(out).toContain('* 第一場: https://x.tv/clip/abc')
  })
  it('無內購時不輸出 ## 內購區', () => {
    const r: LootRecord = {
      id: '4', date: '2026-07-19', boss: '混炎',
      members: [{ handle: '@a', settle: 'settled' }],
      lootItems: [{ status: 'ok', name: '道具', qty: 1, unitPrice: 100 }],
      purchases: [],
      createdAt: '', updatedAt: '',
    }
    expect(serialize(r)).not.toContain('## 內購區')
  })
})

describe('serialize N=1', () => {
  const soloRecord: LootRecord = {
    id: '2', date: '2026-07-20', boss: '單人王',
    members: [{ handle: '@me', settle: 'pending' }],
    lootItems: [{ status: 'ok', name: '道具', qty: 1, unitPrice: 1000 }],
    purchases: [{ buyer: '@other', name: '內購物品', qty: 1, unitPrice: 500 }],
    createdAt: '', updatedAt: '',
  }
  const out = serialize(soloRecord)

  it('不應出現 /0（others 除以 N-1 應被 N=1 守衛跳過）', () => {
    expect(out).not.toContain('/0')
  })
  it('成員分配行以正確的 = 數值結尾', () => {
    // n=1: base=1000/1=1000; others=500-0=500 但因 n=1 被跳過; own=0 亦不列入 → income=1000
    expect(out).toContain('* :orange_square: @me: 1000 = 1000')
  })
})
