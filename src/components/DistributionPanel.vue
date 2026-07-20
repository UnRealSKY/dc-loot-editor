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
  <div class="dist">
    <h3>分配</h3>
    <p>總共: {{ total }} / {{ record.memberCount }} = {{ baseDisplay }}</p>
    <table>
      <thead><tr><th>團員</th><th>基本</th><th>他人內購/(N-1)</th><th>自己內購</th><th>收入</th></tr></thead>
      <tbody>
        <tr v-for="r in rows" :key="r.handle">
          <td>{{ r.handle }}</td>
          <td class="num">{{ baseDisplay }}</td>
          <td class="num">{{ record.memberCount > 1 ? Math.round(r.others / (record.memberCount - 1)) : 0 }}</td>
          <td class="num">{{ r.own }}</td>
          <td class="num strong">{{ r.rounded }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.num { text-align: right; font-variant-numeric: tabular-nums; }
.strong { font-weight: bold; }
</style>
