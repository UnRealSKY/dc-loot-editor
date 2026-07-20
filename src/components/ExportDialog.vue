<script setup lang="ts">
import { computed, ref } from 'vue'
import { serialize } from '../format/serialize'
import type { LootRecord } from '../types'

const props = defineProps<{ open: boolean; record: LootRecord }>()
const emit = defineEmits<{ close: [] }>()

const md = computed(() => serialize(props.record))
const copied = ref(false)
const copyFailed = ref(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(md.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    copyFailed.value = true
    setTimeout(() => (copyFailed.value = false), 1500)
  }
}
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <div class="dialog">
      <h3>複製回 DC</h3>
      <textarea :value="md" rows="16" readonly></textarea>
      <div class="actions">
        <button type="button" class="btn btn-ghost" @click="emit('close')">關閉</button>
        <button type="button" class="btn btn-primary" :class="{ 'btn-copied': copied }" @click="copy">
          {{ copyFailed ? '複製失敗' : copied ? '已複製 ✓' : '複製' }}
        </button>
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
.actions { display: flex; gap: 8px; margin-top: 14px; justify-content: flex-end; }
.btn-copied { background: var(--success); border-color: var(--success); }
</style>
