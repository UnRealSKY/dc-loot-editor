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

const titleError = computed(() => !record.value || !record.value.title.trim())
const memberCountMismatch = computed(
  () => !!record.value && record.value.memberCount !== record.value.members.length,
)

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
    memberCount: parsed.memberCount,
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
</script>

<template>
  <section v-if="record">
    <div class="editor-toolbar">
      <button type="button" @click="showImport = true">重新貼上匯入</button>
      <button type="button" @click="showExport = true">複製回 DC</button>
    </div>
    <div class="header-fields">
      <label>標題*<input :value="record.title" required :class="{ 'field-invalid': titleError }" @input="patch({ title: ($event.target as HTMLInputElement).value })" />
        <span v-if="titleError" class="field-error">標題為必填</span>
      </label>
      <label>日期<input type="date" :value="record.date" @input="patch({ date: ($event.target as HTMLInputElement).value })" /></label>
      <label>王名
        <AutocompleteInput :model-value="record.boss" :suggestions="history.bosses.value"
          @update:model-value="patch({ boss: $event })" />
      </label>
      <label>人數<input type="number" :value="record.memberCount" style="width:4em"
        @input="patch({ memberCount: Number(($event.target as HTMLInputElement).value) })" /></label>
    </div>

    <p v-if="memberCountMismatch" class="warn">人數（{{ record.memberCount }}）與團員列數（{{ record.members.length }}）不一致，分配可能有誤</p>

    <h3>團員</h3>
    <ul class="members">
      <li v-for="(m, i) in record.members" :key="m.id">
        <AutocompleteInput :model-value="m.handle" :suggestions="history.handles.value"
          placeholder="@handle" @update:model-value="updateMember(i, { handle: $event })" />
        <button type="button" @click="updateMember(i, { settle: m.settle === 'settled' ? 'pending' : 'settled' })">
          {{ m.settle === 'settled' ? ':ok:' : ':orange_square:' }}
        </button>
        <button type="button" @click="removeMember(i)">✕</button>
      </li>
    </ul>
    <button type="button" @click="addMember">＋ 新增團員</button>

    <LootTable :model-value="record.lootItems" @update:model-value="setLootItems" />
    <PurchaseTable :model-value="record.purchases" :members="record.members"
      @update:model-value="setPurchases" />
    <DistributionPanel :record="record" />

    <ImportDialog :open="showImport" @close="showImport = false" @imported="applyImport" />
    <ExportDialog :open="showExport" :record="record" @close="showExport = false" />
  </section>
  <p v-else>找不到此紀錄。</p>
</template>

<style scoped>
.editor-toolbar { display: flex; gap: 8px; margin-bottom: 12px; }
.header-fields { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
.header-fields label { display: flex; flex-direction: column; font-size: 0.85em; }
.members { list-style: none; padding: 0; }
.members li { display: flex; gap: 8px; align-items: center; margin-bottom: 4px; }
.field-error { color: #c00; font-size: 0.8em; }
.warn { color: #c60; font-size: 0.85em; margin: 4px 0; }
</style>
