// 讀遊戲畫面上的「剩餘時間」計時器（純函式）。
//
// 計時器可以被玩家拖到畫面任何地方，字也會跟著視窗大小變大變小，所以不能靠位置去找，
// 只能靠這四個數字本身的長相去認：
//   1. 顏色——筆畫是由上而下白 → 奶油 → 琥珀 → 橘的漸層，整條都要算進去。
//      只認最下面那截飽和的橘，量到的字框會比實際的窄一大半
//   2. 形狀——七段字每一段各自是一塊獨立的亮區，先連通，再把上下接得上的段併成一個字框
//   3. 結構——四個等高、共用上下緣、橫向相鄰的字框，而且要能組成合理的 mm:ss
// 畫面上別的地方也有亮橘（聊天、傷害數字、介面），靠的是這三關一起過，不是誰的面積大。

export type Pixels = Uint8ClampedArray | Uint8Array

const SEG_ON = 0.35 // 取樣區域裡有這麼多亮點就算這一段亮著
const MIN_BLOB = 10 // 比這還小的亮區是雜訊

/** 計時器筆畫的顏色：夠亮的暖色，白到橘整段漸層都算 */
export function isGlyph(r: number, g: number, b: number): boolean {
  return r >= 190 && g >= r * 0.66 && g <= r + 10 && b <= g + 10
}

const px = (data: Pixels, width: number, x: number, y: number): [number, number, number] => {
  const i = (y * width + x) * 4
  return [data[i], data[i + 1], data[i + 2]]
}

export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

const boxW = (b: Box) => b.x1 - b.x0 + 1
const boxH = (b: Box) => b.y1 - b.y0 + 1

// 段在數字方框裡的取樣範圍（比例）
const SEGMENTS: Record<string, [number, number, number, number]> = {
  A: [0.3, 0.02, 0.7, 0.16],
  B: [0.78, 0.15, 0.98, 0.42],
  C: [0.78, 0.58, 0.98, 0.85],
  D: [0.3, 0.84, 0.7, 0.98],
  E: [0.02, 0.58, 0.22, 0.85],
  F: [0.02, 0.15, 0.22, 0.42],
  G: [0.3, 0.43, 0.7, 0.57],
}

const TABLE: Record<string, number> = {
  ABCDEF: 0,
  BC: 1,
  ABDEG: 2,
  ABCDG: 3,
  BCFG: 4,
  ACDFG: 5,
  ACDEFG: 6,
  ABC: 7,
  ABCDEFG: 8,
  ABCDFG: 9,
}

/** 解一個數字方框；認不出來回 null */
export function readDigit(data: Pixels, width: number, box: Box): number | null {
  const w = boxW(box)
  const h = boxH(box)
  if (w < 4 || h < 6) return null
  let on = ''
  for (const [name, [rx0, ry0, rx1, ry1]] of Object.entries(SEGMENTS)) {
    let hit = 0
    let total = 0
    const yFrom = Math.round(box.y0 + h * ry0)
    const yTo = Math.round(box.y0 + h * ry1)
    const xFrom = Math.round(box.x0 + w * rx0)
    const xTo = Math.round(box.x0 + w * rx1)
    for (let y = yFrom; y <= yTo; y++) {
      for (let x = xFrom; x <= xTo; x++) {
        total++
        if (isGlyph(...px(data, width, x, y))) hit++
      }
    }
    if (total && hit / total >= SEG_ON) on += name
  }
  return TABLE[on] ?? null
}

/** 掃出畫面上所有亮區（八方向連通）。橫跨大半個畫面的那種一定不是數字，直接丟掉 */
export function glyphBlobs(data: Pixels, width: number, height: number): Box[] {
  const n = width * height
  const mask = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const j = i * 4
    if (isGlyph(data[j], data[j + 1], data[j + 2])) mask[i] = 1
  }
  const seen = new Uint8Array(n)
  const stack = new Int32Array(n)
  const maxW = width * 0.4
  const maxH = height * 0.4
  const out: Box[] = []
  for (let s = 0; s < n; s++) {
    if (!mask[s] || seen[s]) continue
    let top = 0
    stack[top++] = s
    seen[s] = 1
    let x0 = s % width
    let x1 = x0
    const y0 = (s / width) | 0
    let y1 = y0
    let size = 0
    while (top > 0) {
      const i = stack[--top]
      size++
      const x = i % width
      const y = (i / width) | 0
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= height) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          if (nx < 0 || nx >= width) continue
          const k = ny * width + nx
          if (mask[k] && !seen[k]) {
            seen[k] = 1
            stack[top++] = k
          }
        }
      }
    }
    if (size < MIN_BLOB || x1 - x0 + 1 > maxW || y1 - y0 + 1 > maxH) continue
    out.push({ x0, y0, x1, y1 })
  }
  return out
}

