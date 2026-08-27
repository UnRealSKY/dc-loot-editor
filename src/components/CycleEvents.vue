<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { CycleBoss } from '../shield/bosses'
import { upcomingCycleEvents } from '../shield/cycle'
import { cycleClocks } from '../shield/cycleClocks'
import { fmtTime } from '../shield/anchor'
import AnchorRow from './AnchorRow.vue'

// 「接下來」留在主視窗——子母畫面只搬面板，大畫面才有空間看完整的時間表
const props = defineProps<{ boss: CycleBoss }>()

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 250)))
onBeforeUnmount(() => clearInterval(timer))

const events = computed(() => upcomingCycleEvents(props.boss.cycles, cycleClocks(), now.value, 6))
</script>

<template>
  <div class="card events-card">
    <div class="section-head">
      <h3>接下來</h3>
      <div class="spacer" />
      <AnchorRow />
    </div>
    <p v-if="!events.length" class="muted">按下任何一個機制的「觸發」後，這裡會列出接下來的時間。</p>
    <ul v-else class="event-list">
      <li v-for="(e, i) in events" :key="i" class="event" :class="i === 0 ? 'ev-next' : 'ev-later'">
        <span class="ev-time">{{ fmtTime(e.at, now) }}</span>
        <span class="ev-label">{{ e.name }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
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
