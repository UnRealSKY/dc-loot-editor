<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRecordsStore } from '../store/records'
import type { LootRecord } from '../types'
import ImportDialog from './ImportDialog.vue'

const store = useRecordsStore()
const router = useRouter()

const sorted = computed(() =>
  [...store.records].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
)

const showImport = ref(false)

function createNew() {
  const r = store.create()
  router.push(`/edit/${r.id}`)
}

function onImported(parsed: LootRecord) {
  const r = store.create({ ...parsed })
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
    <div class="page-head">
      <h2>分寶紀錄</h2>
      <div class="toolbar">
        <button class="btn" @click="showImport = true">貼上 DC 匯入</button>
        <button class="btn btn-primary" @click="createNew">＋ 新增紀錄</button>
      </div>
    </div>

    <ImportDialog :open="showImport" @close="showImport = false" @imported="onImported" />

    <div v-if="!sorted.length" class="empty">
      尚無紀錄，點右上角「新增紀錄」或「貼上 DC 匯入」開始。
    </div>

    <ul v-else class="record-list">
      <li v-for="r in sorted" :key="r.id" class="record-card">
        <router-link :to="`/edit/${r.id}`" class="record-main">
          <span class="record-title">{{ r.boss || '(未命名)' }}</span>
          <span class="record-meta">
            <span v-if="r.date">{{ r.date }}</span>
            <span v-if="r.members.length">{{ r.members.length }} 人</span>
          </span>
        </router-link>
        <div class="record-actions">
          <button class="btn btn-icon" title="複製" @click="duplicate(r.id)">⧉</button>
          <button class="btn btn-icon btn-danger" title="刪除" @click="remove(r.id)">🗑</button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.page-head { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.page-head h2 { margin: 0; font-size: 20px; font-weight: 680; flex: 1; }

.record-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.record-card {
  display: flex; align-items: center; gap: 12px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); box-shadow: var(--shadow-sm);
  padding: 4px 8px 4px 16px; transition: border-color .14s, box-shadow .14s, transform .06s;
}
.record-card:hover { border-color: var(--border-strong); box-shadow: var(--shadow-md); }
.record-main {
  flex: 1; display: flex; flex-direction: column; gap: 2px;
  text-decoration: none; color: inherit; padding: 10px 0; min-width: 0;
}
.record-title { font-weight: 600; font-size: 15px; }
.record-meta { display: flex; gap: 12px; font-size: 12.5px; color: var(--text-muted); flex-wrap: wrap; }
.record-actions { display: flex; gap: 4px; flex: none; }
</style>