/**
 * 把亮區併成一個個字框。七段字的每一段是分開畫的，一個數字會散成好幾塊，
 * 左右幾乎疊在一起、上下又接得上的就是同一個字；
 * 左右只容許 1 px，隔壁那個數字才不會被一起併進來。
 */
export function mergeIntoDigits(boxes: Box[]): Box[] {
  const parent = boxes.map((_, i) => i)
  const find = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]]
      a = parent[a]
    }
    return a
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]
      if (a.x0 - 1 > b.x1 || b.x0 - 1 > a.x1) continue
      // 段跟段本來就是接在一起的，留的裕度只是給消鋸齒斷掉用；
      // 而且是照比較矮的那塊算，小碎塊才拖不動整個字
      const gap = Math.max(a.y0 - b.y1, b.y0 - a.y1)
      if (gap > Math.max(2, Math.min(boxH(a), boxH(b)) * 0.5)) continue
      const ra = find(i)
      const rb = find(j)
      if (ra !== rb) parent[ra] = rb
    }
  }
  const groups = new Map<number, Box>()
  boxes.forEach((b, i) => {
    const g = groups.get(find(i))
    if (!g) {
      groups.set(find(i), { ...b })
      return
    }
    g.x0 = Math.min(g.x0, b.x0)
    g.y0 = Math.min(g.y0, b.y0)
    g.x1 = Math.max(g.x1, b.x1)
    g.y1 = Math.max(g.y1, b.y1)
  })
  return [...groups.values()]
}

export interface TimerReading {
  minutes: number
  seconds: number
  text: string
}

const pad = (v: number) => String(v).padStart(2, '0')

/** 四個字框試著讀成 mm:ss；不像計時器就回 null */
function readFour(data: Pixels, width: number, win: Box[]): TimerReading | null {
  const unit = Math.max(...win.map(boxW))
  if (win.some((b) => boxW(b) < unit * 0.2)) return null
  // 分與秒中間夾著「分」字，那個空隙本來就寬；同一組的兩個數字則是貼著的
  const gaps = [win[1].x0 - win[0].x1, win[2].x0 - win[1].x1, win[3].x0 - win[2].x1]
  if (gaps.some((g) => g < 0 || g > unit * 3)) return null
  if (gaps[0] > unit * 0.8 || gaps[2] > unit * 0.8) return null
  // 上下緣取四個字的聯集：「1」「4」少了上下橫段，自己量會矮一截
  const y0 = Math.min(...win.map((b) => b.y0))
  const y1 = Math.max(...win.map((b) => b.y1))
  const values: number[] = []
  for (const b of win) {
    // 「1」只有右邊兩根豎線，量到的框跟筆畫一樣窄；照那個框取樣七個段會全落在
    // 同一根筆畫上、判成 8。窄框要往左補成標準寬度（七段字這個數字靠右對齊）
    const x0 = boxW(b) < unit * 0.6 ? Math.max(0, b.x1 - unit + 1) : b.x0
    const v = readDigit(data, width, { x0, y0, x1: b.x1, y1 })
    if (v == null) return null
    values.push(v)
  }
  const minutes = values[0] * 10 + values[1]
  const seconds = values[2] * 10 + values[3]
  if (seconds > 59) return null
  return { minutes, seconds, text: `${pad(minutes)}:${pad(seconds)}` }
}

/** 掃整張畫面找計時器；讀不到回 null */
export function readTimer(data: Pixels, width: number, height: number): TimerReading | null {
  const digits = mergeIntoDigits(glyphBlobs(data, width, height))
    .filter((b) => boxW(b) >= 4 && boxH(b) >= 8)
    .sort((a, b) => a.x0 - b.x0)
  for (let i = 0; i < digits.length; i++) {
    const first = digits[i]
    const h = boxH(first)
    const cy = (first.y0 + first.y1) / 2
    // 同一行：上下置中對齊、高度相近。「1」比別的字矮一截，所以留裕度
    const line = digits
      .slice(i)
      .filter((b) => Math.abs((b.y0 + b.y1) / 2 - cy) <= h * 0.25 && boxH(b) >= h * 0.7 && boxH(b) <= h * 1.4)
    if (line.length < 4) continue
    const read = readFour(data, width, line.slice(0, 4))
    if (read) return read
  }
  return null
}
