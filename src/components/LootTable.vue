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
    { status: 'ok', name: '', qty: 1, unitPrice: null, id: crypto.randomUUID() },
  ])
}
</script>

<template>
  <div class="card">
    <div class="section-head">
      <h3>總表</h3>
      <span class="count">{{ modelValue.length }} 項</span>
      <div class="spacer" />
      <button type="button" class="btn btn-sm" @click="add">＋ 新增項目</button>
    </div>
    <p v-if="!modelValue.length" class="muted">尚無項目。</p>
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr><th>狀態</th><th>品名</th><th class="num">單價</th><th class="num">數量</th><th class="num">剪刀價</th><th class="num">剪刀數</th><th>註解</th><th class="num">淨額</th><th></th></tr>
        </thead>
        <tbody>
          <LootRow
            v-for="(it, i) in modelValue"
            :key="it.id"
            :model-value="it"
            @update:model-value="updateAt(i, $event)"
            @remove="removeAt(i)"
          />
        </tbody>
      </table>
    </div>
  </div>
</template>
