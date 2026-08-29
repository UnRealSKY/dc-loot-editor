// 「血量門檻」機制模板的核心（純函式）。
// 有些王的關鍵不是時間而是血量：每掉到某個百分比就會出招，
// 所以要在快到門檻時先喊，跨過去的當下再確認一次。

export interface ThresholdState {
  /** 下一個會碰到的門檻（%）；全部過完就是 null */
  next: number | null
  /** 距離下一個門檻還有幾個百分點；沒有下一個就是 null */
  gap: number | null
  /** near＝快到了，hit＝剛跨過去 */
  level: 'none' | 'near' | 'hit'
}

/** 血量往下掉，所以「下一個」是比目前血量低的那些門檻裡最大的那個 */
export function nextThreshold(percent: number, thresholds: number[]): number | null {
  const below = thresholds.filter((t) => t < percent)
  return below.length ? Math.max(...below) : null
}

/** 這一次更新跨過了哪幾個門檻（血量可能一次掉很多，一口氣跨兩個也要抓到） */
export function crossedThresholds(
  prevPercent: number,
  percent: number,
  thresholds: number[],
): number[] {
  if (!(prevPercent > percent)) return []
  return thresholds.filter((t) => prevPercent > t && percent <= t).sort((a, b) => b - a)
}

/**
 * 目前該不該提醒。leadPct 是提前量：血量進到門檻上方這個範圍內就先喊，
 * 打手才有時間收招或準備應對。
 */
export function thresholdState(
  percent: number,
  thresholds: number[],
  leadPct = 5,
  justCrossed = false,
): ThresholdState {
  const next = nextThreshold(percent, thresholds)
  const gap = next == null ? null : Math.round((percent - next) * 10) / 10
  if (justCrossed) return { next, gap, level: 'hit' }
  const level = gap != null && gap <= leadPct ? 'near' : 'none'
  return { next, gap, level }
}

/** 經過時間 mm:ss；用來反推隊友技能的冷卻好了沒 */
export function elapsedText(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}
