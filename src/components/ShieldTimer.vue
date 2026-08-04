<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  DEFAULT_PARAMS,
  IDLE,
  advance,
  dispelWindowStart,
  markDispel,
  phaseEnd,
  startFailed,
  startInterval,
  startShield,
  upcomingEvents,
  type ShieldParams,
  type ShieldState,
} from '../shield/engine'

const PARAMS_KEY = 'dc-shield-params'
const SOUND_KEY = 'dc-shield-sound'

function loadParams(): ShieldParams {
  try {
    const p = JSON.parse(localStorage.getItem(PARAMS_KEY) ?? 'null')
    if (p && p.shieldDuration > 0 && p.interval > 0 && p.dispelDuration >= 0) return p
  } catch {
    // 壞資料回預設
  }
  return { ...DEFAULT_PARAMS }
}

const params = ref<ShieldParams>(loadParams())
watch(params, (v) => localStorage.setItem(PARAMS_KEY, JSON.stringify(v)), { deep: true })

const soundOn = ref(localStorage.getItem(SOUND_KEY) !== 'off')
watch(soundOn, (v) => localStorage.setItem(SOUND_KEY, v ? 'on' : 'off'))

// ---- 聲音（WebAudio，首次操作時建立以符合瀏覽器自動播放限制）----
let audio: AudioContext | null = null
function beep(freq: number, ms: number, delayMs = 0) {
  if (!soundOn.value) return
  try {
    audio ??= new AudioContext()
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = freq
    gain.gain.value = 0.12
    osc.connect(gain).connect(audio.destination)
    const t = audio.currentTime + delayMs / 1000
    osc.start(t)
    osc.stop(t + ms / 1000)
  } catch {
    // 無聲環境忽略
  }
}
const soundAttackOk = () => beep(880, 180)
const soundDispel = () => {
  beep(1250, 120)
  beep(1250, 120, 180)
}
const soundShieldWarn = () => {
  beep(440, 220)
  beep(330, 300, 260)
}

// ---- 引擎狀態與計時 ----
const state = ref<ShieldState>(IDLE)
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
let remindedForPhase = 0 // 已提醒魔消的 phaseStart（每個間隔提醒一次）

function tick() {
  now.value = Date.now()
  const prev = state.value
  const next = advance(prev, now.value, params.value)
  if (next !== prev && (next.phase !== prev.phase || next.phaseStart !== prev.phaseStart)) {
    state.value = next
    if (next.phase === 'shield') soundShieldWarn()
    else soundAttackOk()
  }
  // 魔消提醒：間隔進入有效窗那一刻
  const s = state.value
  if (s.phase === 'interval' && remindedForPhase !== s.phaseStart) {
    const elapsed = (now.value - s.phaseStart) / 1000
    if (elapsed >= dispelWindowStart(params.value)) {
      remindedForPhase = s.phaseStart
      soundDispel()
    }
  }
}
onMounted(() => (timer = setInterval(tick, 100)))
onBeforeUnmount(() => clearInterval(timer))

// ---- 操作 ----
const dispelFeedback = ref<'valid' | 'tooEarly' | ''>('')
let feedbackTimer: ReturnType<typeof setTimeout> | undefined
function onStartShield() {
  state.value = startShield(Date.now())
  audio ??= new AudioContext()
}
function onStartInterval() {
  state.value = startInterval(Date.now())
  audio ??= new AudioContext()
}
function onStartFailed() {
  state.value = startFailed(Date.now())
  audio ??= new AudioContext()
}
function onDispel() {
  const { state: next, result } = markDispel(state.value, Date.now(), params.value)
  state.value = next
  if (result === 'wrongPhase') return
  if (result === 'tooEarly') flashEarly()
  dispelFeedback.value = result
  clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => (dispelFeedback.value = ''), 2000)
}
function onReset() {
  state.value = IDLE
  dispelFeedback.value = ''
}

