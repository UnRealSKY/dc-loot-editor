// 血量門檻的共用狀態（已過哪些門檻、剛跨過哪個、最後一段的固定循環）。
// 面板會同時開在主視窗與抬頭顯示，狀態與響鈴都集中在這裡，元件只負責畫。

import { ref, watch } from 'vue'
import { bossById } from '../boss/bosses'
import type { HpBoss } from '../boss/bosses'
import { crossedThresholds } from './thresholds'
import { hpNow } from './current'
import { triggerAt, cyclesElapsed, nudgeClock, type CycleClock } from '../boss/cycle'
import { beep } from '../boss/sound'
import { soundOn } from '../boss/prefs'
import { bossId } from '../boss/bossId'
import { touchNow } from '../boss/clock'

export const passed = ref<number[]>([])
/** 剛跨過的門檻，過幾秒自動消掉（面板用它閃一下） */
export const justHit = ref<number | null>(null)
/** 最近一次跨過的門檻與時刻——用來反推隊友技能的冷卻好了沒 */
export const lastHit = ref<{ threshold: number; at: number } | null>(null)
/** 過了最後一個門檻之後的固定循環，從那一刻開始數 */
export const finalClock = ref<CycleClock>(undefined)

let hitTimer: ReturnType<typeof setTimeout> | undefined
let rungFinal = 0

export function resetThresholds(): void {
  passed.value = []
  justHit.value = null
  lastHit.value = null
  finalClock.value = undefined
  rungFinal = 0
  clearTimeout(hitTimer)
}

export function startFinalCycle(now: number): void {
  finalClock.value = triggerAt(now)
  rungFinal = 0
}

export function nudgeFinalCycle(deltaSec: number): void {
  finalClock.value = nudgeClock(finalClock.value, deltaSec)
}

/**
 * 跨門檻是血量驅動的：血量一更新就判，不必等下一幀。
 * 判定與響鈴都在這裡做一次——面板會同時開在主視窗與抬頭顯示。
 */
const hp = hpNow()
watch(
  () => hp.percent,
  (percent) => {
    const boss = bossById(bossId.value)
    if (boss.mechanic !== 'hp') return
    if (percent == null || hp.prevPercent == null) return
    const hits = crossedThresholds(hp.prevPercent, percent, boss.thresholds)
    if (!hits.length) return
    const now = touchNow()
    passed.value = [...new Set([...passed.value, ...hits])]
    justHit.value = hits[hits.length - 1]
    lastHit.value = { threshold: hits[hits.length - 1], at: now }
    clearTimeout(hitTimer)
    hitTimer = setTimeout(() => (justHit.value = null), 4000)
    // 跨過最後一個門檻就進入固定循環
    const last = boss.thresholds[boss.thresholds.length - 1]
    if (boss.finalCycle && hits.includes(last)) startFinalCycle(now)
    if (soundOn.value) {
      beep(1250, 140)
      beep(1250, 140, 200)
      beep(1250, 220, 400)
    }
  },
)

/** 最後那段固定循環是時間驅動的，每一幀問一次跨輪了沒 */
export function tickFinalCycle(boss: HpBoss, now: number): boolean {
  if (!boss.finalCycle || finalClock.value == null) return false
  const done = cyclesElapsed(finalClock.value, boss.finalCycle, now)
  if (done <= rungFinal) return false
  rungFinal = done
  return true
}
