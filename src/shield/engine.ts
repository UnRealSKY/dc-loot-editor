// 反盾計算機核心狀態機（純函式，UI 只負責渲染與計時觸發）
//
// 循環：shield(反盾持續) → interval(反盾間隔) → 有效魔消 ? failed(反盾持續) → interval
//                                              : shield
// 魔消有效窗：魔消 buff 須撐到間隔結束（反盾重施當下），
// 即間隔的最後「魔消持續」秒內施放才有效。

export interface ShieldParams {
  shieldDuration: number // 反盾持續（秒）
  interval: number       // 反盾間隔（秒）
  dispelDuration: number // 魔消持續（秒）
}

export type ShieldPhase = 'idle' | 'shield' | 'interval' | 'failed'

export interface ShieldState {
  phase: ShieldPhase
  phaseStart: number   // ms（epoch）
  dispelValid: boolean // 本次間隔是否已有有效魔消
}

export const IDLE: ShieldState = { phase: 'idle', phaseStart: 0, dispelValid: false }

// 各階段長度（秒）；反盾失敗期＝反盾持續
export function phaseDuration(phase: ShieldPhase, p: ShieldParams): number {
  if (phase === 'shield' || phase === 'failed') return p.shieldDuration
  if (phase === 'interval') return p.interval
  return Infinity
}

export function phaseEnd(state: ShieldState, p: ShieldParams): number {
  return state.phaseStart + phaseDuration(state.phase, p) * 1000
}

// 魔消提醒點＝間隔開始後第（間隔 − 魔消持續）秒
export function dispelWindowStart(p: ShieldParams): number {
  return Math.max(0, p.interval - p.dispelDuration)
}

// [反盾開始]：隨時可點，立即進入反盾（校準用）
export function startShield(now: number): ShieldState {
  return { phase: 'shield', phaseStart: now, dispelValid: false }
}

// [反盾結束]：隨時可點，立即進入間隔（校準用；也可修正反盾開始按錯的時機）
export function startInterval(now: number): ShieldState {
  return { phase: 'interval', phaseStart: now, dispelValid: false }
}

// [反盾失敗開始]：隨時可點，立即進入反盾失敗期（間隔實際為「最少」20 秒，
// 可能因王的出招動畫推遲；或忘了按魔消成功但實況確實失敗時人工校正）
export function startFailed(now: number): ShieldState {
  return { phase: 'failed', phaseStart: now, dispelValid: false }
}

export type DispelResult = 'valid' | 'tooEarly' | 'wrongPhase'

// [魔消成功]：僅間隔中有效，且必須落在有效窗（間隔最後「魔消持續」秒）
export function markDispel(
  state: ShieldState,
  now: number,
  p: ShieldParams,
): { state: ShieldState; result: DispelResult } {
  if (state.phase !== 'interval') return { state, result: 'wrongPhase' }
  const elapsedSec = (now - state.phaseStart) / 1000
  if (elapsedSec < dispelWindowStart(p)) return { state, result: 'tooEarly' }
  return { state: { ...state, dispelValid: true }, result: 'valid' }
}

// 自動推進：倒數到 0 依規則轉入下一階段（可能連續跨多段）
export function advance(state: ShieldState, now: number, p: ShieldParams): ShieldState {
  let s = state
  while (s.phase !== 'idle' && now >= phaseEnd(s, p)) {
    const end = phaseEnd(s, p)
    if (s.phase === 'shield') {
      s = { phase: 'interval', phaseStart: end, dispelValid: false }
    } else if (s.phase === 'interval') {
      s = s.dispelValid
        ? { phase: 'failed', phaseStart: end, dispelValid: false }
        : { phase: 'shield', phaseStart: end, dispelValid: false }
    } else {
      // failed → 下一個間隔
      s = { phase: 'interval', phaseStart: end, dispelValid: false }
    }
  }
  return s
}

export interface ShieldEvent {
  at: number // ms
  label: string
  canAttack: boolean // 事件之後是否可輸出
}

// 未來事件表（僅列 now 之後）：目前間隔依實際魔消標記推演；
// 之後的間隔預設「未魔消 → 反盾開始」
export function upcomingEvents(
  state: ShieldState,
  p: ShieldParams,
  now: number,
  count = 6,
): ShieldEvent[] {
  const out: ShieldEvent[] = []
  const push = (e: ShieldEvent) => {
    if (e.at > now) out.push(e)
  }
  let s = state
  while (out.length < count && s.phase !== 'idle') {
    const end = phaseEnd(s, p)
    if (s.phase === 'shield') {
      push({ at: end, label: '反盾結束（可輸出）', canAttack: true })
      s = { phase: 'interval', phaseStart: end, dispelValid: false }
    } else if (s.phase === 'interval') {
      const windowStart = dispelWindowStart(p)
      if (windowStart > 0) {
        push({ at: s.phaseStart + windowStart * 1000, label: '使用魔消！', canAttack: true })
      }
      if (s.dispelValid) {
        push({ at: end, label: '反盾失敗開始（可輸出）', canAttack: true })
        s = { phase: 'failed', phaseStart: end, dispelValid: false }
      } else {
        push({ at: end, label: '反盾開始（禁止輸出）', canAttack: false })
        s = { phase: 'shield', phaseStart: end, dispelValid: false }
      }
    } else {
      push({ at: end, label: '反盾預定結束（間隔開始）', canAttack: true })
      s = { phase: 'interval', phaseStart: end, dispelValid: false }
    }
  }
  return out.slice(0, count)
}