// ---- 顯示 ----
const remaining = computed(() => {
  if (state.value.phase === 'idle') return 0
  return Math.max(0, Math.ceil((phaseEnd(state.value, params.value) - now.value) / 1000))
})
const progress = computed(() => {
  if (state.value.phase === 'idle') return 0
  const total = phaseEnd(state.value, params.value) - state.value.phaseStart
  return Math.min(100, Math.max(0, ((now.value - state.value.phaseStart) / total) * 100))
})
const PHASE_META = {
  idle: { cls: 'phase-idle', title: '待機', note: '開戰看到反盾出現時按「反盾開始」' },
  shield: { cls: 'phase-shield', title: '反盾中 ⛔ 禁止輸出', note: '' },
  interval: { cls: 'phase-attack', title: '間隔 ⚔ 可輸出', note: '' },
  failed: { cls: 'phase-attack', title: '反盾失敗 ⚔ 可輸出', note: '' },
} as const
const meta = computed(() => PHASE_META[state.value.phase])
// 魔消有效中（間隔進入有效窗且尚未標記）：色塊閃爍提醒
const dispelActive = computed(() => {
  const s = state.value
  if (s.phase !== 'interval' || s.dispelValid) return false
  return (now.value - s.phaseStart) / 1000 >= dispelWindowStart(params.value)
})
const intervalNote = computed(() => {
  const s = state.value
  if (s.phase !== 'interval') return ''
  if (s.dispelValid) return '✓ 魔消已標記——間隔結束進入反盾失敗（繼續輸出）'
  if (dispelActive.value) return '🔮 魔消有效中——現在使用魔消！'
  const winStart = dispelWindowStart(params.value)
  return `魔消有效窗：第 ${winStart}～${params.value.interval} 秒（提早無效）`
})

// 魔消時機錯誤：色塊閃黃三下
const earlyFlash = ref(false)
let earlyTimer: ReturnType<typeof setTimeout> | undefined
function flashEarly() {
  earlyFlash.value = false
  requestAnimationFrame(() => {
    earlyFlash.value = true
    clearTimeout(earlyTimer)
    earlyTimer = setTimeout(() => (earlyFlash.value = false), 1000)
  })
}

// ---- 遊戲計時器對齊（倒數顯示）----
const gameInput = ref('')
const anchor = ref<{ gameSec: number; at: number } | null>(null)
function applyAnchor() {
  const m = gameInput.value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return
  anchor.value = { gameSec: Number(m[1]) * 60 + Number(m[2]), at: Date.now() }
}
function calibrate(deltaSec: number) {
  if (anchor.value) anchor.value = { ...anchor.value, gameSec: anchor.value.gameSec + deltaSec }
}
function fmtEventTime(at: number): string {
  if (anchor.value) {
    const sec = Math.round(anchor.value.gameSec - (at - anchor.value.at) / 1000)
    if (sec >= 0) {
      const mm = String(Math.floor(sec / 60)).padStart(2, '0')
      const ss = String(sec % 60).padStart(2, '0')
      return `${mm}:${ss}`
    }
  }
  return `+${Math.max(0, Math.round((at - now.value) / 1000))}s`
}
const events = computed(() => upcomingEvents(state.value, params.value, now.value, 6))

// 大色塊的「下一階段」列（僅在有遊戲計時對齊時顯示）
const nextPhaseInfo = computed(() => {
  const s = state.value
  if (s.phase === 'idle' || !anchor.value) return null
  const label =
    s.phase === 'shield'
      ? '間隔（可輸出）'
      : s.phase === 'interval'
        ? s.dispelValid
          ? '反盾失敗（可輸出）'
          : '反盾開始（禁止輸出）'
        : '間隔（可輸出）'
  return { label, time: fmtEventTime(phaseEnd(s, params.value)) }
})
</script>

