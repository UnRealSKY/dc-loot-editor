import { describe, it, expect } from 'vitest'
import { serialize } from '#src/format/serialize'
import type { LootRecord } from '#src/types'

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
    // netTotal = 2850 + 0 + (288*2-80*2=416) = 3266; base=ceil(3266/5=653.2)=654
    expect(out).toContain('## 分配')
    expect(out).toContain('總共: 3266 / 5 = 654')
  })
  it('買家分配行（減自己內購）', () => {
    // base 顯示 654；income=653.2+0-1000=-346.8 → ceil=-346
    expect(out).toContain('* :ok: @.unrealsky: 654 - 1000 = -346')
  })
  it('其他人分配行（加他人內購/(N-1)）', () => {
    // income=653.2+1000/4=903.2 → ceil=904
    expect(out).toContain('* :orange_square: @xiangjiaojiu: 654 + 1000/4 = 904')
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

describe('serialize 代售併入結算', () => {
  const r: LootRecord = {
    id: '5', date: '2026-07-19', boss: '測王',
    members: [{ handle: '@a', settle: 'settled' }, { handle: '@b', settle: 'settled' }],
    lootItems: [{ status: 'ok', name: '道具', qty: 1, unitPrice: 1000 }],
    purchases: [],
    consignments: [{ seller: '@a', name: '物品', qty: 1, unitPrice: 300 }],
    createdAt: '', updatedAt: '',
  }
  const out = serialize(r)
  it('輸出 ## 代售 區塊', () => {
    expect(out).toContain('## 代售')
    expect(out).toContain('@a: 物品x1 = 300x1')
  })
  it('分配行併入代售額（收入 − 代售 = 結算）', () => {
    // base=ceil(1000/2)=500；@a 持有 300 → 500 - 300 = 200；@b 無代售 → 500
    expect(out).toContain('* :ok: @a: 500 - 300 = 200')
    expect(out).toContain('* :ok: @b: 500 = 500')
  })
  it('代售剪刀後綴與淨持有額', () => {
    const r2: LootRecord = {
      ...r,
      consignments: [{ seller: '@a', name: '物品', qty: 1, unitPrice: 300, scissorUnitPrice: 80, scissorCount: 2 }],
    }
    const out2 = serialize(r2)
    // 代售行含剪刀；持有淨額 = 300 - 80*2 = 140 → 結算 500 - 140 = 360
    expect(out2).toContain('@a: 物品x1 = 300x1 - 80(剪刀)x2')
    expect(out2).toContain('* :ok: @a: 500 - 140 = 360')
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
