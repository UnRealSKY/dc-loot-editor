<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { CycleBoss } from '../shield/bosses'
import {
  secondsLeft,
  cyclesElapsed,
  nudgeClock,
  triggerAt,
  upcomingCycleEvents,
  type CycleClock,
} from '../shield/cycle'
import { beep, ensureAudio } from '../shield/sound'
import { anchorRef, setAnchor, calibrateAnchor, fmtTime, gameClock } from '../shield/anchor'

const props = defineProps<{ boss: CycleBoss; soundOn: boolean }>()
// 有循環在跑時要鎖住換王——換走會把計時丟掉
const emit = defineEmits<{ running: [boolean] }>()

// 每個機制記一個「最近觸發時刻」，之後自己每 interval 秒接下去數
const clocks = reactive<Record<string, CycleClock>>({})
const now = ref(Date.now())
let raf: number | undefined
// 已響過鈴的輪數，每個機制一份；跨到新的一輪才響
const rung = reactive<Record<string, number>>({})

// 剩幾秒內算「快來了」：反盾面板用整段顏色表達安全與否，這裡沿用同一組語意
const WARN_SECONDS = 5

const running = computed(() => props.boss.cycles.some((c) => clocks[c.id] != null))
watch(running, (v) => emit('running', v), { immediate: true })

// 換王時清乾淨，免得下次進來看到上一隻王的殘留
watch(() => props.boss.id, resetAll)

function tick() {
  now.value = Date.now()
  for (const c of props.boss.cycles) {
    const clock = clocks[c.id]
    if (clock == null) continue
    const done = cyclesElapsed(clock, c.interval, now.value)
    if (done > (rung[c.id] ?? 0)) {
      rung[c.id] = done
      if (props.soundOn) beep(880, 200)
    }
  }
}
// 每一幀更新，倒數與引信才會連續移動
function loop() {
  tick()
  raf = requestAnimationFrame(loop)
}
onMounted(() => (raf = requestAnimationFrame(loop)))
onBeforeUnmount(() => {
  if (raf != null) cancelAnimationFrame(raf)
  emit('running', false)
})

function onTrigger(id: string) {
  // 用同一個時間戳，倒數才不會在下次更新之前先閃一個大 1 秒的數字
  const t = Date.now()
  now.value = t
  clocks[id] = triggerAt(t)
  rung[id] = 0
  ensureAudio()
}
function onNudge(id: string, deltaSec: number) {
  clocks[id] = nudgeClock(clocks[id], deltaSec)
}
function resetAll() {
  for (const c of props.boss.cycles) {
    clocks[c.id] = undefined
    rung[c.id] = 0
  }
}

function leftOf(id: string, interval: number): number | null {
  return secondsLeft(clocks[id], interval, now.value)
}
// 下次觸發的時刻。跟反盾的「可輸出到」一樣是固定的一刻，不隨 now 抖動
function nextAt(id: string, interval: number): number | null {
  const clock = clocks[id]
  if (clock == null) return null
  return clock + (cyclesElapsed(clock, interval, now.value) + 1) * interval * 1000
}
// 面板配色：未開始灰、計時中綠、剩 5 秒內轉紅（機制要來了）
function phaseClass(id: string, interval: number): string {
  const left = leftOf(id, interval)
  if (left == null) return 'phase-idle'
  return left <= WARN_SECONDS ? 'phase-shield' : 'phase-attack'
}
// 引信與進度條共用同一個比例：本輪已經過多少
function progress(id: string, interval: number): number {
  const clock = clocks[id]
  if (clock == null) return 0
  const elapsed = ((now.value - clock) / 1000) % interval
  return Math.min(100, Math.max(0, (elapsed / interval) * 100))
}

// ---- 遊戲計時對齊（與反盾面板共用同一個對齊點）----
const gameInput = ref('')
const anchor = anchorRef()
function applyAnchor() {
  setAnchor(gameInput.value, Date.now())
}
// 對齊後的當前遊戲計時，用來跟遊戲畫面核對
const clockNow = computed(() => gameClock(now.value))

const events = computed(() =>
  upcomingCycleEvents(props.boss.cycles, clocks, now.value, 6),
)
</script>

