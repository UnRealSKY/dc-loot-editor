<script setup lang="ts">
import type { Stream } from '../types'

const props = defineProps<{ modelValue: Stream[] }>()
const emit = defineEmits<{ 'update:modelValue': [v: Stream[]] }>()

function updateAt(i: number, part: Partial<Stream>) {
  const next = [...props.modelValue]
  next[i] = { ...next[i], ...part }
  emit('update:modelValue', next)
}
function removeAt(i: number) {
  emit('update:modelValue', props.modelValue.filter((_, idx) => idx !== i))
}
function add() {
  emit('update:modelValue', [...props.modelValue, { label: '', url: '', id: crypto.randomUUID() }])
}
</script>

<template>
  <div class="card">
    <div class="section-head">
      <h3>直播檔</h3>
      <span class="count">{{ modelValue.length }} 筆</span>
      <div class="spacer" />
      <button type="button" class="btn btn-sm" @click="add">＋ 新增直播檔</button>
    </div>
    <p v-if="!modelValue.length" class="muted">尚無直播檔。</p>
    <ul v-else class="stream-list">
      <li v-for="(s, i) in modelValue" :key="s.id" class="stream-row">
        <input class="stream-label" :value="s.label" placeholder="描述（例：第一場混炎）"
          @input="updateAt(i, { label: ($event.target as HTMLInputElement).value })" />
        <input class="stream-url" :value="s.url" placeholder="https://..."
          @input="updateAt(i, { url: ($event.target as HTMLInputElement).value })" />
        <button type="button" class="btn btn-icon btn-danger" title="移除" @click="removeAt(i)">✕</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.stream-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.stream-row { display: flex; gap: 8px; align-items: center; }
.stream-label { flex: 0 0 200px; max-width: 200px; }
.stream-url { flex: 1; }
</style>
