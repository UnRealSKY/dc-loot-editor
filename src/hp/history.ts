// 血量曲線的資料處理（純函式）。一場戰鬥就是一串「時刻 → 剩餘比例」。

export interface HpPoint {
  t: number // ms（epoch）
  ratio: number // 0~1
}

export const MAX_POINTS = 3600 // 每秒一點，撐得住一小時的長期戰

/** 加一點；超過上限就丟最舊的。比例原地不動時只更新時間，曲線才不會被一堆重複點塞爆 */
export function pushPoint(points: HpPoint[], t: number, ratio: number): HpPoint[] {
  const last = points[points.length - 1]
  const prev = points[points.length - 2]
  // 連續三點同一個比例時，中間那點沒有資訊，直接把它往後移
  if (last && prev && last.ratio === ratio && prev.ratio === ratio) {
    return [...points.slice(0, -1), { t, ratio }]
  }
  const next = [...points, { t, ratio }]
  return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next
}

/** SVG polyline 的點字串；不足兩點時回空字串（畫不出線） */
export function sparklinePoints(points: HpPoint[], width: number, height: number): string {
  if (points.length < 2) return ''
  const t0 = points[0].t
  const span = Math.max(1, points[points.length - 1].t - t0)
  return points
    .map((p) => {
      const x = ((p.t - t0) / span) * width
      const y = height - p.ratio * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/** 最近這段時間掉了多少血（每秒百分點）；資料不足回 null */
export function recentDps(points: HpPoint[], windowMs = 20_000): number | null {
  if (points.length < 2) return null
  const last = points[points.length - 1]
  const from = points.find((p) => last.t - p.t <= windowMs)
  if (!from || from === last) return null
  const dt = (last.t - from.t) / 1000
  if (dt <= 0) return null
  const drop = (from.ratio - last.ratio) * 100
  return drop / dt
}
