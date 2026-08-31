import { describe, it, expect } from 'vitest'
import { readTimer, readDigit } from '#src/hp/timer'

// ---- 合成一個七段計時器：畫「mm 分 ss 秒」那四個數字 ----
// 遊戲裡的筆畫是由上而下的漸層（白 → 奶油 → 琥珀 → 橘），這裡照著畫，
// 只有最下面那截是飽和橘色的話會量錯字框
const STOPS: [number, number[]][] = [
  [0, [255, 255, 255]],
  [0.15, [255, 244, 204]],
  [0.3, [237, 220, 133]],
  [0.6, [236, 193, 57]],
  [1, [255, 188, 20]],
]
const BG = [12, 12, 14]

function tone(t: number): number[] {
  let i = 1
  while (i < STOPS.length - 1 && STOPS[i][0] < t) i++
  const [t0, a] = STOPS[i - 1]
  const [t1, b] = STOPS[i]
  const k = (t - t0) / (t1 - t0)
  return a.map((v, j) => Math.round(v + (b[j] - v) * k))
}

const SEGS: Record<number, string> = {
  0: 'ABCDEF', 1: 'BC', 2: 'ABDEG', 3: 'ABCDG', 4: 'BCFG',
  5: 'ACDFG', 6: 'ACDEFG', 7: 'ABC', 8: 'ABCDEFG', 9: 'ABCDFG',
}

interface Canvas {
  data: Uint8ClampedArray
  width: number
  height: number
}

function blank(width: number, height: number): Canvas {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = BG[0]; data[i + 1] = BG[1]; data[i + 2] = BG[2]; data[i + 3] = 255
  }
  return { data, width, height }
}

function put(c: Canvas, x: number, y: number, color: number[]) {
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return
  const i = (y * c.width + x) * 4
  c.data[i] = color[0]; c.data[i + 1] = color[1]; c.data[i + 2] = color[2]; c.data[i + 3] = 255
}

/** 填一塊筆畫；顏色照它在整個字裡的高度取漸層 */
function stroke(c: Canvas, x0: number, y0: number, x1: number, y1: number, top: number, h: number) {
  for (let y = y0; y <= y1; y++) {
    const color = tone(Math.min(1, Math.max(0, (y - top) / h)))
    for (let x = x0; x <= x1; x++) put(c, x, y, color)
  }
}

/**
 * 畫一個七段數字。豎線照遊戲的畫法連成一條——中間那段沒亮的時候（像 0、1），
 * 上下兩根豎線在遊戲裡是接起來的，不是斷開的兩截
 */
function drawDigit(c: Canvas, value: number, x: number, y: number, w: number) {
  const h = Math.round(w * 1.78)
  const t = Math.max(2, Math.round(w * 0.22)) // 筆畫粗細
  const mid = y + Math.round(h / 2)
  const half = Math.max(1, Math.round(t / 2))
  const on = SEGS[value]
  const has = (s: string) => on.includes(s)
  const bar = (bx: number, up: boolean, down: boolean) => {
    if (!up && !down) return
    stroke(c, bx, up ? y + t : mid - half, bx + t, down ? y + h - t : mid + half, y, h)
  }
  if (has('A')) stroke(c, x + t, y, x + w - t, y + t, y, h)
  if (has('G')) stroke(c, x + t, mid - half, x + w - t, mid + half, y, h)
  if (has('D')) stroke(c, x + t, y + h - t, x + w - t, y + h, y, h)
  bar(x, has('F'), has('E'))
  bar(x + w - t, has('B'), has('C'))
}

/** 畫「mm ss」四位；分與秒之間留比較大的空隙（遊戲裡夾著「分」字） */
function drawTimer(c: Canvas, text: string, x: number, y: number, w: number) {
  const gap = Math.round(w * 0.25)
  const wide = Math.round(w * 2)
  let cx = x
  text.split('').forEach((ch, i) => {
    drawDigit(c, Number(ch), cx, y, w)
    cx += w + (i === 1 ? wide : gap)
  })
}

/** 畫面上其他地方的橘字（聊天、傷害數字）：面積比計時器大得多 */
function clutter(c: Canvas, y: number, rows: number) {
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < 24; i++) {
      const x = 8 + i * 16
      stroke(c, x, y + r * 22, x + 11, y + r * 22 + 17, y + r * 22, 18)
    }
  }
}

describe('七段數字', () => {
  it('每個數字都認得出來', () => {
    for (let v = 0; v <= 9; v++) {
      const c = blank(60, 90)
      drawDigit(c, v, 10, 10, 30)
      const got = readDigit(c.data, c.width, { x0: 10, y0: 10, x1: 10 + 30, y1: 10 + Math.round(30 * 1.78) })
      expect(got, `數字 ${v}`).toBe(v)
    }
  })
})

describe('讀畫面上的計時器', () => {
  it('讀出分與秒', () => {
    const c = blank(400, 200)
    drawTimer(c, '5822', 100, 60, 30)
    expect(readTimer(c.data, c.width, c.height)).toMatchObject({ minutes: 58, seconds: 22, text: '58:22' })
  })

  it('數字小一點也讀得到——視窗縮小時字會跟著變小', () => {
    const c = blank(300, 120)
    drawTimer(c, '0705', 60, 30, 14)
    expect(readTimer(c.data, c.width, c.height)?.text).toBe('07:05')
  })

  it('計時器被拖到別的位置照樣找得到', () => {
    const c = blank(500, 400)
    drawTimer(c, '1234', 300, 300, 24)
    expect(readTimer(c.data, c.width, c.height)?.text).toBe('12:34')
  })

  it('畫面別處有更大片的橘色也不會被搶走', () => {
    const c = blank(500, 400)
    drawTimer(c, '4310', 40, 20, 22)
    clutter(c, 180, 6) // 面積遠大於計時器，但湊不出七段數字
    expect(readTimer(c.data, c.width, c.height)?.text).toBe('43:10')
  })

  it('畫面上沒有計時器就回 null', () => {
    const c = blank(300, 200)
    expect(readTimer(c.data, c.width, c.height)).toBeNull()
  })

  it('秒數不可能超過 59，湊不出合理時間就不給', () => {
    const c = blank(400, 200)
    drawTimer(c, '1177', 100, 60, 30) // 77 秒不合理
    expect(readTimer(c.data, c.width, c.height)).toBeNull()
  })
})
