// 循環機制的計時狀態。放在模組層是因為面板與「接下來」時間表會被拆到不同地方
// （子母畫面只搬面板，時間表留在主視窗），兩邊得看同一份資料。

import { reactive } from 'vue'
import { nudgeClock, triggerAt, type CycleClock, type CycleDef } from './cycle'

const clocks = reactive<Record<string, CycleClock>>({})

export function cycleClocks(): Record<string, CycleClock> {
  return clocks
}

export function triggerCycle(id: string, now: number): void {
  clocks[id] = triggerAt(now)
}

export function nudgeCycle(id: string, deltaSec: number): void {
  clocks[id] = nudgeClock(clocks[id], deltaSec)
}

/** 清掉這隻王所有機制的計時（換王或按重置） */
export function resetCycles(cycles: CycleDef[]): void {
  for (const c of cycles) clocks[c.id] = undefined
}

export function anyCycleRunning(cycles: CycleDef[]): boolean {
  return cycles.some((c) => clocks[c.id] != null)
}
