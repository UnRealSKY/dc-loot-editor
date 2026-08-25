// 遊戲計時對齊：輸入當下畫面上的遊戲倒數 mm:ss，之後所有時刻都換算成遊戲計時顯示。
// 反盾與循環兩種面板共用同一個對齊點——同一場戰鬥只有一個遊戲計時。

import { ref } from 'vue'

export interface Anchor {
  gameSec: number // 對齊當下的遊戲剩餘秒數
  at: number      // 對齊當下的本機時刻（ms）
}

const anchor = ref<Anchor | null>(null)

export function anchorRef() {
  return anchor
}

// 只吃 mm:ss；格式不對就不動既有對齊（回 false 讓 UI 知道沒吃到）
export function setAnchor(input: string, now: number): boolean {
  const m = input.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return false
  anchor.value = { gameSec: Number(m[1]) * 60 + Number(m[2]), at: now }
  return true
}

export function calibrateAnchor(deltaSec: number): void {
  if (anchor.value) anchor.value = { ...anchor.value, gameSec: anchor.value.gameSec + deltaSec }
}

export function clearAnchor(): void {
  anchor.value = null
}

// 純格式化：有對齊就給遊戲計時 mm:ss，沒有就退回「還有幾秒」
export function formatAt(at: number, now: number, a: Anchor | null): string {
  if (a) {
    const sec = Math.round(a.gameSec - (at - a.at) / 1000)
    if (sec >= 0) {
      const mm = String(Math.floor(sec / 60)).padStart(2, '0')
      const ss = String(sec % 60).padStart(2, '0')
      return `${mm}:${ss}`
    }
  }
  return `+${Math.max(0, Math.round((at - now) / 1000))}s`
}

// 給元件用的便捷版（讀共用對齊點）
export function fmtTime(at: number, now: number): string {
  return formatAt(at, now, anchor.value)
}

// 對齊後「現在」的遊戲計時，讓人可以跟遊戲畫面核對對齊有沒有跑掉；沒對齊回 null
export function gameClock(now: number): string | null {
  return anchor.value ? formatAt(now, now, anchor.value) : null
}
