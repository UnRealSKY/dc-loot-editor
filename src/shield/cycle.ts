// 「循環」機制模板的核心（純函式，UI 只負責渲染與計時觸發）
//
// 反盾模板要管階段轉換，循環模板不用：每個機制只有一個固定間隔，
// 按下「觸發」記住那一刻，之後就是每 interval 秒一次，自己接下去數。
// 因此狀態只有一個數字——最近一次觸發的時刻。

// 最近一次觸發時刻（ms）；undefined＝這輪還沒按過觸發，不計時
export type CycleClock = number | undefined

export function triggerAt(now: number): CycleClock {
  return now
}

// 距離下次觸發還有幾秒（無條件進位；未開始回 null）。
// 顯示 0 卻還沒到會誤導，所以剩餘落在 1 ~ interval，不會出現 0
export function secondsLeft(clock: CycleClock, interval: number, now: number): number | null {
  if (clock == null || interval <= 0) return null
  const elapsed = (now - clock) / 1000
  return Math.ceil(interval - (elapsed % interval)) || interval
}

// 從按下觸發到現在已經跑完幾輪；響鈴用（數字變大就是剛觸發過）
export function cyclesElapsed(clock: CycleClock, interval: number, now: number): number {
  if (clock == null || interval <= 0) return 0
  return Math.max(0, Math.floor((now - clock) / 1000 / interval))
}

// 微調：整條時間軸平移，倒數與下一輪一起跟著移
export function nudgeClock(clock: CycleClock, deltaSec: number): CycleClock {
  if (clock == null) return clock
  return clock + deltaSec * 1000
}

export interface CycleDef {
  id: string
  name: string
  interval: number
}

export interface CycleEvent {
  at: number
  name: string
}

// 接下來會觸發的機制（時間排序）。只列已經按過觸發的，沒開始的無從推算。
// 反盾面板有「接下來」事件表，這邊是同一件事的循環版。
export function upcomingCycleEvents(
  cycles: CycleDef[],
  clocks: Record<string, CycleClock>,
  now: number,
  count = 6,
): CycleEvent[] {
  const out: CycleEvent[] = []
  for (const c of cycles) {
    const clock = clocks[c.id]
    if (clock == null || c.interval <= 0) continue
    // 從下一次觸發開始往後排，排到夠填滿清單為止
    const done = cyclesElapsed(clock, c.interval, now)
    for (let k = done + 1; k <= done + count; k++) {
      const at = clock + k * c.interval * 1000
      if (at > now) out.push({ at, name: c.name })
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, count)
}
