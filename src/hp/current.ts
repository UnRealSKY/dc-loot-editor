// 目前的血量讀數。擷取在「王血量」那張卡裡跑，但血量門檻的機制面板也要看，
// 所以放在模組層讓兩邊共用（跟 cycleClocks 同樣的理由）。

import { reactive } from 'vue'

export interface HpNow {
  /** 剩餘百分比（0~100）；還沒讀到就是 null */
  percent: number | null
  /** 上一次的百分比，用來判斷這次跨過了哪些門檻 */
  prevPercent: number | null
  /** 最近的掉血速度（每秒百分點）；資料不足是 null */
  dps: number | null
  updatedAt: number
}

const state = reactive<HpNow>({ percent: null, prevPercent: null, dps: null, updatedAt: 0 })

export function hpNow(): HpNow {
  return state
}

export function setHpNow(percent: number | null, dps: number | null, at: number): void {
  state.prevPercent = state.percent
  state.percent = percent
  state.dps = dps
  state.updatedAt = at
}

export function clearHpNow(): void {
  state.percent = null
  state.prevPercent = null
  state.dps = null
  state.updatedAt = 0
}
