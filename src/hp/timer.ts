// 讀遊戲畫面上的「剩餘時間」計時器（純函式）。
//
// 那是七段顯示器字型，不需要通用 OCR：每個數字就是七個段的開關組合，查表就好。
// 兩個實務上的關鍵：
//   1. 數字主體是固定的橘黃，但上橫那一段渲染成白色高光，判斷段亮著時兩種都要算
//   2. 上橫抓不到就量不到真正的上緣，所以高度由寬度反推（七段字的高寬比是固定的）
// 計時器可以被玩家拖到畫面任何地方，所以是掃整張畫面，不預設位置。

export type Pixels = Uint8ClampedArray | Uint8Array

const DIGIT_RATIO = 1.78 // 高 ÷ 寬
const SEG_ON = 0.35 // 取樣區域裡有這麼多亮點就算這一段亮著

const isOrange = (r: number, g: number, b: number) =>
  r >= 235 && g >= 160 && g <= 225 && b <= 130 && r - b >= 120 && g - b >= 50
const isGlow = (r: number, g: number, b: number) => r >= 200 && g >= 190 && b >= 150
const isOn = (r: number, g: number, b: number) => isOrange(r, g, b) || isGlow(r, g, b)

const px = (data: Pixels, width: number, x: number, y: number): [number, number, number] => {
  const i = (y * width + x) * 4
  return [data[i], data[i + 1], data[i + 2]]
}

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
export function readDigit(
  data: Pixels,
  width: number,
  box: { x0: number; y0: number; x1: number; y1: number },
): number | null {
  const w = box.x1 - box.x0 + 1
  const h = box.y1 - box.y0 + 1
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
        if (isOn(...px(data, width, x, y))) hit++
      }
    }
    if (total && hit / total >= SEG_ON) on += name
  }
  return TABLE[on] ?? null
}

interface Group {
  x0: number
  x1: number
}

/**
 * 把橫向連在一起的欄位切成一個個數字：縮小後數字會靠在一起，要照寬度切開。
 * 單位寬度取最寬的那個——「1」只有右邊兩根豎線，寬度只有筆畫粗細，
 * 拿它去平均會把單位算得太小，正常數字反而被切碎。
 */
export function splitDigits(groups: Group[]): Group[] {
  if (!groups.length) return []
  const widths = groups.map((g) => g.x1 - g.x0 + 1)
  const max = Math.max(...widths)
  // 「1」那種窄欄不能拿來當基準，先剔掉再取中位數
  const normal = widths.filter((w) => w >= max * 0.4).sort((a, b) => a - b)
  const unit = normal[Math.floor(normal.length / 2)] ?? max
  const out: Group[] = []
  for (const g of groups) {
    const w = g.x1 - g.x0 + 1
    const n = Math.max(1, Math.round(w / unit))
    if (n === 1) {
      out.push(g)
      continue
    }
    const each = w / n
    for (let i = 0; i < n; i++) {
      out.push({ x0: Math.round(g.x0 + each * i), x1: Math.round(g.x0 + each * (i + 1)) - 1 })
    }
  }
  return out
}

export interface TimerReading {
  minutes: number
  seconds: number
  text: string
}

/** 掃整張畫面找計時器；讀不到回 null */
export function readTimer(data: Pixels, width: number, height: number): TimerReading | null {
  // 1. 橘黃像素的分布
  const rows = new Array(height).fill(0)
  for (let y = 0; y < height; y++) {
    let n = 0
    for (let x = 0; x < width; x++) if (isOrange(...px(data, width, x, y))) n++
    rows[y] = n
  }
  const peak = Math.max(...rows)
  if (peak < 3) return null

  // 2. 橘黃最密集的那一橫帶就是數字所在
  const dense = rows.map((n) => n >= peak * 0.15)
  let best: { y0: number; y1: number; sum: number } | null = null
  let y0: number | null = null
  for (let y = 0; y <= height; y++) {
    if (y < height && dense[y]) {
      if (y0 == null) y0 = y
      continue
    }
    if (y0 != null) {
      let sum = 0
      for (let k = y0; k < y; k++) sum += rows[k]
      if (!best || sum > best.sum) best = { y0, y1: y - 1, sum }
      y0 = null
    }
  }
  if (!best) return null

  // 3. 帶裡的欄位群組
  const groups: Group[] = []
  let run: Group | null = null
  for (let x = 0; x < width; x++) {
    let hit = false
    for (let y = best.y0; y <= best.y1 && !hit; y++) if (isOrange(...px(data, width, x, y))) hit = true
    if (hit) {
      if (!run) run = { x0: x, x1: x }
      else run.x1 = x
    } else if (run && x - run.x1 > 2) {
      groups.push(run)
      run = null
    }
  }
  if (run) groups.push(run)
  // 用「這一欄的字高不高」來篩，不看寬度——「1」只有兩根豎線，很窄但一樣高
  const bandH = best.y1 - best.y0 + 1
  const tall = groups.filter((g) => {
    let top = best!.y1
    let bot = best!.y0
    for (let x = g.x0; x <= g.x1; x++) {
      for (let y = best!.y0; y <= best!.y1; y++) {
        if (!isOrange(...px(data, width, x, y))) continue
        if (y < top) top = y
        if (y > bot) bot = y
      }
    }
    return bot - top + 1 >= bandH * 0.5
  })
  const digits = splitDigits(tall)
  if (digits.length < 4) return null

  // 4. 解碼。同一行的數字上下緣本來就一樣，用共同基準算——
  //    各自量的話寬度差個一兩 px，反推出來的高度就差好幾 px，上橫那段會整個落空
  const widths = digits.map((g) => g.x1 - g.x0 + 1).sort((a, b) => a - b)
  const unitW = widths[Math.floor(widths.length / 2)]
  let bottom = best.y0
  for (let y = best.y1; y >= best.y0; y--) {
    let n = 0
    for (let x = digits[0].x0; x <= digits[digits.length - 1].x1; x++) {
      if (isOrange(...px(data, width, x, y))) n++
    }
    if (n >= 2) {
      bottom = y
      break
    }
  }
  const top = Math.max(0, bottom - Math.round(unitW * DIGIT_RATIO))
  const read = digits.map((g) => {
    // 「1」「7」只有右邊兩根豎線，量到的框跟筆畫一樣窄；照這個框取樣的話
    // 七個段會全部落在同一根筆畫上、判成 8。窄框要往左補成標準寬度
    // （七段字的這兩個數字是靠右對齊的）
    const w = g.x1 - g.x0 + 1
    const x0 = w < unitW * 0.6 ? g.x1 - unitW + 1 : g.x0
    return { ...g, value: readDigit(data, width, { x0, y0: top, x1: g.x1, y1: bottom }) }
  })

  // 5. 畫面上不只計時器有橘黃數字，挑出連在一起、能組成合理時間的四位
  for (let i = 0; i + 3 < read.length; i++) {
    const four = read.slice(i, i + 4)
    if (four.some((d) => d.value == null)) continue
    const [a, b, c, d] = four.map((x) => x.value as number)
    const minutes = a * 10 + b
    const seconds = c * 10 + d
    if (seconds > 59) continue
    return {
      minutes,
      seconds,
      text: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    }
  }
  return null
}
