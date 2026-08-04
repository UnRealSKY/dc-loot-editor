import { describe, it, expect } from 'vitest'
import {
  BOSSES,
  DEFAULT_DISPEL_DURATION,
  bossById,
  normalizeOverrides,
  paramsOf,
  setOverride,
} from '#src/shield/bosses'

const PIKA = bossById('pika')
const DUNAS = bossById('dunas')

describe('王清單', () => {
  it('id 唯一', () => {
    expect(new Set(BOSSES.map((b) => b.id)).size).toBe(BOSSES.length)
  })

  it('未知 id 回第一隻王', () => {
    expect(bossById('nope').id).toBe(BOSSES[0].id)
    expect(bossById('').id).toBe(BOSSES[0].id)
  })
})

describe('paramsOf', () => {
  it('無覆寫時用王的預設', () => {
    expect(paramsOf(DUNAS, {}, DEFAULT_DISPEL_DURATION)).toEqual({
      shieldDuration: 20,
      interval: 25,
      dispelDuration: 15,
    })
  })

  it('有覆寫時用覆寫值', () => {
    const ov = { dunas: { shieldDuration: 21, interval: 26 } }
    expect(paramsOf(DUNAS, ov, 15)).toEqual({
      shieldDuration: 21,
      interval: 26,
      dispelDuration: 15,
    })
  })

  it('別隻王的覆寫不互相污染', () => {
    const ov = { pika: { shieldDuration: 99, interval: 99 } }
    expect(paramsOf(DUNAS, ov, 15)).toEqual({
      shieldDuration: 20,
      interval: 25,
      dispelDuration: 15,
    })
  })

  it('魔消持續一律取全域值，不受王影響', () => {
    expect(paramsOf(PIKA, {}, 12).dispelDuration).toBe(12)
    expect(paramsOf(DUNAS, {}, 12).dispelDuration).toBe(12)
  })
})

describe('normalizeOverrides', () => {
  it('非物件回空', () => {
    expect(normalizeOverrides(null)).toEqual({})
    expect(normalizeOverrides('x')).toEqual({})
    expect(normalizeOverrides([1, 2])).toEqual({})
  })

  it('丟掉未知王與非正數秒數', () => {
    const raw = {
      pika: { shieldDuration: 26, interval: 21 },
      dunas: { shieldDuration: 0, interval: 25 },
      ghost: { shieldDuration: 10, interval: 10 },
    }
    expect(normalizeOverrides(raw)).toEqual({ pika: { shieldDuration: 26, interval: 21 } })
  })
})

describe('setOverride', () => {
  it('寫入覆寫值', () => {
    const next = setOverride({}, DUNAS, { shieldDuration: 22, interval: 25 })
    expect(next).toEqual({ dunas: { shieldDuration: 22, interval: 25 } })
  })

  it('值等於王的預設時移除該筆（讓「還原預設」自然消失）', () => {
    const ov = { dunas: { shieldDuration: 22, interval: 25 } }
    expect(setOverride(ov, DUNAS, { shieldDuration: 20, interval: 25 })).toEqual({})
  })

  it('不改動傳入的物件', () => {
    const ov = { pika: { shieldDuration: 26, interval: 20 } }
    setOverride(ov, DUNAS, { shieldDuration: 22, interval: 25 })
    expect(ov).toEqual({ pika: { shieldDuration: 26, interval: 20 } })
  })
})
