<script setup lang="ts">
import { computed, ref } from 'vue'
import { serialize } from '../format/serialize'
import type { LootRecord } from '../types'

const props = defineProps<{ open: boolean; record: LootRecord }>()
const emit = defineEmits<{ close: [] }>()

const md = computed(() => serialize(props.record))
const copied = ref(false)

async function copy() {
  await navigator.clipboard.writeText(md.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <div class="dialog">
      <h3>複製回 DC</h3>
      <textarea :value="md" rows="16" readonly></textarea>
      <div class="actions">
        <button type="button" @click="copy">{{ copied ? '已複製 ✓' : '複製' }}</button>
        <button type="button" @click="emit('close')">關閉</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; }
.dialog { background: #fff; padding: 16px; width: min(640px, 90vw); }
.dialog textarea { width: 100%; box-sizing: border-box; font-family: monospace; }
.actions { display: flex; gap: 8px; margin-top: 8px; }
</style>
