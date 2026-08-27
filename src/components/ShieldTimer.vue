<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  IDLE,
  advance,
  attackRemaining,
  attackEndAt,
  dispelWindowStart,
  markDispel,
  nudge,
  phaseEnd,
  resistRemaining,
  cooldownRemaining,
  DISPEL_RESIST,
  DISPEL_COOLDOWN,
  startBlocked,
  startInterval,
  startShield,
  upcomingEvents,
  type ShieldState,
} from '../shield/engine'
import {
  BOSSES,
  DEFAULT_DISPEL_DURATION,
  bossById,
  shieldBossById,
  normalizeOverrides,
  paramsOf,
  setOverride,
  type BossOverride,
  type BossOverrides,
  type CycleBoss,
  type HpBoss,
} from '../shield/bosses'
import CycleBoard from './CycleBoard.vue'
import HpCapture from './HpCapture.vue'
import AnchorRow from './AnchorRow.vue'
import CycleEvents from './CycleEvents.vue'
import HpThresholdBoard from './HpThresholdBoard.vue'
import { anchorRef, setAnchor, calibrateAnchor, fmtTime, gameClock } from '../shield/anchor'
import { beep as playBeep, ensureAudio } from '../shield/sound'
import { openPipWindow, pipSupported, keepFitted } from '../pip/documentPip'

const BOSS_KEY = 'dc-shield-boss'
const OVERRIDES_KEY = 'dc-shield-overrides'
const DISPEL_KEY = 'dc-shield-dispel'
const SOUND_KEY = 'dc-shield-sound'

function loadOverrides(): BossOverrides {
  try {
    return normalizeOverrides(JSON.parse(localStorage.getItem(OVERRIDES_KEY) ?? 'null'))
  } catch {
    return {} // 壞資料當作沒覆寫
  }
}

function loadDispelDuration(): number {
  const n = Number(localStorage.getItem(DISPEL_KEY))
  return n > 0 ? n : DEFAULT_DISPEL_DURATION
}

// 王選單列出所有王；選到誰就換成該王機制模板的面板
const bosses = BOSSES
const bossId = ref(bossById(localStorage.getItem(BOSS_KEY) ?? '').id)
const overrides = ref<BossOverrides>(loadOverrides())
const dispelDuration = ref(loadDispelDuration())

const current = computed(() => bossById(bossId.value))
const cycleBoss = computed(() => (current.value.mechanic === 'cycle' ? (current.value as CycleBoss) : null))
const hpBoss = computed(() => (current.value.mechanic === 'hp' ? (current.value as HpBoss) : null))
// 反盾面板的王：選到循環模板的王時退回反盾王，參數不會落空
const boss = computed(() => shieldBossById(bossId.value))
const params = computed(() => paramsOf(boss.value, overrides.value, dispelDuration.value))

watch(bossId, (v) => localStorage.setItem(BOSS_KEY, v))
watch(overrides, (v) => localStorage.setItem(OVERRIDES_KEY, JSON.stringify(v)), { deep: true })
watch(dispelDuration, (v) => localStorage.setItem(DISPEL_KEY, String(v)))

const soundOn = ref(localStorage.getItem(SOUND_KEY) !== 'off')
watch(soundOn, (v) => localStorage.setItem(SOUND_KEY, v ? 'on' : 'off'))

