// 循環機制的計時狀態。放在模組層是因為面板與「接下來」時間表會被拆到不同地方
// （子母畫面只搬面板，時間表留在主視窗），兩邊得看同一份資料。

import { reactive } from 'vue'
import { cyclesElapsed, nudgeClock, triggerAt, type CycleClock, type CycleDef } from './cycle'

const clocks = reactive<Record<string, CycleClock>>({})

export function cycleClocks(): Record<string, CycleClock> {
  return clocks
}

export function triggerCycle(id: string, now: number): void {
  clocks[id] = triggerAt(now)
  rung[id] = 0
}

export function nudgeCycle(id: string, deltaSec: number): void {
  clocks[id] = nudgeClock(clocks[id], deltaSec)
}

/** 清掉這隻王所有機制的計時（換王或按重置） */
export function resetCycles(cycles: CycleDef[]): void {
  for (const c of cycles) {
    clocks[c.id] = undefined
    rung[c.id] = 0
  }
}

export function anyCycleRunning(cycles: CycleDef[]): boolean {
  return cycles.some((c) => clocks[c.id] != null)
}

// 已響過鈴的輪數。響鈴集中在這裡做——面板會同時開在主視窗與抬頭顯示，
// 放元件裡的話兩份會各響一次。
const rung: Record<string, number> = {}

export function resetRung(cycles: CycleDef[]): void {
  for (const c of cycles) rung[c.id] = 0
}

/** 每一幀呼叫：跨到新的一輪就回報，由呼叫端決定要不要發出聲音 */
export function dueCycles(cycles: CycleDef[], now: number): CycleDef[] {
  const due: CycleDef[] = []
  for (const c of cycles) {
    const clock = clocks[c.id]
    if (clock == null) continue
    const done = cyclesElapsed(clock, c.interval, now)
    if (done > (rung[c.id] ?? 0)) {
      rung[c.id] = done
      due.push(c)
    }
  }
  return due
}
