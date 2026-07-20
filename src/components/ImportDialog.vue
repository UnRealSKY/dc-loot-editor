<script setup lang="ts">
import { ref } from 'vue'
import { parse } from '../format/parse'
import type { LootRecord } from '../types'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; imported: [v: LootRecord] }>()

const text = ref('')

function doImport() {
  emit('imported', parse(text.value))
  text.value = ''
  emit('close')
}
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <div class="dialog">
      <h3>貼上 DC 內容</h3>
      <textarea v-model="text" rows="12"></textarea>
      <div class="actions">
        <button type="button" @click="doImport">匯入</button>
        <button type="button" @click="emit('close')">取消</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; }
.dialog { background: #fff; padding: 16px; width: min(640px, 90vw); }
.dialog textarea { width: 100%; box-sizing: border-box; }
.actions { display: flex; gap: 8px; margin-top: 8px; }
</style>
