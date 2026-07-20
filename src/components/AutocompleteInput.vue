<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  modelValue: string
  suggestions: string[]
  placeholder?: string
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [value: string]
}>()

const open = ref(false)
const query = ref(props.modelValue)

watch(
  () => props.modelValue,
  (v) => {
    query.value = v
  },
)

const filtered = computed(() => {
  const q = query.value.trim()
  if (!q) return props.suggestions.slice(0, 20)
  return props.suggestions.filter((s) => s.startsWith(q)).slice(0, 20)
})

function onInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  query.value = value
  open.value = true
  if (value !== props.modelValue) {
    emit('update:modelValue', value)
  }
}

function choose(s: string) {
  query.value = s
  emit('update:modelValue', s)
  emit('select', s)
  open.value = false
}
</script>

<template>
  <div class="autocomplete">
    <input
      :value="query"
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
        {{ s }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.autocomplete { position: relative; }
.suggestions {
  position: absolute; z-index: 10; left: 0; right: 0; margin: 0; padding: 0;
  list-style: none; background: #fff; border: 1px solid #ccc; max-height: 200px; overflow-y: auto;
}
.suggestion { padding: 4px 8px; cursor: pointer; }
.suggestion:hover { background: #eef; }
</style>
