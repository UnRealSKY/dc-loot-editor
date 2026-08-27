// BOSS 血條判讀（純函式，不碰 DOM；輸入是一張畫面的 RGBA 像素）
//
// 判讀依據是血條本身的三種像素：
//   BORDER 外框——固定的亮灰白，血條左右兩端就靠它收邊
//   FILL   有血——高飽和的彩色。顏色不固定（會隨王／階段變），所以只看飽和度不看色相；
//          多條血的王會同時出現好幾種顏色，一律都算有血
//   EMPTY  空槽——低飽和的中灰
// 位置不寫死：視窗大小一變，血條的位置與長度都會跟著變，所以每次都重新找。

export const NONE = 0
export const FILL = 1
export const EMPTY = 2
export const BORDER = 3
export type PixelKind = typeof NONE | typeof FILL | typeof EMPTY | typeof BORDER

const BORDER_SAT = 0.15, BORDER_V = 170
const FILL_SAT = 0.35, FILL_V = 60
const EMPTY_SAT = 0.18, EMPTY_V_MIN = 35, EMPTY_V_MAX = 140

export function classify(r: number, g: number, b: number): PixelKind {
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  if (mx === 0) return NONE
  const sat = (mx - mn) / mx
  if (sat <= BORDER_SAT && mx >= BORDER_V) return BORDER
  if (sat >= FILL_SAT && mx >= FILL_V) return FILL
  if (sat <= EMPTY_SAT && mx >= EMPTY_V_MIN && mx <= EMPTY_V_MAX) return EMPTY
  return NONE
}

const isInner = (k: PixelKind) => k === FILL || k === EMPTY

export type Pixels = Uint8ClampedArray | Uint8Array

export interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface HpReading {
  rect: Rect
  fill: number
  total: number
  ratio: number
  /** 有血的部分出現了哪幾種顏色（多條血的王會有多種） */
  colors: string[]
}

export interface ScanOptions {
  /** 只掃畫面上方這個比例——血條固定在最上方 */
  topFrac?: number
  /** 血條至少要有畫面寬度的多少 */
  minWidthFrac?: number
  /** 至少要連續幾列長得一樣才算血條，不然畫面上的長條裝飾也會中 */
  minRows?: number
}

function px(data: Pixels, width: number, x: number, y: number): [number, number, number] {
  const i = (y * width + x) * 4
  return [data[i], data[i + 1], data[i + 2]]
}

const diff = (a: number[], b: number[]) =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

// 一列裡最長的血條內部連續段。只容忍 1px 雜訊——這一步要的是穩，不是全。
function rowRun(data: Pixels, width: number, y: number) {
  let best = { len: 0, x0: 0, x1: 0 }
  let run = 0
  let gap = 0
  let start = 0
  for (let x = 0; x < width; x++) {
    if (isInner(classify(...px(data, width, x, y)))) {
      if (run === 0) start = x
      run += gap + 1
      gap = 0
      if (run > best.len) best = { len: run, x0: start, x1: x }
    } else if (++gap > 1) {
      run = 0
      gap = 0
    }
  }
  return best
}

/**
 * 第一步：找出血條的左端與上下界。
 * 分組只看左端——左端是血條的固定邊，右端會隨血量與 UI 遮擋一直變。
 */
export function detectBand(data: Pixels, width: number, height: number, opts: ScanOptions = {}) {
  const rows = Math.max(1, Math.round(height * (opts.topFrac ?? 1)))
  const minWidth = (opts.minWidthFrac ?? 0.2) * width
  const minRows = opts.minRows ?? 5
  const bands: Array<{ x0: number; x1: number; ys: number[] }> = []
  let cur: (typeof bands)[number] | null = null
  for (let y = 0; y < rows; y++) {
    const r = rowRun(data, width, y)
    if (r.len < minWidth) {
      cur = null
      continue
    }
    if (cur && Math.abs(r.x0 - cur.x0) <= 3) {
      cur.ys.push(y)
      cur.x1 = Math.max(cur.x1, r.x1)
    } else {
      cur = { x0: r.x0, x1: r.x1, ys: [y] }
      bands.push(cur)
    }
  }
  const valid = bands.filter((b) => b.ys.length >= minRows)
  if (!valid.length) return null
  valid.sort((a, b) => b.x1 - b.x0 - (a.x1 - a.x0))
  const band = valid[0]
  return { x0: band.x0, y0: band.ys[0], y1: band.ys[band.ys.length - 1] }
}

/**
 * 第二步：從左端沿著中線往右走到血條盡頭。
 * 同色就繼續；顏色跳掉時，只有「後面接著一段穩定的血條色」才算還在血條裡
 * （跨得過 有血→空槽 的抗鋸齒過渡帶，又不會滑進背景）。撞到外框就結束。
 */
