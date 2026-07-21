<script setup lang="ts">
import { ref, watch } from 'vue'
import { parse } from '../format/parse'
import type { LootRecord } from '../types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; imported: [v: LootRecord] }>()

const text = ref('')
const error = ref('')

function hasContent(r: LootRecord): boolean {
  return !!(
    r.boss ||
    r.lootItems.length ||
    r.members.length ||
    r.purchases.length ||
    r.streams?.length
  )
}

function doImport() {
  error.value = ''
  if (!text.value.trim()) {
    error.value = '請先貼上內容'
    return
  }
  let parsed: LootRecord
  try {
    parsed = parse(text.value)
  } catch (e) {
    error.value = `解析失敗：${e instanceof Error ? e.message : String(e)}`
    return
  }
  if (!hasContent(parsed)) {
    error.value = '無法辨識任何內容，請確認格式（需有 ## 標頭、總表項目或分配等）'
    return
  }
  emit('imported', parsed)
  text.value = ''
  emit('close')
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      text.value = ''
      error.value = ''
    }
  }
)
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <div class="dialog">
      <h3>貼上 DC 內容</h3>
      <textarea v-model="text" rows="12" placeholder="把 Discord 上的分寶內容貼進來…"
        @input="error = ''"></textarea>
      <p v-if="error" class="field-error import-error">{{ error }}</p>
      <div class="actions">
        <button type="button" class="btn btn-ghost" @click="emit('close')">取消</button>
        <button type="button" class="btn btn-primary" @click="doImport">匯入</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
  background: rgba(17, 24, 39, .5); backdrop-filter: blur(2px); padding: 20px;
}
.dialog {
  background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-lg);
  padding: 20px; width: min(640px, 92vw);
}
.dialog h3 { margin: 0 0 14px; font-size: 16px; font-weight: 650; }
.dialog textarea { font-family: var(--mono); font-size: 13px; line-height: 1.55; resize: vertical; }
.import-error { margin: 8px 0 0; }
.actions { display: flex; gap: 8px; margin-top: 14px; justify-content: flex-end; }
</style>
