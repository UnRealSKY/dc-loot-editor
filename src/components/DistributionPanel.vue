<script setup lang="ts">
import { computed } from 'vue'
import type { LootRecord } from '../types'
import { netTotal, computeIncomes } from '../calc/distribution'

const props = defineProps<{ record: LootRecord }>()

const total = computed(() => netTotal(props.record.lootItems))
const baseDisplay = computed(() =>
  Math.round(props.record.memberCount > 0 ? total.value / props.record.memberCount : 0),
)
const rows = computed(() =>
  computeIncomes(props.record).map((i) => ({ ...i, rounded: Math.round(i.income) })),
)
</script>

<template>
  <div class="card dist">
    <div class="section-head"><h3>分配</h3></div>

    <div class="summary">
      <div class="stat">
        <span class="stat-label">總表淨額</span>
        <span class="stat-value">{{ total }}</span>
      </div>
      <div class="stat-op">÷</div>
      <div class="stat">
        <span class="stat-label">人數</span>
        <span class="stat-value">{{ record.memberCount }}</span>
      </div>
      <div class="stat-op">=</div>
      <div class="stat">
        <span class="stat-label">每人基本</span>
        <span class="stat-value accent">{{ baseDisplay }}</span>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead><tr><th>團員</th><th class="num">基本</th><th class="num">他人內購/(N-1)</th><th class="num">自己內購</th><th class="num">收入</th></tr></thead>
        <tbody>
          <tr v-for="r in rows" :key="r.handle">
            <td class="handle">{{ r.handle || '—' }}</td>
            <td class="num">{{ baseDisplay }}</td>
            <td class="num plus">{{ record.memberCount > 1 ? '+' + Math.round(r.others / (record.memberCount - 1)) : 0 }}</td>
            <td class="num minus">{{ r.own ? '−' + r.own : 0 }}</td>
            <td class="num income">{{ r.rounded }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.summary {
  display: flex; align-items: stretch; gap: 10px; flex-wrap: wrap;
  padding: 14px 16px; margin-bottom: 16px;
  background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm);
}
.stat { display: flex; flex-direction: column; gap: 2px; }
.stat-label { font-size: 11.5px; color: var(--text-muted); font-weight: 550; }
.stat-value { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
.stat-value.accent { color: var(--primary); }
.stat-op { align-self: center; color: var(--text-muted); font-size: 18px; font-weight: 600; }
.handle { font-weight: 550; }
.plus { color: var(--success); }
.minus { color: var(--danger); }
.income { font-weight: 750; font-size: 15px; }
</style>
