import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  migrateRenamedKeys, migrateRenamedBossIds,
  BOSS_KEY, SOUND_KEY, OVERRIDES_KEY, DISPEL_KEY, HP_LEAD_KEY,
  GROUPS_KEY, ACTIVE_GROUP_KEY, ITEMS_SOURCE_KEY,
} from '#src/storageKeys'

describe('舊 key 搬到新前綴', () => {
  beforeEach(() => localStorage.clear())

  it('BOSS 工具箱那五個都搬過來，而且舊的清掉', () => {
    localStorage.setItem('dc-shield-boss', 'cygnus')
    localStorage.setItem('dc-shield-sound', 'off')
    localStorage.setItem('dc-shield-overrides', '{"dunas":{"interval":30}}')
    localStorage.setItem('dc-shield-dispel', '12')
    localStorage.setItem('dc-hp-lead', '8')

    migrateRenamedKeys()

    expect(localStorage.getItem(BOSS_KEY)).toBe('cygnus')
    expect(localStorage.getItem(SOUND_KEY)).toBe('off')
    expect(localStorage.getItem(OVERRIDES_KEY)).toBe('{"dunas":{"interval":30}}')
    expect(localStorage.getItem(DISPEL_KEY)).toBe('12')
    expect(localStorage.getItem(HP_LEAD_KEY)).toBe('8')
    expect(localStorage.getItem('dc-shield-boss')).toBeNull()
    expect(localStorage.getItem('dc-hp-lead')).toBeNull()
  })

  it('分寶工具箱沒對齊前綴的那三個也搬', () => {
    localStorage.setItem('dc-groups', '[{"id":"a"}]')
    localStorage.setItem('dc-active-group', 'a')
    localStorage.setItem('dc-items-source', '{"mode":"default"}')

    migrateRenamedKeys()

    expect(localStorage.getItem(GROUPS_KEY)).toBe('[{"id":"a"}]')
    expect(localStorage.getItem(ACTIVE_GROUP_KEY)).toBe('a')
    expect(localStorage.getItem(ITEMS_SOURCE_KEY)).toBe('{"mode":"default"}')
    expect(localStorage.getItem('dc-groups')).toBeNull()
  })

  it('本來就對齊的 key 不會被動到', () => {
    localStorage.setItem('dc-loot-records', '[{"id":"r1"}]')
    localStorage.setItem('dc-loot-items', '["蒼龍"]')
    localStorage.setItem('dc-loot-migration', '2')

    migrateRenamedKeys()

    expect(localStorage.getItem('dc-loot-records')).toBe('[{"id":"r1"}]')
    expect(localStorage.getItem('dc-loot-items')).toBe('["蒼龍"]')
    expect(localStorage.getItem('dc-loot-migration')).toBe('2')
  })

  it('更早期的 legacy key 不能被改名——那是舊資料的偵測依據', () => {
    for (const k of ['dc-webhook-url', 'dc-loot-roster', 'dc-roster-source']) {
      localStorage.setItem(k, 'x')
    }

    migrateRenamedKeys()

    for (const k of ['dc-webhook-url', 'dc-loot-roster', 'dc-roster-source']) {
      expect(localStorage.getItem(k), k).toBe('x')
    }
  })

  it('新 key 已經有值就不蓋回去，但舊的照樣清掉', () => {
    localStorage.setItem('dc-shield-boss', 'cygnus')
    localStorage.setItem(BOSS_KEY, 'arkarium')

    migrateRenamedKeys()

    expect(localStorage.getItem(BOSS_KEY)).toBe('arkarium')
    expect(localStorage.getItem('dc-shield-boss')).toBeNull()
  })

  it('搬第二次不會把新值洗掉', () => {
    localStorage.setItem('dc-shield-dispel', '12')
    migrateRenamedKeys()
    localStorage.setItem(DISPEL_KEY, '20')
    migrateRenamedKeys()
    expect(localStorage.getItem(DISPEL_KEY)).toBe('20')
  })

  it('沒有舊值時什麼都不做', () => {
    migrateRenamedKeys()
    expect(localStorage.length).toBe(0)
  })
})

describe('王的 id 與反盾欄位改名', () => {
  beforeEach(() => localStorage.clear())

  it('上次選的王換成新 id', () => {
    localStorage.setItem(BOSS_KEY, 'pika')
    migrateRenamedBossIds()
    expect(localStorage.getItem(BOSS_KEY)).toBe('pink-bean')
  })

  it('自訂秒數跟著換 id，shieldDuration 也換成 reflectDuration', () => {
    localStorage.setItem(OVERRIDES_KEY, '{"pika":{"shieldDuration":26,"interval":21,"intervalFloat":3}}')

    migrateRenamedBossIds()

    expect(JSON.parse(localStorage.getItem(OVERRIDES_KEY)!)).toEqual({
      'pink-bean': { reflectDuration: 26, interval: 21, intervalFloat: 3 },
    })
  })

  it('沒改名的王原封不動', () => {
    localStorage.setItem(BOSS_KEY, 'dunas')
    localStorage.setItem(OVERRIDES_KEY, '{"dunas":{"reflectDuration":20,"interval":25,"intervalFloat":0}}')

    migrateRenamedBossIds()

    expect(localStorage.getItem(BOSS_KEY)).toBe('dunas')
    expect(JSON.parse(localStorage.getItem(OVERRIDES_KEY)!)).toEqual({
      dunas: { reflectDuration: 20, interval: 25, intervalFloat: 0 },
    })
  })

  it('壞掉的覆寫表留著不動——normalizeOverrides 會當作沒覆寫', () => {
    localStorage.setItem(OVERRIDES_KEY, '不是 JSON')
    migrateRenamedBossIds()
    expect(localStorage.getItem(OVERRIDES_KEY)).toBe('不是 JSON')
  })

  it('搬第二次不會再動', () => {
    localStorage.setItem(BOSS_KEY, 'pika')
    migrateRenamedBossIds()
    migrateRenamedBossIds()
    expect(localStorage.getItem(BOSS_KEY)).toBe('pink-bean')
  })

  it('沒有舊值時什麼都不做', () => {
    migrateRenamedBossIds()
    expect(localStorage.length).toBe(0)
  })
})

describe('搬遷跑在讀取之前', () => {
  it('拿舊 key 存的舊 id，模組一載入就讀到新 id', async () => {
    vi.resetModules()
    localStorage.clear()
    localStorage.setItem('dc-shield-boss', 'queen')
    // 讀 localStorage 是在模組載入當下發生的，讀到 cygnus 就代表換 key 與換 id 兩段
    // 都跑完了，而且順序是對的
    const { bossId } = await import('#src/boss/bossId')
    expect(bossId.value).toBe('cygnus')
    expect(localStorage.getItem('dc-shield-boss')).toBeNull()
  })
})
