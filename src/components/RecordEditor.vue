<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useRecordsStore } from '../store/records'
import { useHistory } from '../store/history'
import { aliasOf } from '../store/roster'
import { webhookUrl } from '../store/webhook'
import { publishOrSync, publishContent } from '../dc/publish'
import { parseMessageLink, isBindingLost, getMessage } from '../dc/webhook'
import type { LootRecord, LootItem, Member, Purchase, Stream, Consignment } from '../types'
import LootTable from './LootTable.vue'
import AutocompleteInput from './AutocompleteInput.vue'
import PurchaseTable from './PurchaseTable.vue'
import StreamTable from './StreamTable.vue'
import ConsignmentTable from './ConsignmentTable.vue'
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

// 下拉顯示「別名 (handle)」，選取仍存 handle
function handleLabel(h: string): string {
  const a = aliasOf(h)
  return a ? `${a} (${h})` : h
}

function ensureIds() {
  const r = record.value
  if (!r) return
  const streams = r.streams ?? []
  const consignments = r.consignments ?? []
  const needs =
    r.lootItems.some((it) => !it.id) ||
    r.members.some((m) => !m.id) ||
    r.purchases.some((p) => !p.id) ||
    streams.some((s) => !s.id) ||
    consignments.some((c) => !c.id)
  if (!needs) return
  store.upsert({
    ...r,
    lootItems: r.lootItems.map((it) => (it.id ? it : { ...it, id: crypto.randomUUID() })),
    members: r.members.map((m) => (m.id ? m : { ...m, id: crypto.randomUUID() })),
    purchases: r.purchases.map((p) => (p.id ? p : { ...p, id: crypto.randomUUID() })),
    streams: streams.map((s) => (s.id ? s : { ...s, id: crypto.randomUUID() })),
    consignments: consignments.map((c) => (c.id ? c : { ...c, id: crypto.randomUUID() })),
  })
}
watch(() => route.params.id, ensureIds, { immediate: true })

