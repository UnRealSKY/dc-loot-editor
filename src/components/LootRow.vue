<script setup lang="ts">
import { computed } from 'vue'
import type { LootItem, LootStatus } from '../types'
import { itemNet } from '../calc/distribution'
import { useHistory } from '../store/history'
import AutocompleteInput from './AutocompleteInput.vue'

const props = defineProps<{ modelValue: LootItem }>()
const emit = defineEmits<{ 'update:modelValue': [v: LootItem]; remove: [] }>()

const history = useHistory()
const STATUS_CYCLE: LootStatus[] = ['ok', 'cart', 'struck']
const STATUS_LABEL: Record<LootStatus, string> = { ok: ':ok:', cart: ':shopping_cart:', struck: '劃線' }

function patch(part: Partial<LootItem>) {
  emit('update:modelValue', { ...props.modelValue, ...part })
}
function cycleStatus() {
  const i = STATUS_CYCLE.indexOf(props.modelValue.status)
  patch({ status: STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length] })
}
function onNameSelect(name: string) {
  const s = history.priceSuggestions(name)
  if (s.length) patch({ name, unitPrice: s[0].price })
}
const net = computed(() => itemNet(props.modelValue))
const priceHints = computed(() =>
  history.priceSuggestions(props.modelValue.name).map((p) => `${p.price}（${p.date}）`),
)
</script>

<template>
  <tr>
    <td><button type="button" @click="cycleStatus">{{ STATUS_LABEL[modelValue.status] }}</button></td>
    <td>
      <AutocompleteInput
        :model-value="modelValue.name"
        :suggestions="history.itemNames.value"
        placeholder="品名"
        @update:model-value="patch({ name: $event })"
        @select="onNameSelect"
      />
    </td>
    <td><input type="number" :value="modelValue.unitPrice ?? ''" @input="patch({ unitPrice: ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value) })" style="width:6em" autocomplete="off" /></td>
    <td><input type="number" :value="modelValue.qty" @input="patch({ qty: Number(($event.target as HTMLInputElement).value) })" style="width:4em" /></td>
    <td><input type="number" :value="modelValue.scissorUnitPrice ?? ''" placeholder="剪刀價" @input="patch({ scissorUnitPrice: Number(($event.target as HTMLInputElement).value) || undefined })" style="width:5em" /></td>
    <td><input type="number" :value="modelValue.scissorCount ?? ''" placeholder="剪刀數" @input="patch({ scissorCount: Number(($event.target as HTMLInputElement).value) || undefined })" style="width:4em" /></td>
    <td><input :value="modelValue.note ?? ''" placeholder="註解" @input="patch({ note: ($event.target as HTMLInputElement).value || undefined })" /></td>
    <td class="net">{{ net }}</td>
    <td><button type="button" @click="emit('remove')">✕</button></td>
    <td class="hints">{{ priceHints.join(' / ') }}</td>
  </tr>
</template>

<style scoped>
.net { text-align: right; font-variant-numeric: tabular-nums; }
.hints { color: #999; font-size: 0.75em; }
</style>