<template>
  <section>
    <div class="page-head">
      <h2>反盾計算機</h2>
      <span class="count">皮卡啾／粉豆</span>
      <div class="spacer" />
      <label class="sound-toggle">
        <input v-model="soundOn" type="checkbox" /> 聲音提醒
      </label>
    </div>

    <!-- 大字現況 -->
    <div class="card phase-panel" :class="[meta.cls, { 'dispel-active': dispelActive, 'flash-early': earlyFlash }]">
      <div class="phase-title">{{ meta.title }}</div>
      <div v-if="state.phase !== 'idle'" class="phase-remaining">{{ remaining }}<span class="unit">s</span></div>
      <div v-if="state.phase !== 'idle'" class="phase-bar"><div class="phase-bar-fill" :style="{ width: progress + '%' }" /></div>
      <div v-if="nextPhaseInfo" class="phase-next">
        下一階段：{{ nextPhaseInfo.label }} <span class="next-time">{{ nextPhaseInfo.time }}</span>
      </div>
      <div v-if="meta.note || intervalNote" class="phase-note">{{ intervalNote || meta.note }}</div>
      <div v-if="dispelFeedback" class="dispel-feedback" :class="dispelFeedback">
        {{ dispelFeedback === 'valid' ? '✓ 有效魔消' : '✕ 無效魔消（太早，反盾重施前就失效了）' }}
      </div>
    </div>

    <!-- 操作 -->
    <div class="card">
      <div class="controls">
        <button type="button" class="btn ctrl ctrl-shield" @click="onStartShield">反盾開始</button>
        <button type="button" class="btn ctrl ctrl-interval" @click="onStartInterval">反盾結束</button>
        <button type="button" class="btn ctrl ctrl-interval" @click="onStartFailed">反盾失敗開始</button>
        <button type="button" class="btn btn-primary ctrl" :disabled="state.phase !== 'interval'"
          @click="onDispel">魔消成功</button>
        <button type="button" class="btn btn-ghost ctrl" @click="onReset">重置</button>
      </div>
      <p class="muted ctrl-hint">
        反盾持續是標準 {{ params.shieldDuration }} 秒；間隔是「最少」{{ params.interval }} 秒，可能因王的出招動畫推遲——
        倒數到 0 會自動推進，看到遊戲內實況時按上方按鈕即可隨時校正。
        魔消只在間隔的最後 {{ params.dispelDuration }} 秒內有效。
      </p>
    </div>

    <!-- 時間軸 -->
    <div class="card">
      <div class="section-head">
        <h3>接下來</h3>
        <div class="spacer" />
        <div class="anchor-row">
          <input v-model="gameInput" class="anchor-input" placeholder="遊戲計時 mm:ss" spellcheck="false"
            @keyup.enter="applyAnchor" />
          <button type="button" class="btn btn-sm" @click="applyAnchor">對齊</button>
          <template v-if="anchor">
            <button type="button" class="btn btn-sm" title="校準 -1 秒" @click="calibrate(-1)">−1s</button>
            <button type="button" class="btn btn-sm" title="校準 +1 秒" @click="calibrate(1)">＋1s</button>
          </template>
        </div>
      </div>
      <p v-if="state.phase === 'idle'" class="muted">按「反盾開始」後這裡會列出接下來的事件。</p>
      <ul v-else class="event-list">
        <li v-for="e in events" :key="e.at" class="event" :class="e.canAttack ? 'ev-ok' : 'ev-warn'">
          <span class="ev-time">{{ fmtEventTime(e.at) }}</span>
          <span class="ev-label">{{ e.label }}</span>
        </li>
      </ul>
    </div>

    <!-- 參數 -->
    <div class="card">
      <div class="section-head"><h3>參數</h3></div>
      <div class="param-grid">
        <label class="field">
          <span class="field-label">反盾持續（秒）</span>
          <input v-model.number="params.shieldDuration" type="number" min="1" />
        </label>
        <label class="field">
          <span class="field-label">反盾間隔（秒）</span>
          <input v-model.number="params.interval" type="number" min="1" />
        </label>
        <label class="field">
          <span class="field-label">魔消持續（秒）</span>
          <input v-model.number="params.dispelDuration" type="number" min="0" />
        </label>
      </div>
    </div>
  </section>
