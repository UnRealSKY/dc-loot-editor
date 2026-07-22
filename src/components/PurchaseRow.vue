<script setup lang="ts">
import { computed } from 'vue'
import type { Purchase } from '../types'
import { purchaseValue } from '../calc/distribution'
import { useHistory } from '../store/history'
import { displayName } from '../store/roster'
import AutocompleteInput from './AutocompleteInput.vue'

const props = defineProps<{ modelValue: Purchase; memberHandles: string[] }>()
const emit = defineEmits<{ 'update:modelValue': [v: Purchase]; remove: [] }>()
const history = useHistory()

function patch(part: Partial<Purchase>) {
  emit('update:modelValue', { ...props.modelValue, ...part })
}
const value = computed(() => purchaseValue(props.modelValue))
</script>

<template>
  <tr>
    <td class="buyer-cell">
      <select :value="modelValue.buyer"
        @change="patch({ buyer: ($event.target as HTMLSelectElement).value })">
        <option value="">選擇團員…</option>
        <option v-for="h in memberHandles" :key="h" :value="h">{{ displayName(h) }}</option>
        <option v-if="modelValue.buyer && !memberHandles.includes(modelValue.buyer)" :value="modelValue.buyer">
          {{ displayName(modelValue.buyer) }}（非團員）
        </option>
      </select>
    </td>
    <td class="name-cell">
      <AutocompleteInput :model-value="modelValue.name" :suggestions="history.itemNames.value"
        placeholder="品名" @update:model-value="patch({ name: $event })" />
    </td>
    <td><input type="number" class="cell-num" :value="modelValue.unitPrice" placeholder="單價"
      @input="patch({ unitPrice: Number(($event.target as HTMLInputElement).value) })" /></td>
    <td><input type="number" class="cell-num sm" :value="modelValue.qty"
      @input="patch({ qty: Number(($event.target as HTMLInputElement).value) })" /></td>
    <td class="num val">{{ value }}</td>
    <td><button type="button" class="btn btn-icon btn-danger" title="移除" @click="emit('remove')">✕</button></td>
  </tr>
</template>

<style scoped>
.buyer-cell { min-width: 150px; }
.name-cell { min-width: 140px; }
.cell-num { width: 6em; }
.cell-num.sm { width: 4.5em; }
.val { font-weight: 650; white-space: nowrap; }
</style>