<template>
  <div class="cycle-board">
    <div class="cycle-head">
      <button type="button" class="btn btn-sm" :disabled="!running" @click="resetAll">重置</button>
    </div>
    <ul class="cycle-grid" :style="{ '--cycle-count': boss.cycles.length }">
      <li v-for="c in boss.cycles" :key="c.id" class="card phase-panel cycle-item"
        :class="phaseClass(c.id, c.interval)">
        <!-- 引信：與反盾面板同一套，邊框燒短就是本輪快到了 -->
        <svg v-if="clocks[c.id] != null" class="fuse" aria-hidden="true">
          <rect pathLength="100" :stroke-dasharray="`${100 - progress(c.id, c.interval)} 100`" />
        </svg>
        <div class="phase-title">
          {{ c.name }}<span class="cycle-interval">{{ c.interval }}s</span>
        </div>
        <template v-if="clocks[c.id] != null">
          <!-- 主角是「下次幾點觸發」，本輪剩幾秒退成小字（跟反盾面板同一個安排） -->
          <div class="until-label">下次</div>
          <div class="phase-remaining until-time">{{ fmtTime(nextAt(c.id, c.interval)!, now) }}</div>
          <div class="remaining-row seg-row">
            <button type="button" class="btn btn-sm nudge" title="減 1 秒"
              @click="onNudge(c.id, -1)">−1s</button>
            <span class="seg-remaining">{{ leftOf(c.id, c.interval) }}s</span>
            <button type="button" class="btn btn-sm nudge" title="加 1 秒"
              @click="onNudge(c.id, 1)">＋1s</button>
          </div>
        </template>
        <div v-else class="phase-remaining not-started">—</div>
        <div class="phase-bar">
          <div class="phase-bar-fill" :style="{ width: progress(c.id, c.interval) + '%' }" />
        </div>
        <button type="button" class="btn ctrl trigger" @click="onTrigger(c.id)">觸發</button>
      </li>
    </ul>

    <!-- 接下來（與反盾面板同一套：對齊遊戲計時後就顯示遊戲時間）-->
    <div class="card events-card">
      <div class="section-head">
        <h3>接下來</h3>
        <div class="spacer" />
        <div class="anchor-row">
          <input v-model="gameInput" class="anchor-input" placeholder="遊戲計時 mm:ss" spellcheck="false"
            @keyup.enter="applyAnchor" />
          <button type="button" class="btn btn-sm" @click="applyAnchor">對齊</button>
          <template v-if="anchor">
            <button type="button" class="btn btn-sm" title="校準 -1 秒" @click="calibrateAnchor(-1)">−1s</button>
            <button type="button" class="btn btn-sm" title="校準 +1 秒" @click="calibrateAnchor(1)">＋1s</button>
            <span class="game-clock">{{ clockNow }}</span>
          </template>
        </div>
      </div>
      <p v-if="!events.length" class="muted">按下任何一個機制的「觸發」後，這裡會列出接下來的時間。</p>
      <ul v-else class="event-list">
        <li v-for="(e, i) in events" :key="i" class="event" :class="i === 0 ? 'ev-next' : 'ev-later'">
          <span class="ev-time">{{ fmtTime(e.at, now) }}</span>
          <span class="ev-label">{{ e.name }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.cycle-head { display: flex; justify-content: flex-end; margin-bottom: 8px; }
.cycle-grid {
  list-style: none; margin: 0; padding: 0;
  display: grid; gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}
/* 寬螢幕一列擺完，不管有幾個機制 */
@media (min-width: 860px) {
  .cycle-grid { grid-template-columns: repeat(var(--cycle-count), minmax(0, 1fr)); }
}
/* 反盾面板是整頁一塊，這裡一列五塊，字級與留白等比縮小 */
.cycle-item { padding: 14px 10px; }
.cycle-item .phase-title { font-size: 16px; display: flex; align-items: baseline; justify-content: center; gap: 5px; }
.cycle-interval { font-size: 12px; font-weight: 500; color: var(--text-muted); }
.until-label { margin-top: 6px; font-size: 12px; font-weight: 650; color: var(--text-muted); }
.cycle-item .phase-remaining { font-size: 30px; }
.until-time { font-family: var(--mono); letter-spacing: -1px; }
.cycle-item .remaining-row { gap: 4px; margin-top: 6px; }
.cycle-item .nudge { padding: 3px 6px; font-size: 11.5px; }
.seg-remaining {
  font-size: 12.5px; font-weight: 650; font-variant-numeric: tabular-nums;
  padding: 2px 6px; border-radius: 6px; background: rgba(0, 0, 0, .07);
}
.cycle-item .phase-bar { margin-top: 10px; }
.not-started { margin-top: 4px; color: var(--text-muted); }
.trigger { margin-top: 10px; width: 100%; padding: 8px 10px; font-size: 14px; font-weight: 650; }

.events-card { margin-top: 12px; }
.section-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.section-head h3 { margin: 0; }
.section-head .spacer { flex: 1; }
.event-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.event { display: flex; gap: 12px; align-items: center; padding: 7px 12px; border-radius: var(--radius-sm); font-size: 14.5px; }
/* 只有「下一個要來的」標紅，其餘中性——整排都紅就等於沒有重點 */
.ev-next { background: var(--danger-soft); color: var(--danger); font-weight: 650; }
.ev-later { background: var(--surface-2); color: var(--text); }
.ev-time { font-family: var(--mono); font-variant-numeric: tabular-nums; min-width: 64px; font-weight: 650; flex: none; }
.ev-label { white-space: nowrap; }
</style>
