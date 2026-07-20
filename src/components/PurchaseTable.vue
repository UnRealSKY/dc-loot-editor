<script setup lang="ts">
import type { Purchase, Member } from '../types'
import { computed } from 'vue'
import PurchaseRow from './PurchaseRow.vue'

const props = defineProps<{ modelValue: Purchase[]; members: Member[] }>()
const emit = defineEmits<{ 'update:modelValue': [v: Purchase[]] }>()

const memberHandles = computed(() => props.members.map((m) => m.handle).filter(Boolean))

function updateAt(i: number, p: Purchase) {
  const next = [...props.modelValue]
  next[i] = p
  emit('update:modelValue', next)
}
function removeAt(i: number) {
  emit('update:modelValue', props.modelValue.filter((_, idx) => idx !== i))
}
function add() {
  emit('update:modelValue', [
    ...props.modelValue,
    { buyer: '', name: '', qty: 1, unitPrice: 0, id: crypto.randomUUID() },
  ])
}
</script>

<template>
  <div>
    <h3>內購區</h3>
    <table>
      <thead><tr><th>買家</th><th>品名</th><th>單價</th><th>數量</th><th>金額</th><th></th></tr></thead>
      <tbody>
        <PurchaseRow
          v-for="(p, i) in modelValue"
          :key="p.id"
          :model-value="p"
          :member-handles="memberHandles"
          @update:model-value="updateAt(i, $event)"
          @remove="removeAt(i)"
        />
      </tbody>
    </table>
    <button type="button" @click="add">＋ 新增內購</button>
  </div>
</template>
