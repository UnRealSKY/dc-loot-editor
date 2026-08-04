// 王的反盾節奏資料（純資料＋純函式，不碰 localStorage）
//
// 王只定義「反盾持續」與「反盾間隔」；魔消是玩家自己放的技能，
// 秒數與打哪隻王無關，因此不進王的資料，由呼叫端當全域值傳入。

import type { ShieldParams } from './engine'

export interface Boss {
  id: string
  name: string
  shieldDuration: number // 反盾持續（秒）
  interval: number       // 反盾間隔（秒，實戰是「最少」這麼久）
}

export const BOSSES: Boss[] = [
  { id: 'pika', name: '皮卡啾／粉豆', shieldDuration: 25, interval: 20 },
  { id: 'dunas', name: '杜納斯', shieldDuration: 20, interval: 25 },
]

// 玩家的魔消技能持續（秒）
export const DEFAULT_DISPEL_DURATION = 15

export interface BossOverride {
  shieldDuration: number
  interval: number
}

// 只存被改過的王；沒改過的王不佔位，日後調整內建預設值才能直接生效
export type BossOverrides = Record<string, BossOverride>

export function bossById(id: string): Boss {
  return BOSSES.find((b) => b.id === id) ?? BOSSES[0]
}

export function paramsOf(
  boss: Boss,
  overrides: BossOverrides,
  dispelDuration: number,
): ShieldParams {
  const ov = overrides[boss.id]
  return {
    shieldDuration: ov?.shieldDuration ?? boss.shieldDuration,
    interval: ov?.interval ?? boss.interval,
    dispelDuration,
  }
}

// localStorage 讀入的覆寫表防呆：丟掉未知王與非正數秒數
export function normalizeOverrides(raw: unknown): BossOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: BossOverrides = {}
  for (const boss of BOSSES) {
    const ov = (raw as Record<string, unknown>)[boss.id]
    if (!ov || typeof ov !== 'object') continue
    const { shieldDuration, interval } = ov as Partial<BossOverride>
    if (!(typeof shieldDuration === 'number' && shieldDuration > 0)) continue
    if (!(typeof interval === 'number' && interval > 0)) continue
    out[boss.id] = { shieldDuration, interval }
  }
  return out
}

// 寫入覆寫；值與王的內建預設相同時移除該筆，「還原預設」按鈕便會自然消失
export function setOverride(
  overrides: BossOverrides,
  boss: Boss,
  patch: BossOverride,
): BossOverrides {
  const next = { ...overrides }
  if (patch.shieldDuration === boss.shieldDuration && patch.interval === boss.interval) {
    delete next[boss.id]
  } else {
    next[boss.id] = { ...patch }
  }
  return next
}
