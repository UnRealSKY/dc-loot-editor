import { describe, it, expect } from 'vitest'
import { readTimer, readDigit, splitDigits } from '#src/hp/timer'

// ---- 合成一個七段計時器：畫「mm 分 ss 秒」那四個數字 ----
const ORANGE: [number, number, number] = [255, 196, 70]
const GLOW: [number, number, number] = [255, 255, 255] // 上緣那一段在遊戲裡是白的
const BG: [number, number, number] = [12, 12, 14]

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

function fill(c: Canvas, x0: number, y0: number, x1: number, y1: number, color: number[]) {
  for (let y = Math.max(0, y0); y <= Math.min(c.height - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(c.width - 1, x1); x++) {
      const i = (y * c.width + x) * 4
      c.data[i] = color[0]; c.data[i + 1] = color[1]; c.data[i + 2] = color[2]; c.data[i + 3] = 255
    }
  }
}

/** 畫一個七段數字；上橫用白色（跟遊戲一樣），其餘橘黃 */
function drawDigit(c: Canvas, value: number, x: number, y: number, w: number) {
  const h = Math.round(w * 1.78)
  const t = Math.max(2, Math.round(w * 0.22)) // 筆畫粗細
  const on = SEGS[value]
  const has = (s: string) => on.includes(s)
  if (has('A')) fill(c, x + t, y, x + w - t, y + t, GLOW)
  if (has('F')) fill(c, x, y + t, x + t, y + Math.round(h / 2), ORANGE)
  if (has('B')) fill(c, x + w - t, y + t, x + w, y + Math.round(h / 2), ORANGE)
  if (has('G')) fill(c, x + t, y + Math.round(h / 2) - Math.round(t / 2), x + w - t, y + Math.round(h / 2) + Math.round(t / 2), ORANGE)
  if (has('E')) fill(c, x, y + Math.round(h / 2), x + t, y + h - t, ORANGE)
  if (has('C')) fill(c, x + w - t, y + Math.round(h / 2), x + w, y + h - t, ORANGE)
  if (has('D')) fill(c, x + t, y + h - t, x + w - t, y + h, ORANGE)
}

/** 畫「mm ss」四位；分與秒之間留比較大的空隙（遊戲裡夾著「分」字） */
function drawTimer(c: Canvas, text: string, x: number, y: number, w: number) {
  const gap = Math.round(w * 0.25)
  const wide = Math.round(w * 2)
  const digits = text.split('')
  let cx = x
  digits.forEach((ch, i) => {
    drawDigit(c, Number(ch), cx, y, w)
    cx += w + (i === 1 ? wide : gap)
  })
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

describe('把黏在一起的欄位切開', () => {
  it('寬度是單一數字兩倍的群組要切成兩個', () => {
    const out = splitDigits([{ x0: 0, x1: 19 }, { x0: 30, x1: 69 }, { x0: 80, x1: 99 }])
    expect(out).toHaveLength(4)
    expect(out[1]).toEqual({ x0: 30, x1: 49 })
    expect(out[2]).toEqual({ x0: 50, x1: 69 })
  })

  it('沒有東西可切時原樣回傳', () => {
    const groups = [{ x0: 0, x1: 19 }, { x0: 30, x1: 49 }]
    expect(splitDigits(groups)).toEqual(groups)
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
