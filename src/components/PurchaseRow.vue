<script setup lang="ts">
import { computed } from 'vue'
import type { Purchase } from '../types'
import { purchaseValue } from '../calc/distribution'
import { useHistory } from '../store/history'
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
    <td>
      <AutocompleteInput :model-value="modelValue.buyer" :suggestions="memberHandles"
        placeholder="@買家" @update:model-value="patch({ buyer: $event })" />
    </td>
    <td>
      <AutocompleteInput :model-value="modelValue.name" :suggestions="history.itemNames.value"
        placeholder="品名" @update:model-value="patch({ name: $event })" />
    </td>
    <td><input type="number" :value="modelValue.qty" style="width:4em"
      @input="patch({ qty: Number(($event.target as HTMLInputElement).value) })" /></td>
    <td><input type="number" :value="modelValue.unitPrice" style="width:6em"
      @input="patch({ unitPrice: Number(($event.target as HTMLInputElement).value) })" /></td>
    <td class="val">{{ value }}</td>
    <td><button type="button" @click="emit('remove')">✕</button></td>
  </tr>
</template>

<style scoped>
.val { text-align: right; font-variant-numeric: tabular-nums; }
</style>
