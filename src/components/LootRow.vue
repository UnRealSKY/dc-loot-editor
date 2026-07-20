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
const STATUS_META: Record<LootStatus, { cls: string; label: string }> = {
  ok: { cls: 'chip-ok', label: '✓ 出售' },
  cart: { cls: 'chip-cart', label: '🛒 待售' },
  struck: { cls: 'chip-struck', label: '不計入' },
}

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
    <td>
      <button type="button" class="chip" :class="STATUS_META[modelValue.status].cls" @click="cycleStatus">
        {{ STATUS_META[modelValue.status].label }}
      </button>
    </td>
    <td class="name-cell">
      <AutocompleteInput
        :model-value="modelValue.name"
        :suggestions="history.itemNames.value"
        placeholder="品名"
        @update:model-value="patch({ name: $event })"
        @select="onNameSelect"
      />
    </td>
    <td>
      <input type="number" class="cell-num" :value="modelValue.unitPrice ?? ''"
        :title="priceHints.length ? '歷史：' + priceHints.join(' / ') : ''"
        placeholder="單價" autocomplete="off"
        @input="patch({ unitPrice: ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value) })" />
    </td>
    <td>
      <input type="number" class="cell-num sm" :value="modelValue.qty"
        @input="patch({ qty: Number(($event.target as HTMLInputElement).value) })" />
    </td>
    <td>
      <input type="number" class="cell-num" :value="modelValue.scissorUnitPrice ?? ''" placeholder="剪刀價"
        @input="patch({ scissorUnitPrice: Number(($event.target as HTMLInputElement).value) || undefined })" />
    </td>
    <td>
      <input type="number" class="cell-num sm" :value="modelValue.scissorCount ?? ''" placeholder="剪刀數"
        @input="patch({ scissorCount: Number(($event.target as HTMLInputElement).value) || undefined })" />
    </td>
    <td>
      <input class="cell-note" :value="modelValue.note ?? ''" placeholder="註解"
        @input="patch({ note: ($event.target as HTMLInputElement).value || undefined })" />
    </td>
    <td class="num net">{{ net }}</td>
    <td><button type="button" class="btn btn-icon btn-danger" title="移除" @click="emit('remove')">✕</button></td>
  </tr>
</template>

<style scoped>
.name-cell { min-width: 150px; }
.cell-num { width: 6em; }
.cell-num.sm { width: 4.5em; }
.cell-note { min-width: 110px; }
.net { font-weight: 650; white-space: nowrap; }
</style>
