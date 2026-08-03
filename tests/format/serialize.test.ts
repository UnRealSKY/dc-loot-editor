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

  it('header 含狀態尾綴（歸零的標記不顯示）', () => {
    // lootItems 無 cart → 不顯示；4 人 pending → :dollar:(4)
    expect(out).toContain('## 2026-07-19 混龍 ｜ :dollar:(4)')
  })
  it('一般項目', () => {
    expect(out).toContain('* :ok: 附加大師x6: 475x6')
  })
  it('劃線項目含註解', () => {
    expect(out).toContain('* ~~:heavy_multiplication_x: 上衣命60%x1: (價格太低不計入)~~')
  })
  it('剪刀項目', () => {
    expect(out).toContain('* :ok: 手攻60%x2: 288x2 - 80(剪刀)x2')
  })
  it('非劃線項目的備註輸出為下一行縮排', () => {
    const r: LootRecord = {
      id: 'n1', date: '2026-08-03', boss: '測王',
      members: [{ handle: '@a', settle: 'pending' }],
      lootItems: [
        { status: 'ok', name: '大師附加', qty: 1, unitPrice: 461, note: '含手續費' },
        { status: 'cart', name: '潛能90%', qty: 1, unitPrice: null },
      ],
      purchases: [],
      createdAt: '', updatedAt: '',
    }
    const s = serialize(r)
    expect(s).toContain('* :ok: 大師附加x1: 461x1\n  含手續費\n* :shopping_cart: 潛能90%x1: ?x1')
  })
  it('未填金額輸出 ?（不是 0）', () => {
    const r: LootRecord = {
      id: 'q1', date: '2026-08-03', boss: '測王',
      members: [{ handle: '@a', settle: 'pending' }],
      lootItems: [
        { status: 'cart', name: '未定價', qty: 2, unitPrice: null },
        { status: 'cart', name: '剪未定', qty: 1, unitPrice: 300, scissorCount: 2 },
      ],
      purchases: [],
      consignments: [{ seller: '@a', name: '代售品', qty: 1, unitPrice: 300, scissorCount: 1 }],
      createdAt: '', updatedAt: '',
    }
    const s = serialize(r)
    expect(s).toContain('* :shopping_cart: 未定價x2: ?x2')
    expect(s).toContain('* :shopping_cart: 剪未定x1: 300x1 - ?(剪刀)x2')
    expect(s).toContain('@a: 代售品x1 = 300x1 - ?(剪刀)x1')
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

describe('serialize 均攤內購', () => {
  it('均攤內購行帶 (均攤) 尾綴，全額不帶', () => {
    const r: LootRecord = {
      id: 'p1', date: '2026-08-03', boss: '測王',
      members: [{ handle: '@a', settle: 'pending' }, { handle: '@b', settle: 'pending' }],
      lootItems: [],
      purchases: [
        { buyer: '@a', name: '混龍鍊', qty: 1, unitPrice: 500, mode: 'split' },
        { buyer: '@b', name: '龍蛋', qty: 1, unitPrice: 500 },
      ],
      createdAt: '', updatedAt: '',
    }
    const s = serialize(r)
    expect(s).toContain('@a: 混龍鍊x1 = 500x1 (均攤)')
    expect(s).toContain('@b: 龍蛋x1 = 500x1')
    expect(s).not.toContain('龍蛋x1 = 500x1 (均攤)')
  })
})

describe('serialize 標題行狀態尾綴', () => {
  it('有待售項目顯示 :shopping_cart:(項數)', () => {
    const r: LootRecord = {
      id: 's1', date: '2026-08-03', boss: '測王',
      members: [{ handle: '@a', settle: 'pending' }],
      lootItems: [
        { status: 'cart', name: 'x', qty: 2, unitPrice: 100 },
        { status: 'cart', name: 'y', qty: 1, unitPrice: null },
        { status: 'ok', name: 'z', qty: 1, unitPrice: 50 },
      ],
      purchases: [],
      createdAt: '', updatedAt: '',
    }
    expect(serialize(r)).toContain('## 2026-08-03 測王 ｜ :shopping_cart:(2) :dollar:(1)')
  })
  it('全售全結清＝全結案，顯示單一 :ballot_box_with_check:', () => {
    const r: LootRecord = {
      id: 's2', date: '2026-08-03', boss: '測王',
      members: [{ handle: '@a', settle: 'settled' }],
      lootItems: [{ status: 'ok', name: 'x', qty: 1, unitPrice: 100 }],
      purchases: [],
      createdAt: '', updatedAt: '',
    }
    expect(serialize(r)).toContain('## 2026-08-03 測王 ｜ :ballot_box_with_check:')
    expect(serialize(r)).not.toContain(':ballot_box_with_check: :ballot_box_with_check:')
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