// 自未領總覽「開啟 ↗」進入（?focus=dist）時，捲動至分配名單
const distEl = ref<HTMLElement | null>(null)
onMounted(() => {
  if (route.query.focus !== 'dist') return
  nextTick(() => distEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
})

// ---- 發佈/同步至 DC ----
const dcUrl = webhookUrl()
type PublishState = 'idle' | 'busy' | 'ok' | 'fail'
const publishState = ref<PublishState>('idle')
const publishError = ref('')
let publishTimer: ReturnType<typeof setTimeout> | undefined

function fmtSync(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', { hour12: false })
}

// 成功/失敗短暫顯示後回復；執行中不排程
function settleState(state: PublishState) {
  publishState.value = state
  clearTimeout(publishTimer)
  if (state === 'ok' || state === 'fail') {
    publishTimer = setTimeout(() => (publishState.value = 'idle'), 2200)
  }
}

// ---- 與 DC 貼文的一致性檢查 ----
const remoteContent = ref<string | null>(null) // null＝尚未取得（未綁定/讀取失敗）
const checkingRemote = ref(false)
const remoteLost = ref(false)

async function checkRemote() {
  const r = record.value
  remoteContent.value = null
  remoteLost.value = false
  if (!r?.dc || !dcUrl.value) return
  checkingRemote.value = true
  try {
    const m = await getMessage(dcUrl.value, r.dc.messageId, r.dc.threadId)
    remoteContent.value = m.content
  } catch (e) {
    if (isBindingLost(e)) remoteLost.value = true
    // 其他錯誤（網路等）維持「無法確認」，不打擾操作
  } finally {
    checkingRemote.value = false
  }
}
watch(() => [route.params.id, record.value?.dc?.messageId], checkRemote, { immediate: true })

const localContent = computed(() => (record.value ? publishContent(record.value) : ''))
type SyncState = 'unbound' | 'checking' | 'lost' | 'unknown' | 'inSync' | 'dirty'
const syncState = computed<SyncState>(() => {
  if (!record.value?.dc) return 'unbound'
  if (checkingRemote.value) return 'checking'
  if (remoteLost.value) return 'lost'
  if (remoteContent.value == null) return 'unknown'
  return localContent.value === remoteContent.value ? 'inSync' : 'dirty'
})

async function publishToDc() {
  const r = record.value
  if (!r || publishState.value === 'busy') return
  publishError.value = ''
  if (!dcUrl.value) {
    publishError.value = '尚未設定 Webhook URL（右上 ⚙）'
    return
  }
  if (bossError.value) {
    publishError.value = '團名為必填，填好再發佈'
    return
  }
  settleState('busy')
  try {
    const dc = await publishOrSync(dcUrl.value, r)
    store.upsert({ ...r, dc })
    settleState('ok')
    checkRemote() // 同步成功後復查一致性
  } catch (e) {
    // 綁定失效（貼文/討論串已被刪除）：詢問是否重新發一篇新貼文
    if (r.dc && isBindingLost(e)) {
      if (window.confirm('DC 上找不到原本的貼文（可能已被刪除）。\n要重新發一篇新貼文嗎？')) {
        try {
          const dc = await publishOrSync(dcUrl.value, { ...r, dc: undefined })
          store.upsert({ ...r, dc })
          settleState('ok')
          checkRemote()
        } catch (e2) {
          publishError.value = e2 instanceof Error ? e2.message : String(e2)
          settleState('fail')
        }
        return
      }
      publishError.value = '原貼文已失效，未重新發佈；也可用「綁定貼文」接回其他既有貼文'
      settleState('fail')
      return
    }
    publishError.value = e instanceof Error ? e.message : String(e)
    settleState('fail')
  }
}

// 救援：換裝置/清資料後，把既有貼文綁回本紀錄
function bindExisting() {
  const r = record.value
  if (!r) return
  const link = window.prompt('貼上貼文「開頭訊息」的連結（DC 右鍵訊息 → 複製訊息連結）：')
  if (!link) return
  const parsed = parseMessageLink(link)
  if (!parsed) {
    publishError.value = '連結格式不對，應為 https://discord.com/channels/…/…/…'
    return
  }
  publishError.value = ''
  store.upsert({ ...r, dc: { ...parsed, publishedAt: new Date().toISOString() } })
}

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
    streams: parsed.streams ?? [],
    consignments: parsed.consignments ?? [],
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
function setStreams(streams: Stream[]) {
  patch({ streams })
}
function setConsignments(consignments: Consignment[]) {
  patch({ consignments })
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
      <span v-if="syncState === 'checking'" class="sync-chip muted">⋯ 檢查中</span>
      <span v-else-if="syncState === 'inSync'" class="chip chip-ok sync-chip" title="DC 貼文內容與目前紀錄一致">✓ 與 DC 一致</span>
      <span v-else-if="syncState === 'dirty'" class="chip chip-pending sync-chip" title="紀錄有變更尚未同步到 DC">● 與 DC 不同步</span>
      <span v-else-if="syncState === 'lost'" class="chip chip-struck sync-chip" title="DC 上找不到綁定的貼文（可能已被刪除）">⚠ 貼文已失效</span>
      <button type="button" class="btn btn-ghost btn-sm"
        title="把既有 DC 貼文綁到本紀錄（換裝置、清資料或原貼文失效時用）" @click="bindExisting">
        {{ record.dc ? '換綁貼文' : '綁定貼文' }}
      </button>
      <button type="button" class="btn btn-sm publish-btn" :class="`publish-${publishState}`"
        :disabled="publishState === 'busy'"
        :title="record.dc ? `上次同步 ${record.dc.lastSyncAt ? fmtSync(record.dc.lastSyncAt) : '—'}` : '建立論壇貼文（討論串標題建立後不可改）'"
        @click="publishToDc">
        <span v-if="publishState === 'busy'" class="spinner" aria-hidden="true" />
        <template v-if="publishState === 'busy'">同步中…</template>
        <template v-else-if="publishState === 'ok'">✓ 已同步</template>
        <template v-else-if="publishState === 'fail'">✕ 同步失敗</template>
        <template v-else>{{ record.dc ? '同步至 DC' : '發佈至 DC' }}</template>
      </button>
      <button type="button" class="btn btn-sm" @click="showImport = true">重新貼上匯入</button>
      <button type="button" class="btn btn-primary btn-sm" @click="showExport = true">複製回 DC</button>
    </div>
    <p v-if="publishError" class="alert alert-warn">{{ publishError }}</p>

    <div class="card">
      <div class="section-head"><h3>基本資料</h3></div>
      <div class="header-fields">
        <label class="field field-title">
          <span class="field-label">團名 <em>*</em></span>
          <AutocompleteInput :model-value="record.boss" :suggestions="history.bosses.value"
            :class="{ invalid: bossError }" placeholder="例：混龍"
            @update:model-value="patch({ boss: $event })" />
          <span v-if="bossError" class="field-error">團名為必填</span>
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
            :label-for="handleLabel" placeholder="@handle"
            @update:model-value="updateMember(i, { handle: $event })" />
          <span v-if="aliasOf(m.handle)" class="alias-badge">{{ aliasOf(m.handle) }}</span>
          <button type="button" class="btn btn-icon btn-danger" title="移除" @click="removeMember(i)">✕</button>
        </li>
      </ul>
    </div>

    <LootTable :model-value="record.lootItems" @update:model-value="setLootItems" />
    <PurchaseTable :model-value="record.purchases" :members="record.members"
      @update:model-value="setPurchases" />
    <StreamTable :model-value="record.streams ?? []" @update:model-value="setStreams" />
    <ConsignmentTable :model-value="record.consignments ?? []" :members="record.members"
      @update:model-value="setConsignments" />
    <div ref="distEl" class="dist-anchor">
      <DistributionPanel :record="record" @toggle-settle="toggleSettle" />
    </div>

    <ImportDialog :open="showImport" @close="showImport = false" @imported="applyImport" />
    <ExportDialog :open="showExport" :record="record" @close="showExport = false" />
  </section>
  <div v-else class="empty">找不到此紀錄。</div>
</template>

<style scoped>
/* 捲動定位時預留 sticky appbar 高度 */
.dist-anchor { scroll-margin-top: 70px; }

.sync-chip { cursor: default; white-space: nowrap; font-size: 12.5px; }

/* 同步按鈕三態回饋 */
.publish-btn { min-width: 108px; transition: background .18s, border-color .18s, color .18s; }
.publish-ok { background: var(--success-soft); border-color: var(--success); color: var(--success); }
.publish-fail { background: var(--danger-soft); border-color: var(--danger); color: var(--danger); }
.spinner {
  width: 12px; height: 12px; flex: none;
  border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%;
  animation: publish-spin .7s linear infinite;
}
@keyframes publish-spin { to { transform: rotate(360deg); } }

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
.alias-badge {
  padding: 3px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 600;
  background: var(--primary-soft); color: var(--primary-hover); white-space: nowrap;
}
</style>