</template>

<style scoped>
.page-head { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.page-head h2 { margin: 0; font-size: 20px; font-weight: 680; }
.page-head .spacer { flex: 1; }
.sound-toggle { display: flex; align-items: center; gap: 6px; font-size: 13.5px; color: var(--text-muted); cursor: pointer; }

.phase-panel { text-align: center; padding: 26px 20px; transition: background .25s, border-color .25s; }
.phase-idle { background: var(--surface-2); }
.phase-shield { background: var(--danger-soft); border-color: var(--danger); }
.phase-attack { background: var(--success-soft); border-color: var(--success); }
/* 魔消有效中：綠⇄琥珀持續閃爍（80% 時間看顏色，文字是輔助） */
.phase-attack.dispel-active { border-color: var(--warn); animation: dispel-pulse .55s ease-in-out infinite alternate; }
@keyframes dispel-pulse {
  from { background: var(--success-soft); }
  to { background: var(--warn-soft); }
}
/* 魔消時機錯誤：閃黃三下 */
.flash-early { animation: early-flash .3s ease-in-out 3 !important; }
@keyframes early-flash {
  50% { background: #fde047; }
}
.phase-title { font-size: 22px; font-weight: 750; }
.phase-shield .phase-title { color: var(--danger); }
.phase-attack .phase-title { color: var(--success); }
.phase-remaining { font-size: 64px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.1; }
.phase-remaining .unit { font-size: 24px; font-weight: 600; margin-left: 4px; }
.phase-bar { height: 6px; border-radius: 999px; background: rgba(0,0,0,.08); margin: 12px auto 0; max-width: 420px; overflow: hidden; }
.phase-bar-fill { height: 100%; background: currentColor; opacity: .45; transition: width .1s linear; }
.phase-next { margin-top: 12px; font-size: 15.5px; font-weight: 600; }
.phase-next .next-time {
  font-family: var(--mono); font-variant-numeric: tabular-nums; font-weight: 750;
  padding: 2px 8px; border-radius: 6px; background: rgba(0, 0, 0, .07); margin-left: 4px;
}
.phase-note { margin-top: 12px; font-size: 14.5px; font-weight: 550; }
.dispel-feedback { margin-top: 10px; font-size: 14px; font-weight: 650; }
.dispel-feedback.valid { color: var(--success); }
.dispel-feedback.tooEarly { color: var(--danger); }

.controls { display: flex; gap: 10px; flex-wrap: wrap; }
.ctrl { flex: 1; min-width: 120px; padding: 14px 16px; font-size: 15px; font-weight: 650; }
.ctrl-shield { border-color: var(--danger); color: var(--danger); }
.ctrl-shield:hover { background: var(--danger-soft); }
.ctrl-interval { border-color: var(--success); color: var(--success); }
.ctrl-interval:hover { background: var(--success-soft); }
.ctrl-hint { margin: 12px 0 0; font-size: 13px; }

.anchor-row { display: flex; gap: 6px; align-items: center; }
.anchor-input { width: 130px; font-family: var(--mono); font-size: 13px; }
.event-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.event { display: flex; gap: 12px; align-items: center; padding: 7px 12px; border-radius: var(--radius-sm); font-size: 14.5px; }
.ev-ok { background: var(--success-soft); color: var(--success); }
.ev-warn { background: var(--danger-soft); color: var(--danger); font-weight: 650; }
.ev-time { font-family: var(--mono); font-variant-numeric: tabular-nums; min-width: 64px; font-weight: 650; }

.param-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field-label { font-size: 12.5px; font-weight: 550; color: var(--text-muted); }
</style>
