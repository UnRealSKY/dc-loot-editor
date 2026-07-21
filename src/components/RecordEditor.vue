<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useRecordsStore } from '../store/records'
import { useHistory } from '../store/history'
import type { LootRecord, LootItem, Member, Purchase } from '../types'
import LootTable from './LootTable.vue'
import AutocompleteInput from './AutocompleteInput.vue'
import PurchaseTable from './PurchaseTable.vue'
import DistributionPanel from './DistributionPanel.vue'
import ExportDialog from './ExportDialog.vue'
import ImportDialog from './ImportDialog.vue'

const route = useRoute()
const store = useRecordsStore()
const history = useHistory()

const record = computed<LootRecord | undefined>(() => store.get(route.params.id as string))

function patch(part: Partial<LootRecord>) {
  if (record.value) store.upsert({ ...record.value, ...part })
}

const bossError = computed(() => !record.value || !record.value.boss.trim())

function ensureIds() {
  const r = record.value
  if (!r) return
  const needs =
    r.lootItems.some((it) => !it.id) ||
    r.members.some((m) => !m.id) ||
    r.purchases.some((p) => !p.id)
  if (!needs) return
  store.upsert({
    ...r,
    lootItems: r.lootItems.map((it) => (it.id ? it : { ...it, id: crypto.randomUUID() })),
    members: r.members.map((m) => (m.id ? m : { ...m, id: crypto.randomUUID() })),
    purchases: r.purchases.map((p) => (p.id ? p : { ...p, id: crypto.randomUUID() })),
  })
}
watch(() => route.params.id, ensureIds, { immediate: true })

const showExport = ref(false)
const showImport = ref(false)
function applyImport(parsed: LootRecord) {
  if (!record.value) return
  store.upsert({
    ...record.value,
    date: parsed.date,
    boss: parsed.boss,
    members: parsed.members,
    lootItems: parsed.lootItems,
    purchases: parsed.purchases,
  })
  ensureIds() // 為剛匯入的資料列補上穩定 id（迴圈安全，手動呼叫）
}
function setLootItems(items: LootItem[]) {
  patch({ lootItems: items })
}
function setMembers(members: Member[]) {
  patch({ members })
}
function setPurchases(purchases: Purchase[]) {
  patch({ purchases })
}
function addMember() {
  if (!record.value) return
  setMembers([...record.value.members, { handle: '', settle: 'pending', id: crypto.randomUUID() }])
}
function updateMember(i: number, part: Partial<Member>) {
  if (!record.value) return
  const next = [...record.value.members]
  next[i] = { ...next[i], ...part }
  setMembers(next)
}
function removeMember(i: number) {
  if (!record.value) return
  setMembers(record.value.members.filter((_, idx) => idx !== i))
}
function toggleSettle(i: number) {
  const m = record.value?.members[i]
  if (!m) return
  updateMember(i, { settle: m.settle === 'settled' ? 'pending' : 'settled' })
}
</script>

<template>
  <section v-if="record">
    <div class="editor-top">
      <router-link to="/" class="btn btn-ghost btn-sm back">← 返回列表</router-link>
      <div class="spacer" />
      <button type="button" class="btn btn-sm" @click="showImport = true">重新貼上匯入</button>
      <button type="button" class="btn btn-primary btn-sm" @click="showExport = true">複製回 DC</button>
    </div>

    <div class="card">
      <div class="section-head"><h3>基本資料</h3></div>
      <div class="header-fields">
        <label class="field field-title">
          <span class="field-label">王名 <em>*</em></span>
          <AutocompleteInput :model-value="record.boss" :suggestions="history.bosses.value"
            :class="{ invalid: bossError }" placeholder="例：混龍"
            @update:model-value="patch({ boss: $event })" />
          <span v-if="bossError" class="field-error">王名為必填</span>
        </label>
        <label class="field">
          <span class="field-label">日期</span>
          <input type="date" :value="record.date"
            @input="patch({ date: ($event.target as HTMLInputElement).value })" />
        </label>
      </div>
    </div>

    <div class="card">
      <div class="section-head">
        <h3>團員</h3>
        <div class="spacer" />
        <button type="button" class="btn btn-sm" @click="addMember">＋ 新增團員</button>
      </div>
      <p v-if="!record.members.length" class="muted">尚無團員。</p>
      <ul class="members">
        <li v-for="(m, i) in record.members" :key="m.id" class="member-row">
          <AutocompleteInput class="member-handle" :model-value="m.handle" :suggestions="history.handles.value"
            placeholder="@handle" @update:model-value="updateMember(i, { handle: $event })" />
          <button type="button" class="btn btn-icon btn-danger" title="移除" @click="removeMember(i)">✕</button>
        </li>
      </ul>
    </div>

    <LootTable :model-value="record.lootItems" @update:model-value="setLootItems" />
    <PurchaseTable :model-value="record.purchases" :members="record.members"
      @update:model-value="setPurchases" />
    <DistributionPanel :record="record" @toggle-settle="toggleSettle" />

    <ImportDialog :open="showImport" @close="showImport = false" @imported="applyImport" />
    <ExportDialog :open="showExport" :record="record" @close="showExport = false" />
  </section>
  <div v-else class="empty">找不到此紀錄。</div>
</template>

<style scoped>
.editor-top { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.editor-top .spacer { flex: 1; }
.back { text-decoration: none; }

.header-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field-title { grid-column: 1 / -1; }
.field-title .invalid :deep(input) { border-color: var(--danger); }
.field-label { font-size: 12.5px; font-weight: 550; color: var(--text-muted); }
.field-label em { color: var(--danger); font-style: normal; }

.members { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.member-row { display: flex; gap: 8px; align-items: center; }
.member-handle { flex: 1; max-width: 320px; }
</style>
