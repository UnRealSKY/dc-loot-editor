import { describe, it, expect, beforeEach } from 'vitest'
import { renameItemNames, runMigrations } from '#src/store/migrations'
import type { LootRecord } from '#src/types'

function makeRecord(over: Partial<LootRecord>): LootRecord {
  return {
    id: 'r1', date: '2026-08-02', boss: '測王',
    members: [], lootItems: [], purchases: [],
    createdAt: '', updatedAt: '',
    ...over,
  }
}

const RENAME = { '潛在70%': '潛能70%', 附加大師: '大師附加' }

describe('renameItemNames', () => {
  it('總表、內購、代售的品名都會改名，其他品名不動', () => {
    const r = makeRecord({
      lootItems: [
        { status: 'ok', name: '潛在70%', qty: 1, unitPrice: 400 },
        { status: 'ok', name: '銀烙印', qty: 1, unitPrice: 200 },
      ],
      purchases: [{ buyer: '@a', name: '附加大師', qty: 1, unitPrice: 500 }],
      consignments: [{ seller: '@a', name: '潛在70%', qty: 1, unitPrice: 400 }],
    })
    const [out] = renameItemNames([r], RENAME)
    expect(out.lootItems.map((it) => it.name)).toEqual(['潛能70%', '銀烙印'])
    expect(out.purchases[0].name).toBe('大師附加')
    expect(out.consignments?.[0].name).toBe('潛能70%')
  })
  it('無 consignments 欄位的紀錄不會被補上', () => {
    const [out] = renameItemNames([makeRecord({})], RENAME)
    expect('consignments' in out).toBe(false)
  })
})

describe('runMigrations', () => {
  beforeEach(() => localStorage.clear())

  it('首次執行套用改名並標記完成', () => {
    const r = makeRecord({
      lootItems: [{ status: 'ok', name: '潛在70%', qty: 1, unitPrice: 400 }],
    })
    const first = runMigrations([r])
    expect(first.changed).toBe(true)
    expect(first.records[0].lootItems[0].name).toBe('潛能70%')
  })

  it('v2：製作法家族統一全名（含百列→百烈）', () => {
    const r = makeRecord({
      lootItems: [
        { status: 'ok', name: '閃綠色百烈製作法', qty: 1, unitPrice: 5 },
        { status: 'ok', name: '閃亮的綠色百列戰鬥標記製作法', qty: 1, unitPrice: 5 },
        { status: 'ok', name: '閃亮綠弓製作法', qty: 1, unitPrice: 5 },
        { status: 'ok', name: '閃流氓綠色製作法', qty: 1, unitPrice: 5 },
      ],
    })
    const { records } = runMigrations([r])
    expect(records[0].lootItems.map((it) => it.name)).toEqual([
      '閃亮的綠色百烈戰鬥標記製作法',
      '閃亮的綠色百烈戰鬥標記製作法',
      '閃亮的綠色弓箭手標記製作法',
      '閃亮的綠色流氓標記製作法',
    ])
  })

  it('v2：珍珠手杖統一並把屬性後綴移到註解（已有註解則保留）', () => {
    const r = makeRecord({
      lootItems: [
        { status: 'cart', name: '珍珠手杖(+4AD)', qty: 1, unitPrice: 80 },
        { status: 'cart', name: '珍珠手杖(+4AD)', qty: 1, unitPrice: 80, note: '自訂' },
      ],
    })
    const { records } = runMigrations([r])
    expect(records[0].lootItems[0]).toMatchObject({ name: '龍之珍珠手杖', note: '(+4AD)' })
    expect(records[0].lootItems[1]).toMatchObject({ name: '龍之珍珠手杖', note: '自訂' })
  })

  it('已執行過則不再改動', () => {
    runMigrations([])
    const again = runMigrations([
      makeRecord({ lootItems: [{ status: 'ok', name: '潛在70%', qty: 1, unitPrice: 400 }] }),
    ])
    expect(again.changed).toBe(false)
    expect(again.records[0].lootItems[0].name).toBe('潛在70%')
  })
})
