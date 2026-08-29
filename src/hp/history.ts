// 血量序列與輸出速度（純函式）。一場戰鬥就是一串「時刻 → 剩餘比例 → 血條顏色」。
//
// 顏色要一起記：一場裡可能換階段或換一隻王，血條會整條回滿並換一個色系。
// 那不是回血，而是換了新的目標，速度要從那裡重新算，不然會算出一個荒謬的數字。

import { hueOf, hueDiff } from './scan'

export interface HpPoint {
  t: number // ms（epoch）
  ratio: number // 0~1
  color?: string | null // 血條顏色 "r,g,b"
}

export interface DpsSample {
  t: number
  dps: number
  color?: string | null // 這筆是打哪一條血時測到的
}

export const MAX_POINTS = 3600 // 每秒一點，撐得住一小時的長期戰
const HUE_TOL = 25 // 同一條血只有明暗漸層，色相不會跑這麼多

/** 兩個讀數是不是同一條血。色相差太多就是換階段／換王了 */
export function sameBar(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return a === b
  if (a === b) return true
  const pa = a.split(',').map(Number)
  const pb = b.split(',').map(Number)
  if (pa.length !== 3 || pb.length !== 3 || pa.some(isNaN) || pb.some(isNaN)) return false
  return hueDiff(hueOf(pa[0], pa[1], pa[2]), hueOf(pb[0], pb[1], pb[2])) <= HUE_TOL
}

/** 加一點；超過上限就丟最舊的。比例原地不動時只更新時間，序列才不會被一堆重複點塞爆 */
export function pushPoint(
  points: HpPoint[],
  t: number,
  ratio: number,
  color?: string | null,
): HpPoint[] {
  const last = points[points.length - 1]
  const prev = points[points.length - 2]
  // 連續三點同一個比例又同一條血時，中間那點沒有資訊，直接把它往後移
  if (
    last &&
    prev &&
    last.ratio === ratio &&
    prev.ratio === ratio &&
    sameBar(last.color, color) &&
    sameBar(prev.color, color)
  ) {
    return [...points.slice(0, -1), { t, ratio, color }]
  }
  const next = [...points, { t, ratio, color }]
  return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next
}

/**
 * 最近這段時間的輸出速度（每秒百分點）；資料不足回 null。
 *
 * 只累計掉血的部分，王回血就當作沒發生——回血倒扣回去會把速度算得比實際低，
 * 我們要看的是「打得多快」，不是「淨變化」。
 * 遇到換階段／換王（血條換色）就停在那裡，不跨著算。
 */
export function recentDps(points: HpPoint[], windowMs = 20_000): number | null {
  if (points.length < 2) return null
  const last = points[points.length - 1]
  let start = points.length - 1
  for (let i = points.length - 1; i > 0; i--) {
    if (!sameBar(points[i - 1].color, last.color)) break
    if (last.t - points[i - 1].t > windowMs) break
    start = i - 1
  }
  if (start === points.length - 1) return null
  let dropped = 0
  for (let i = start + 1; i < points.length; i++) {
    const d = points[i - 1].ratio - points[i].ratio
    if (d > 0) dropped += d
  }
  const dt = (last.t - points[start].t) / 1000
  if (dt <= 0) return null
  return (dropped * 100) / dt
}

/** 每次讀到速度就記一筆，用來回頭找峰值 */
export function pushDps(
  samples: DpsSample[],
  t: number,
  dps: number,
  color?: string | null,
): DpsSample[] {
  const next = [...samples, { t, dps, color }]
  return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next
}

/**
 * 峰值速度。機制打斷、跑位、王無敵都會讓當下的速度掉下來，
 * 但「打得順的時候有多快」才是判斷輸出的依據。
 *
 * 只看同一條血（同色）的樣本：不同階段、不同王的血條長度不一樣，
 * 百分比速度根本不能拿來比，混在一起就會顯示一個不屬於現在這條血的數字。
 * 給 windowMs 就只看那段時間內的峰值，不給就是這條血的全程。
 */
export function peakDps(
  samples: DpsSample[],
  windowMs?: number,
  color?: string | null,
): number | null {
  if (!samples.length) return null
  const last = samples[samples.length - 1]
  const sameColor =
    color === undefined ? samples : samples.filter((s) => sameBar(s.color, color))
  const inRange =
    windowMs == null ? sameColor : sameColor.filter((s) => last.t - s.t <= windowMs)
  if (!inRange.length) return null
  return inRange.reduce((mx, s) => Math.max(mx, s.dps), 0)
}
