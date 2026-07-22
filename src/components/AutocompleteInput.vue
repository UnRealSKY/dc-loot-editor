<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  modelValue: string
  suggestions: string[]
  placeholder?: string
  labelFor?: (value: string) => string  // 下拉顯示文字（如別名），選取仍存原 value
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [value: string]
}>()

const open = ref(false)

function label(s: string): string {
  return props.labelFor ? props.labelFor(s) : s
}

const filtered = computed(() => {
  const q = props.modelValue.trim()
  if (!q) return props.suggestions.slice(0, 20)
  // 以 value 前綴或顯示文字（別名）包含來過濾
  return props.suggestions
    .filter((s) => s.startsWith(q) || label(s).includes(q))
    .slice(0, 20)
})

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
  open.value = true
}

function choose(s: string) {
  emit('update:modelValue', s)
  emit('select', s)
  open.value = false
}
</script>

<template>
  <div class="autocomplete">
    <input
      :value="modelValue"
      :placeholder="placeholder"
      @input="onInput"
      @focus="open = true"
      @blur="open = false"
    />
    <ul v-if="open && filtered.length" class="suggestions">
      <li
        v-for="s in filtered"
        :key="s"
        class="suggestion"
        @mousedown.prevent="choose(s)"
      >
        {{ label(s) }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.autocomplete { position: relative; }
.suggestions {
  position: absolute; z-index: 40; left: 0; right: 0; top: calc(100% + 4px);
  margin: 0; padding: 4px; list-style: none;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-sm); box-shadow: var(--shadow-lg);
  max-height: 220px; overflow-y: auto; min-width: 140px;
}
.suggestion { padding: 6px 10px; cursor: pointer; border-radius: 6px; font-size: 14px; white-space: nowrap; }
.suggestion:hover { background: var(--primary-soft); color: var(--primary-hover); }
</style>
