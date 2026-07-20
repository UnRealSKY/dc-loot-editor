<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useRecordsStore } from '../store/records'
import { parse } from '../format/parse'

const store = useRecordsStore()
const router = useRouter()

const sorted = computed(() =>
  [...store.records].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
)

function createNew() {
  const r = store.create({ title: '未命名分寶' })
  router.push(`/edit/${r.id}`)
}

function importPaste() {
  const md = window.prompt('貼上 DC 內容：')
  if (!md) return
  const parsed = parse(md)
  const r = store.create({ ...parsed, title: parsed.boss || '匯入的分寶' })
  router.push(`/edit/${r.id}`)
}

function remove(id: string) {
  if (window.confirm('確定刪除這筆紀錄？')) store.remove(id)
}

function duplicate(id: string) {
  store.duplicate(id)
}
</script>

<template>
  <section>
    <div class="toolbar">
      <button @click="createNew">新增紀錄</button>
      <button @click="importPaste">貼上 DC 匯入</button>
    </div>
    <p v-if="!sorted.length">尚無紀錄。</p>
    <ul class="record-list">
      <li v-for="r in sorted" :key="r.id" class="record-item">
        <router-link :to="`/edit/${r.id}`">{{ r.title || '(無標題)' }}</router-link>
        <span class="date">{{ r.date }}</span>
        <button @click="duplicate(r.id)">複製</button>
        <button @click="remove(r.id)">刪除</button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.toolbar { margin-bottom: 12px; display: flex; gap: 8px; }
.record-list { list-style: none; padding: 0; }
.record-item { display: flex; gap: 12px; align-items: center; padding: 6px 0; border-bottom: 1px solid #eee; }
.date { color: #888; font-size: 0.9em; }
</style>
