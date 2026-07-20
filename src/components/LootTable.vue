<script setup lang="ts">
import type { LootItem } from '../types'
import LootRow from './LootRow.vue'

const props = defineProps<{ modelValue: LootItem[] }>()
const emit = defineEmits<{ 'update:modelValue': [v: LootItem[]] }>()

function updateAt(i: number, item: LootItem) {
  const next = [...props.modelValue]
  next[i] = item
  emit('update:modelValue', next)
}
function removeAt(i: number) {
  emit('update:modelValue', props.modelValue.filter((_, idx) => idx !== i))
}
function add() {
  emit('update:modelValue', [
    ...props.modelValue,
    { status: 'ok', name: '', qty: 1, unitPrice: null },
  ])
}
</script>

<template>
  <div>
    <h3>總表</h3>
    <table>
      <thead>
        <tr><th>狀態</th><th>品名</th><th>數量</th><th>單價</th><th>剪數</th><th>剪價</th><th>註解</th><th>淨額</th><th></th><th>歷史</th></tr>
      </thead>
      <tbody>
        <LootRow
          v-for="(it, i) in modelValue"
          :key="i"
          :model-value="it"
          @update:model-value="updateAt(i, $event)"
          @remove="removeAt(i)"
        />
      </tbody>
    </table>
    <button type="button" @click="add">＋ 新增項目</button>
  </div>
</template>
