<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { HpBoss } from '../shield/bosses'
import { hpNow } from '../hp/current'
import { crossedThresholds, thresholdState } from '../hp/thresholds'
import { beep } from '../shield/sound'

const props = defineProps<{ boss: HpBoss; soundOn: boolean }>()

const hp = hpNow()
// 提前多少百分點先喊。反應時間因人而異，所以可以自己調
const LEAD_KEY = 'dc-hp-lead'
const lead = ref(Number(localStorage.getItem(LEAD_KEY)) || 5)
watch(lead, (v) => localStorage.setItem(LEAD_KEY, String(v)))

// 已經跨過的門檻，跨過的當下閃一下並響鈴
const passed = ref<number[]>([])
const justHit = ref<number | null>(null)
let hitTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => hp.percent,
  (percent, prev) => {
    if (percent == null) return
    const from = hp.prevPercent ?? prev
    if (from == null) return
    const hits = crossedThresholds(from, percent, props.boss.thresholds)
    if (!hits.length) return
    passed.value = [...new Set([...passed.value, ...hits])]
    justHit.value = hits[hits.length - 1]
    if (props.soundOn) {
      beep(1250, 140)
      beep(1250, 140, 200)
      beep(1250, 220, 400)
    }
    clearTimeout(hitTimer)
    hitTimer = setTimeout(() => (justHit.value = null), 4000)
  },
)

// 換王或重新開打就把紀錄清掉
watch(() => props.boss.id, reset, { immediate: true })
function reset() {
  passed.value = []
  justHit.value = null
}

const state = computed(() =>
  thresholdState(hp.percent ?? 100, props.boss.thresholds, lead.value, justHit.value != null),
)
const percentText = computed(() => (hp.percent == null ? null : hp.percent.toFixed(1)))
// 依目前狀態決定整塊面板的顏色，跟其他機制面板同一組語意
const panelClass = computed(() => {
  if (hp.percent == null) return 'phase-idle'
  if (state.value.level === 'hit') return 'phase-shield'
  return state.value.level === 'near' ? 'phase-warn' : 'phase-attack'
})
// 還要打掉多少才會碰到下一個門檻，換算成時間（有掉血速度才算得出來）
const etaText = computed(() => {
  const gap = state.value.gap
  const dps = hp.dps
  if (gap == null || !dps || dps <= 0) return null
  const sec = Math.round(gap / dps)
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
})
</script>

<template>
  <div class="card phase-panel hp-threshold" :class="panelClass">
    <div class="phase-title">
      <template v-if="hp.percent == null">等待血量</template>
      <template v-else-if="state.level === 'hit'">{{ justHit }}% ⚠ 機制來了</template>
      <template v-else-if="state.next == null">門檻都過了</template>
      <template v-else>下一個 {{ state.next }}%</template>
    </div>

    <div class="phase-remaining gap-value">
      <template v-if="hp.percent == null">—</template>
      <template v-else-if="state.gap == null">{{ percentText }}<span class="unit">%</span></template>
      <template v-else>還有 {{ state.gap.toFixed(1) }}<span class="unit">%</span></template>
    </div>

    <div class="sub-row">
      <span v-if="percentText" class="chip chip-hp">目前 {{ percentText }}%</span>
      <span v-if="etaText" class="chip chip-eta">約 {{ etaText }} 後</span>
      <label class="lead">
        提前
        <input v-model.number="lead" type="number" min="0" max="20" step="1" />
        %
      </label>
    </div>

    <ul class="marks">
      <li v-for="t in boss.thresholds" :key="t" class="mark"
        :class="{ done: passed.includes(t), next: state.next === t }">
        {{ t }}%
      </li>
    </ul>

    <p v-if="hp.percent == null" class="muted need-capture">開啟上方的「擷取畫面」後才讀得到血量</p>
  </div>
</template>

<style scoped>
.hp-threshold { text-align: center; }
.phase-warn { background: var(--warn-soft); border-color: var(--warn); }
.phase-warn .phase-title { color: var(--warn); }
.gap-value { margin-top: 4px; }
.gap-value .unit { font-size: 20px; font-weight: 600; margin-left: 2px; }
.sub-row { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.chip-hp { background: var(--surface-2); color: var(--text-muted); }
.chip-eta { background: var(--primary-soft); color: var(--primary); }
.lead { display: flex; align-items: center; gap: 4px; font-size: 12.5px; color: var(--text-muted); white-space: nowrap; }
/* 全域的 input{width:100%} 特異性較高，用 flex-basis 才鎖得住寬度 */
.lead input { flex: 0 0 52px; text-align: right; padding: 3px 6px; font-size: 12.5px; }

.marks { list-style: none; margin: 10px 0 0; padding: 0; display: flex; justify-content: center; gap: 6px; flex-wrap: wrap; }
.mark {
  padding: 3px 12px; border-radius: 999px; font-size: 13px; font-weight: 650;
  background: var(--surface-2); color: var(--text-muted);
}
.mark.next { background: var(--warn-soft); color: var(--warn); }
.mark.done { background: var(--success-soft); color: var(--success); text-decoration: line-through; }
.need-capture { margin: 8px 0 0; font-size: 12.5px; }
</style>