export function extendRight(
  data: Pixels,
  width: number,
  y: number,
  x0: number,
  opts: { columnYs?: number[]; stableRun?: number; colorTol?: number; maxBad?: number } = {},
): number {
  const stable = opts.stableRun ?? 20
  const colorTol = opts.colorTol ?? 50
  const maxBad = opts.maxBad ?? 12
  // 血條是個矩形：每一欄從上到下都該是血條像素。背景就算某一列的顏色像空槽，
  // 整欄也很難跟著像，這條檢查把右端釘在真正的邊界上。
  const ys = opts.columnYs ?? [y]
  const columnOk = (x: number) => {
    let hit = 0
    for (const cy of ys) if (isInner(classify(...px(data, width, x, cy)))) hit++
    return hit / ys.length >= 0.7
  }
  let cur = px(data, width, x0, y)
  let sawEmpty = classify(...cur) === EMPTY
  let last = x0
  let bad = 0
  for (let x = x0 + 1; x < width; x++) {
    const p = px(data, width, x, y)
    if (classify(...p) === BORDER) break
    if (columnOk(x) && isInner(classify(...p)) && diff(p, cur) <= colorTol) {
      last = x
      bad = 0
      continue
    }
    if (bad === 0) {
      // 代表色取中位數——過渡帶的第一個髒像素當代表會誤判成「離開血條」
      const win: Array<[number, number, number]> = []
      let cols = 0
      let hitBorder = false
      for (let k = 0; k < stable && x + k < width; k++) {
        const q = px(data, width, x + k, y)
        const kq = classify(...q)
        if (kq === BORDER) {
          hitBorder = true
          break
        }
        if (!isInner(kq)) continue
        win.push(q)
        if (columnOk(x + k)) cols++
      }
      if (hitBorder) break
      if (win.length >= 6 && cols >= win.length * 0.5) {
        const probe = [0, 1, 2].map((c) => median(win.map((q) => q[c])))
        const agree = win.filter((q) => diff(q, probe) <= colorTol).length
        const kind = classify(probe[0], probe[1], probe[2])
        // 血量只會從右邊往左減：出現空槽之後不可能再有滿血色
        if (agree / win.length >= 0.7 && isInner(kind) && !(kind === FILL && sawEmpty)) {
          cur = probe as [number, number, number]
          if (kind === EMPTY) sawEmpty = true
          bad = 1
          continue
        }
      }
    }
    if (++bad > maxBad) break
  }
  return last
}

const colorKey = (r: number, g: number, b: number) =>
  `${Math.round(r / 48) * 48},${Math.round(g / 48) * 48},${Math.round(b / 48) * 48}`

/**
 * 第三步：在框好的範圍內算有血的比例。
 * 取中央幾列多數決，避開上下緣的漸層與外框。
 */
export function readRatioIn(data: Pixels, width: number, rect: Rect): Omit<HpReading, 'rect'> {
  const mid = Math.floor((rect.y0 + rect.y1) / 2)
  const ys = [mid - 2, mid, mid + 2].filter((y) => y >= rect.y0 && y <= rect.y1)
  const counts = new Map<string, number>()
  let fill = 0
  let total = 0
  for (let x = rect.x0; x <= rect.x1; x++) {
    let f = 0
    let e = 0
    for (const y of ys) {
      const [r, g, b] = px(data, width, x, y)
      const k = classify(r, g, b)
      if (k === FILL) {
        f++
        const key = colorKey(r, g, b)
        counts.set(key, (counts.get(key) ?? 0) + 1)
      } else if (k === EMPTY) e++
    }
    if (f + e === 0) continue
    total++
    if (f > e) fill++
  }
  const colors = [...counts.entries()]
    .filter(([, n]) => n >= ys.length * 4) // 幾個像素的雜色不算一種血條顏色
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
  return { fill, total, ratio: total ? fill / total : 0, colors }
}

/** 自動判讀一整張畫面；找不到血條回 null */
export function scanHpBar(
  data: Pixels,
  width: number,
  height: number,
  opts: ScanOptions = {},
): HpReading | null {
  const band = detectBand(data, width, height, { topFrac: 0.2, ...opts })
  if (!band) return null
  const ys: number[] = []
  for (let y = band.y0; y <= band.y1; y++) ys.push(y)
  const mid = Math.floor((band.y0 + band.y1) / 2)
  const x1 = extendRight(data, width, mid, band.x0, { columnYs: ys })
  const rect: Rect = { x0: band.x0, x1, y0: band.y0, y1: band.y1 }
  return { rect, ...readRatioIn(data, width, rect) }
}