// ---- 聲音（實作在 shield/sound.ts，與女皇面板共用同一個 AudioContext）----
function beep(freq: number, ms: number, delayMs = 0) {
  if (!soundOn.value) return
  playBeep(freq, ms, delayMs)
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
let timer: number | undefined
let remindedForPhase = 0 // 已提醒魔消的 phaseStart（每個間隔提醒一次）

function tick() {
  // now 一定要更新：遊戲計時的時鐘讀的就是它，停下來的話對齊會整個歪掉
  now.value = Date.now()
  if (cycleBoss.value || hpBoss.value) return // 別的模板自己管，反盾狀態機在旁邊空轉沒有意義
  const prev = state.value
  const next = advance(prev, now.value, params.value)
  if (next !== prev && (next.phase !== prev.phase || next.phaseStart !== prev.phaseStart)) {
    state.value = next
    if (next.phase === 'shield') soundShieldWarn()
    else soundAttackOk()
  }
  // 魔消提醒：間隔進入有效窗那一刻。王的耐性還在就不響——放了也擋不掉
  const s = state.value
  if (s.phase === 'interval' && remindedForPhase !== s.phaseStart) {
    const elapsed = (now.value - s.phaseStart) / 1000
    if (elapsed >= dispelWindowStart(params.value) && resistRemaining(s, now.value) === 0) {
      remindedForPhase = s.phaseStart
      soundDispel()
    }
  }
}
// 每一幀更新，引信與進度條才會連續移動（100ms 一跳看起來會頓）
function loop() {
  tick()
  timer = requestAnimationFrame(loop)
}
onMounted(() => (timer = requestAnimationFrame(loop)))
onBeforeUnmount(() => timer != null && cancelAnimationFrame(timer))

// ---- 操作 ----
const dispelFeedback = ref<'valid' | 'tooEarly' | ''>('')
let feedbackTimer: ReturnType<typeof setTimeout> | undefined
function onStartShield() {
  state.value = startShield(Date.now())
  ensureAudio()
}
function onStartInterval() {
  state.value = startInterval(Date.now())
  ensureAudio()
}
function onStartBlocked() {
  state.value = startBlocked(Date.now())
  ensureAudio()
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
  remindedForPhase = 0 // 清掉上一場殘留，換王後第一個間隔才會提醒魔消
}
// 實況與倒數差一兩秒時就地校正，不必整段重按
function onNudge(deltaSec: number) {
  state.value = nudge(state.value, deltaSec)
}

// ---- 子母畫面 ----
// 打王時遊戲佔滿螢幕，這個視窗會浮在最上面，把血量與機制面板整組搬過去。
const pipBody = ref<HTMLElement | null>(null)
const canPip = pipSupported()
async function togglePip() {
  if (pipBody.value) {
    // 關掉視窗，Teleport 就會把內容放回頁面原本的位置
    ;(pipBody.value.ownerDocument.defaultView as Window | null)?.close()
    pipBody.value = null
    return
  }
  const win = await openPipWindow({ width: 480, height: 200 })
  if (!win) return
  win.addEventListener('pagehide', () => (pipBody.value = null))
  pipBody.value = win.document.body
  // 內容搬進去之後才量得到高度
  await nextTick()
  keepFitted(win)
}

// ---- 選王與參數 ----
// 計時中換王會拿到錯的倒數，鎖住；要換先按「重置」
const cycleRunning = ref(false)
const locked = computed(() => state.value.phase !== 'idle' || cycleRunning.value)

function selectBoss(id: string) {
  if (locked.value) return
  bossId.value = id
}

// 參數輸入框寫入的是「該王的覆寫」；秒數改回內建預設會自動移除覆寫
function patchOverride(part: Partial<BossOverride>) {
  const p = params.value
  overrides.value = setOverride(overrides.value, boss.value, {
    shieldDuration: p.shieldDuration,
    interval: p.interval,
    intervalFloat: p.intervalFloat ?? 0,
    ...part,
  })
}
const shieldDuration = computed({
  get: () => params.value.shieldDuration,
  set: (v: number) => v > 0 && patchOverride({ shieldDuration: v }),
})
const intervalSeconds = computed({
  get: () => params.value.interval,
  set: (v: number) => v > 0 && patchOverride({ interval: v }),
})
// 浮動可以是 0（杜納斯沒有浮動），只擋負數
const intervalFloat = computed({
  get: () => params.value.intervalFloat ?? 0,
  set: (v: number) => Number.isFinite(v) && v >= 0 && patchOverride({ intervalFloat: v }),
})

const isOverridden = computed(() => !!overrides.value[boss.value.id])
function resetBossParams() {
  const next = { ...overrides.value }
  delete next[boss.value.id]
  overrides.value = next
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
// 引信：邊框剩下的比例。pathLength=100 把周長正規化，這裡直接給百分比
const fuseLeft = computed(() => 100 - progress.value)
// 到下次反盾為止還能打幾秒。跟本段倒數一樣時不顯示——那是同一個數字
const attackTotal = computed(() =>
  Math.ceil(attackRemaining(state.value, params.value, now.value)),
)
// 可以打到什麼時候。這是固定的一刻（由階段結束時間推出），不隨 now 抖動
const attackEnd = computed(() => attackEndAt(state.value, params.value))
const PHASE_META = {
  idle: { cls: 'phase-idle', title: '待機', note: '開戰看到反盾出現時按「反盾開始」' },
  shield: { cls: 'phase-shield', title: '反盾中 ⛔ 禁止輸出', note: '' },
  interval: { cls: 'phase-attack', title: '間隔 ⚔ 可輸出', note: '' },
  blocked: { cls: 'phase-attack', title: '反盾阻止成功 ⚔ 可輸出', note: '' },
} as const
const meta = computed(() => PHASE_META[state.value.phase])
// 王的耐性／技能冷卻剩餘（純提醒，不阻擋任何按鈕）
const resistLeft = computed(() => resistRemaining(state.value, now.value))
const cooldownLeft = computed(() => cooldownRemaining(state.value, now.value))

// 魔消有效中（間隔進入有效窗、尚未標記、且王的耐性已退）：色塊閃爍提醒。
// 耐性還在時放了也擋不掉，閃爍催人去放會誤導。
const dispelActive = computed(() => {
  const s = state.value
  if (s.phase !== 'interval' || s.dispelValid || resistLeft.value > 0) return false
  return (now.value - s.phaseStart) / 1000 >= dispelWindowStart(params.value)
})
const intervalNote = computed(() => {
  const s = state.value
  if (s.phase !== 'interval') return ''
  if (s.dispelValid) return '✓ 魔消已標記——間隔結束反盾會被擋掉（繼續輸出）'
  if (resistLeft.value > 0) return `王的耐性中 ${resistLeft.value} 秒——這段時間魔消擋不掉反盾`
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

// ---- 遊戲計時器對齊（與女皇面板共用同一個對齊點）----
const gameInput = ref('')
const anchor = anchorRef()
function applyAnchor() {
  setAnchor(gameInput.value, Date.now())
}
function calibrate(deltaSec: number) {
  calibrateAnchor(deltaSec)
}
function fmtEventTime(at: number): string {
  return fmtTime(at, now.value)
}
// 對齊後的當前遊戲計時，用來跟遊戲畫面核對
const clockNow = computed(() => gameClock(now.value))
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
          ? '反盾阻止成功（可輸出）'
          : '反盾開始（禁止輸出）'
        : '間隔（可輸出）'
  return { label, time: fmtEventTime(phaseEnd(s, params.value)) }
})
</script>

<template>
  <section>
    <div class="page-head">
      <h2>機制計算機</h2>
      <div class="boss-tabs" role="group" aria-label="選擇王">
        <button v-for="b in bosses" :key="b.id" type="button" class="btn btn-sm boss-chip"
          :class="{ 'boss-on': b.id === bossId }" :disabled="locked" :aria-pressed="b.id === bossId"
          @click="selectBoss(b.id)">{{ b.name }}</button>
      </div>
      <span v-if="locked" class="muted lock-hint">計時中無法換王——請先按「重置」</span>
      <div class="spacer" />
      <button v-if="canPip" type="button" class="btn btn-sm" @click="togglePip">
        {{ pipBody ? '關閉子母畫面' : '子母畫面' }}
      </button>
      <label class="sound-toggle">
        <input v-model="soundOn" type="checkbox" /> 聲音提醒
      </label>
    </div>

    <Teleport :to="pipBody" :disabled="!pipBody">
    <HpCapture />

    <HpThresholdBoard v-if="hpBoss" :boss="hpBoss" :sound-on="soundOn" />

    <CycleBoard v-else-if="cycleBoss" :boss="cycleBoss" :sound-on="soundOn" @running="cycleRunning = $event">
      <!-- 小視窗看不到下面的事件表，把遊戲計時放進重置那一列 -->
      <template #lead>
        <AnchorRow v-if="pipBody" />
      </template>
    </CycleBoard>

    <template v-else>
    <!-- 小視窗看不到下面的事件表，遊戲計時要自己帶一份過去 -->
    <div v-if="pipBody" class="card pip-clock"><AnchorRow /></div>

    <!-- 大字現況 -->
    <div class="card phase-panel" :class="[meta.cls, { 'dispel-active': dispelActive, 'flash-early': earlyFlash }]">
      <!-- 引信：邊框繞著色塊燒短，燒完就是本階段結束 -->
      <svg v-if="state.phase !== 'idle'" class="fuse" aria-hidden="true">
        <rect pathLength="100" :stroke-dasharray="`${fuseLeft} 100`" />
      </svg>
      <div class="phase-title">{{ meta.title }}</div>
      <!-- 可輸出時：主角是「可以打到什麼時候」；本段倒數退成旁邊的小字 -->
      <template v-if="attackEnd != null">
        <div class="until-label">可輸出到</div>
        <div class="phase-remaining until-time">{{ fmtEventTime(attackEnd) }}</div>
        <div class="remaining-row seg-row">
          <button type="button" class="btn btn-sm nudge" title="當前階段減 1 秒"
            @click="onNudge(-1)">−1s</button>
          <span class="seg-remaining">本段 {{ remaining }}s</span>
          <button type="button" class="btn btn-sm nudge" title="當前階段加 1 秒"
            @click="onNudge(1)">＋1s</button>
        </div>
      </template>
      <!-- 反盾中沒得打，主角就是這段還要忍多久 -->
      <div v-else-if="state.phase !== 'idle'" class="remaining-row">
        <button type="button" class="btn btn-sm nudge" title="當前階段減 1 秒"
          @click="onNudge(-1)">−1s</button>
        <div class="phase-remaining">{{ remaining }}<span class="unit">s</span></div>
        <button type="button" class="btn btn-sm nudge" title="當前階段加 1 秒"
          @click="onNudge(1)">＋1s</button>
      </div>
      <div v-if="state.phase !== 'idle'" class="phase-bar"><div class="phase-bar-fill" :style="{ width: progress + '%' }" /></div>
      <div v-if="nextPhaseInfo" class="phase-next">
        下一階段：{{ nextPhaseInfo.label }} <span class="next-time">{{ nextPhaseInfo.time }}</span>
      </div>
      <div v-if="meta.note || intervalNote" class="phase-note">{{ intervalNote || meta.note }}</div>
      <div v-if="cooldownLeft > 0" class="phase-sub muted">技能冷卻 {{ cooldownLeft }} 秒</div>
      <div v-if="dispelFeedback" class="dispel-feedback" :class="dispelFeedback">
        {{ dispelFeedback === 'valid' ? '✓ 有效魔消' : '✕ 無效魔消（太早，反盾重施前就失效了）' }}
      </div>
    </div>

    <!-- 操作 -->
    <div class="card">
      <div class="controls">
        <button type="button" class="btn ctrl ctrl-shield" @click="onStartShield">反盾開始</button>
        <button type="button" class="btn ctrl ctrl-interval" @click="onStartInterval">反盾結束</button>
        <button type="button" class="btn ctrl ctrl-interval" @click="onStartBlocked">反盾阻止成功</button>
        <button type="button" class="btn btn-primary ctrl" :disabled="state.phase !== 'interval'"
          @click="onDispel">魔消成功</button>
        <button type="button" class="btn btn-ghost ctrl" @click="onReset">重置</button>
      </div>
      <p class="muted ctrl-hint">
        反盾持續是標準 {{ params.shieldDuration }} 秒；間隔是「最少」{{ params.interval }} 秒，
        <template v-if="params.intervalFloat">最晚可能拖到 {{ params.interval + params.intervalFloat }} 秒才重施——</template>
        <template v-else>——</template>
        倒數到 0 會自動推進，看到遊戲內實況時按上方按鈕即可隨時校正。
        魔消要在間隔第 {{ dispelWindowStart(params) }} 秒之後放才撐得到反盾重施；
        對王有 {{ DISPEL_RESIST }} 秒耐性、技能本身 {{ DISPEL_COOLDOWN }} 秒冷卻。
      </p>
    </div>
    </template>
    </Teleport>

    <!-- 時間表留在主視窗：子母畫面塞不下，大畫面才看得到完整的接下來 -->
    <CycleEvents v-if="cycleBoss" :boss="cycleBoss" />

    <template v-if="!cycleBoss && !hpBoss">

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
            <span class="game-clock">{{ clockNow }}</span>
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
      <fieldset class="param-group">
        <legend>{{ boss.name }}</legend>
        <div class="param-grid">
          <label class="field">
            <span class="field-label">反盾持續（秒）</span>
            <input v-model.number="shieldDuration" type="number" min="1" />
          </label>
          <label class="field">
            <span class="field-label">反盾間隔（秒）</span>
            <input v-model.number="intervalSeconds" type="number" min="1" />
          </label>
          <label class="field">
            <span class="field-label">間隔浮動（秒）</span>
            <input v-model.number="intervalFloat" type="number" min="0" />
          </label>
        </div>
        <button v-if="isOverridden" type="button" class="btn btn-sm btn-ghost reset-boss"
          @click="resetBossParams">還原{{ boss.name }}預設</button>
      </fieldset>
      <fieldset class="param-group">
        <legend>我的技能</legend>
        <div class="param-grid">
          <label class="field">
            <span class="field-label">魔消持續（秒）</span>
            <input v-model.number="dispelDuration" type="number" min="1" />
          </label>
        </div>
      </fieldset>
    </div>
    </template>
  </section>
</template>

<style scoped>
.page-head { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.page-head h2 { margin: 0; font-size: 20px; font-weight: 680; }
.page-head .spacer { flex: 1; }
.sound-toggle { display: flex; align-items: center; gap: 6px; font-size: 13.5px; color: var(--text-muted); cursor: pointer; }

.boss-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.boss-chip { border-radius: 999px; }
.boss-on, .boss-on:hover { background: var(--primary); border-color: var(--primary); color: #fff; }
.boss-on:hover { background: var(--primary-hover); border-color: var(--primary-hover); }
.boss-chip:disabled, .boss-chip:disabled:hover {
  cursor: not-allowed; background: var(--surface-2); border-color: var(--border); color: var(--text-muted);
}
/* 選中的王即使鎖住也維持實心——變灰會像整組失效 */
.boss-on:disabled, .boss-on:disabled:hover {
  background: var(--primary); border-color: var(--primary); color: #fff; opacity: .8;
}
.lock-hint { font-size: 12.5px; }

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
.phase-next { margin-top: 12px; font-size: 15.5px; font-weight: 600; }
.phase-next .next-time {
  font-family: var(--mono); font-variant-numeric: tabular-nums; font-weight: 750;
  padding: 2px 8px; border-radius: 6px; background: rgba(0, 0, 0, .07); margin-left: 4px;
}
.phase-note { margin-top: 12px; font-size: 14.5px; font-weight: 550; }
.phase-sub { margin-top: 4px; font-size: 12.5px; }
.attack-total { font-weight: 650; color: var(--success); }
.until-label { margin-top: 6px; font-size: 13px; font-weight: 650; color: var(--success); }
.until-time { font-family: var(--mono); color: var(--success); letter-spacing: -1px; }
.seg-row { margin-top: 6px; }
.seg-remaining {
  font-size: 13.5px; font-weight: 650; font-variant-numeric: tabular-nums;
  padding: 2px 8px; border-radius: 6px; background: rgba(0, 0, 0, .07);
}
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

.event-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.event { display: flex; gap: 12px; align-items: center; padding: 7px 12px; border-radius: var(--radius-sm); font-size: 14.5px; }
.ev-ok { background: var(--success-soft); color: var(--success); }
.ev-warn { background: var(--danger-soft); color: var(--danger); font-weight: 650; }
.ev-time { font-family: var(--mono); font-variant-numeric: tabular-nums; min-width: 64px; font-weight: 650; flex: none; }
.ev-label { white-space: nowrap; }

.param-group {
  min-width: 0; margin: 0 0 12px; padding: 6px 14px 14px;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
}
.param-group:last-child { margin-bottom: 0; }
.param-group legend { padding: 0 6px; font-size: 12.5px; font-weight: 650; color: var(--text-muted); }
.reset-boss { margin-top: 12px; color: var(--text-muted); }

.param-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field-label { font-size: 12.5px; font-weight: 550; color: var(--text-muted); white-space: nowrap; }

/* 窄螢幕：標題列拆成三行（標題＋聲音／王選單／鎖住提示），操作鈕兩欄 */
@media (max-width: 720px) {
  .page-head { flex-wrap: wrap; gap: 8px 10px; }
  .boss-tabs { order: 3; width: 100%; }
  .lock-hint { order: 4; width: 100%; }
  .ctrl { min-width: 104px; padding: 12px 10px; }
  .anchor-row { flex-wrap: wrap; }
  .anchor-input { width: 118px; }
  .phase-remaining { font-size: 56px; }
}
</style>
