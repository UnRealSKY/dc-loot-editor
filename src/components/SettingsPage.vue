<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  useGroups,
  activeGroup,
  setActiveGroup,
  createGroup,
  patchGroup,
  deleteGroup,
  countRecordsIn,
  leaderFeeEnabled,
  rosterLoading,
  type DcGroup,
  type RosterMode,
} from '../store/groups'
import { fetchRoster, type RosterEntry } from '../store/roster'
import { normalizeWebhookUrl, getWebhook, type WebhookInfo } from '../dc/webhook'
import { useRecordsStore } from '../store/records'
import {
  sharedItemNames,
  itemsSource,
  setItemsSource,
  fetchItems,
  saveItemsLocal,
  initSharedItems,
  sharedItemsLoading,
} from '../store/sharedItems'
import type { ListSourceMode } from '../store/roster'

const ITEM_MODES: Array<{ value: ListSourceMode; label: string }> = [
  { value: 'default', label: '預設來源' },
  { value: 'url', label: '自訂 URL' },
  { value: 'local', label: '自行輸入' },
]
const ROSTER_MODES: Array<{ value: RosterMode; label: string }> = [
  { value: 'url', label: '自訂 URL' },
  { value: 'local', label: '自行輸入' },
]

const { groups, activeId } = useGroups()
const store = useRecordsStore()
const current = computed<DcGroup | undefined>(() => activeGroup())

// ---- 群組本身 ----
function addGroupRow() {
  const name = window.prompt('新群組名稱：', `群組 ${groups.value.length + 1}`)
  if (name?.trim()) createGroup(name.trim())
}

function renameGroup(name: string) {
  if (current.value) patchGroup(current.value.id, { name })
}

// 綁著紀錄的群組不能刪：那些紀錄的 webhook 與名冊都靠它，刪掉會讓金額顯示與發佈目標一起錯亂
const boundCount = computed(() =>
  current.value ? countRecordsIn(store.records, groups.value, current.value.id) : 0,
)
const deleteBlockReason = computed(() => {
  if (groups.value.length <= 1) return '至少要保留一個群組'
  if (boundCount.value) return `還有 ${boundCount.value} 筆紀錄綁在這個群組，請先把它們改到別的群組`
  return ''
})

function removeCurrent() {
  const g = current.value
  if (!g || deleteBlockReason.value) return
  if (window.confirm(`確定刪除群組「${g.name}」？`)) deleteGroup(g.id)
}

// ---- Webhook ----
const hookBusy = ref(false)
const hookError = ref('')
const hookInfo = ref<WebhookInfo | null>(null)

async function verifyHook() {
  const g = current.value
  if (!g) return
  hookError.value = ''
  hookInfo.value = null
  const norm = normalizeWebhookUrl(g.webhookUrl)
  if (!norm.ok) {
    hookError.value = norm.error
    return
  }
  hookBusy.value = true
  try {
    hookInfo.value = await getWebhook(norm.url)
    patchGroup(g.id, { webhookUrl: norm.url })
  } catch (e) {
    hookError.value = e instanceof Error ? e.message : String(e)
  } finally {
    hookBusy.value = false
  }
}

function setHook(url: string) {
  hookError.value = ''
  hookInfo.value = null
  if (current.value) patchGroup(current.value.id, { webhookUrl: url })
}

function clearHook() {
  hookInfo.value = null
  hookError.value = ''
  if (current.value) patchGroup(current.value.id, { webhookUrl: '' })
}

// ---- 名單 ----
const rosterBusy = ref(false)
const rosterError = ref('')
const rosterOk = ref('')

function setRosterMode(mode: RosterMode) {
  rosterError.value = ''
  rosterOk.value = ''
  if (current.value) patchGroup(current.value.id, { rosterMode: mode })
}

async function applyRosterUrl() {
  const g = current.value
  if (!g) return
  rosterError.value = ''
  rosterOk.value = ''
  const url = (g.rosterUrl ?? '').trim()
  if (!url) {
    rosterError.value = '請貼上 JSON 網址'
    return
  }
  rosterBusy.value = true
  try {
    const roster = await fetchRoster(url)
    patchGroup(g.id, { rosterUrl: url, roster })
    rosterOk.value = `✓ 已套用，共 ${roster.length} 筆`
  } catch (e) {
    rosterError.value = e instanceof Error ? e.message : String(e)
  } finally {
    rosterBusy.value = false
  }
}

function editRoster(i: number, part: Partial<RosterEntry>) {
  const g = current.value
  if (!g) return
  patchGroup(g.id, { roster: g.roster.map((e, idx) => (idx === i ? { ...e, ...part } : e)) })
}
function addRosterRow() {
  const g = current.value
  if (!g) return
  // 手動加的一列沒有 Discord 資料，名字填在 alias
  patchGroup(g.id, { roster: [...g.roster, { discordHandle: '', discordNickName: '', alias: '' }] })
}
function removeRosterRow(i: number) {
  const g = current.value
  if (!g) return
  patchGroup(g.id, { roster: g.roster.filter((_, idx) => idx !== i) })
}

// ---- 品名清單（所有群組共用）----
const iSource = itemsSource()
const iUrlDraft = ref(iSource.value.url ?? '')
const iBusy = ref(false)
const iError = ref('')
const iOk = ref('')
const itemsText = computed({
  get: () => sharedItemNames().join('\n'),
  set: (v: string) => saveItemsLocal(v.split('\n').map((s) => s.trim()).filter(Boolean)),
})

function setItemsMode(mode: ListSourceMode) {
  iError.value = ''
  iOk.value = ''
  if (mode === 'url') {
    iSource.value.mode !== 'url' && setItemsSource({ mode: 'url', url: iSource.value.url })
    return
  }
  setItemsSource({ mode })
  if (mode === 'default') initSharedItems()
}

async function applyItemsUrl() {
  iError.value = ''
  iOk.value = ''
  const url = iUrlDraft.value.trim()
  if (!url) {
    iError.value = '請貼上 JSON 網址'
    return
  }
  iBusy.value = true
  try {
    const names = await fetchItems(url)
    saveItemsLocal(names)
    setItemsSource({ mode: 'url', url })
    iOk.value = `✓ 已套用，共 ${names.length} 項`
  } catch (e) {
    iError.value = e instanceof Error ? e.message : String(e)
  } finally {
    iBusy.value = false
  }
}

// ---- 匯出 JSON ----
const copied = ref('')
let copiedTimer: ReturnType<typeof setTimeout> | undefined
async function copyJson(key: 'roster' | 'items') {
  const data = key === 'roster' ? (current.value?.roster ?? []) : sharedItemNames()
  try {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    copied.value = key
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copied.value = ''), 1500)
  } catch {
    // 剪貼簿不可用時僅不顯示回饋
  }
}
</script>

<template>
  <section>
    <div class="page-head">
      <h2>設定</h2>
    </div>
    <p class="muted intro">
      一個 DC 群組＝一套設定集：名稱、發佈用的 Webhook、以及團員名冊。
      每筆分寶紀錄綁定一個群組，發佈與別名顯示都跟著它走。
    </p>

    <!-- DC 群組 -->
    <div class="card">
      <div class="section-head">
        <h3>DC 群組</h3>
        <span class="count">{{ groups.length }} 個</span>
        <div class="spacer" />
        <button type="button" class="btn btn-sm" @click="addGroupRow">＋ 新增群組</button>
      </div>

      <div class="group-tabs" role="group" aria-label="選擇群組">
        <button v-for="g in groups" :key="g.id" type="button" class="btn btn-sm group-chip"
          :class="{ 'group-on': g.id === activeId }" :aria-pressed="g.id === activeId"
          @click="setActiveGroup(g.id)">{{ g.name }}</button>
      </div>

      <template v-if="current">
        <div class="group-fields">
          <label class="field">
            <span class="field-label">名稱</span>
            <input :value="current.name" placeholder="群組名稱"
              @input="renameGroup(($event.target as HTMLInputElement).value)" />
          </label>
          <label class="field field-wide">
            <span class="field-label">群組 Webhook</span>
            <div class="hook-row">
              <input :value="current.webhookUrl" placeholder="https://discord.com/api/webhooks/…"
                autocomplete="off" spellcheck="false"
                @input="setHook(($event.target as HTMLInputElement).value)" />
              <button type="button" class="btn btn-primary btn-sm" :disabled="hookBusy"
                @click="verifyHook">{{ hookBusy ? '驗證中…' : '驗證' }}</button>
              <button v-if="current.webhookUrl" type="button" class="btn btn-ghost btn-danger btn-sm"
                @click="clearHook">清除</button>
            </div>
          </label>
        </div>
        <label class="toggle-row">
          <input type="checkbox" :checked="leaderFeeEnabled(current)"
            @change="patchGroup(current.id, { enableLeaderFee: ($event.target as HTMLInputElement).checked })" />
          啟用團長辛苦費
        </label>
        <p v-if="hookError" class="field-error">{{ hookError }}</p>
        <p v-if="hookInfo" class="ok-note">
          ✓ 已驗證並儲存：<strong>{{ hookInfo.name }}</strong>
          <span class="muted">（頻道 {{ hookInfo.channelId }}）</span>
        </p>
        <p class="muted hook-note">
          目標頻道必須是<strong>論壇頻道</strong>（一般文字頻道無法由 webhook 建立討論串）。
          Webhook URL 等同密鑰，勿貼到公開頻道；共用電腦用畢請清除。
        </p>

        <div class="section-head roster-head">
          <h3>名單</h3>
          <span class="count">{{ current.roster.length }} 筆</span>
          <span v-if="rosterLoading().value" class="count">載入中…</span>
          <div class="spacer" />
          <button type="button" class="btn btn-sm" @click="copyJson('roster')">
            {{ copied === 'roster' ? '✓ 已複製' : '匯出 JSON' }}
          </button>
        </div>
        <div class="mode-row">
          <button v-for="m in ROSTER_MODES" :key="m.value" type="button" class="chip"
            :class="current.rosterMode === m.value ? 'chip-ok' : 'chip-struck'"
            @click="setRosterMode(m.value)">{{ m.label }}</button>
        </div>
        <div v-if="current.rosterMode === 'url'" class="url-row">
          <input :value="current.rosterUrl ?? ''" spellcheck="false"
            placeholder="https://raw.githubusercontent.com/…/members.json"
            @input="patchGroup(current.id, { rosterUrl: ($event.target as HTMLInputElement).value })" />
          <button type="button" class="btn btn-primary btn-sm" :disabled="rosterBusy"
            @click="applyRosterUrl">{{ rosterBusy ? '抓取中…' : '抓取並套用' }}</button>
        </div>
        <p v-if="rosterError" class="field-error">{{ rosterError }}</p>
        <p v-if="rosterOk" class="ok-note">{{ rosterOk }}</p>

        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Discord 帳號</th><th>Discord 顯示名</th><th>自訂別名</th><th>Discord 使用者 ID</th>
              <th v-if="current.rosterMode === 'local'"></th>
            </tr></thead>
            <tbody>
              <tr v-for="(e, i) in current.roster" :key="i">
                <template v-if="current.rosterMode === 'local'">
                  <td><input :value="e.discordHandle" placeholder="@handle"
                    @input="editRoster(i, { discordHandle: ($event.target as HTMLInputElement).value })" /></td>
                  <td><input :value="e.discordNickName" placeholder="（同步時自動填入）"
                    @input="editRoster(i, { discordNickName: ($event.target as HTMLInputElement).value })" /></td>
                  <td><input :value="e.alias ?? ''" placeholder="自己取的名字"
                    @input="editRoster(i, { alias: ($event.target as HTMLInputElement).value || undefined })" /></td>
                  <td><input :value="e.discordId ?? ''" placeholder="（選填，真 mention 用）"
                    @input="editRoster(i, { discordId: ($event.target as HTMLInputElement).value || undefined })" /></td>
                  <td><button type="button" class="btn btn-icon btn-danger" title="移除"
                    @click="removeRosterRow(i)">✕</button></td>
                </template>
                <template v-else>
                  <td>{{ e.discordHandle }}</td>
                  <td>{{ e.discordNickName || '—' }}</td>
                  <td :class="{ muted: !e.alias }">{{ e.alias || '—' }}</td>
                  <td class="muted">{{ e.discordId ?? '—' }}</td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="group-actions">
          <button v-if="current.rosterMode === 'local'" type="button" class="btn btn-sm"
            @click="addRosterRow">＋ 新增一列</button>
          <div class="spacer" />
          <span v-if="deleteBlockReason" class="muted delete-note">{{ deleteBlockReason }}</span>
          <button type="button" class="btn btn-sm btn-danger" :disabled="!!deleteBlockReason"
            :title="deleteBlockReason || '刪除這個群組'" @click="removeCurrent">刪除這個群組</button>
        </div>
      </template>
    </div>

    <!-- 品名清單 -->
    <div class="card">
      <div class="section-head">
        <h3>品名清單</h3>
        <span class="count">{{ sharedItemNames().length }} 項</span>
        <span v-if="sharedItemsLoading().value" class="count">載入中…</span>
        <span class="count">所有群組共用</span>
        <div class="spacer" />
        <button type="button" class="btn btn-sm" @click="copyJson('items')">
          {{ copied === 'items' ? '✓ 已複製' : '匯出 JSON' }}
        </button>
      </div>
      <div class="mode-row">
        <button v-for="m in ITEM_MODES" :key="m.value" type="button" class="chip"
          :class="iSource.mode === m.value ? 'chip-ok' : 'chip-struck'"
          @click="setItemsMode(m.value)">{{ m.label }}</button>
      </div>
      <div v-if="iSource.mode === 'url'" class="url-row">
        <input v-model="iUrlDraft" placeholder="https://raw.githubusercontent.com/…/items.json"
          spellcheck="false" @input="iError = ''" />
        <button type="button" class="btn btn-primary btn-sm" :disabled="iBusy" @click="applyItemsUrl">
          {{ iBusy ? '抓取中…' : '抓取並套用' }}
        </button>
      </div>
      <p v-if="iError" class="field-error">{{ iError }}</p>
      <p v-if="iOk" class="ok-note">{{ iOk }}</p>

      <textarea v-if="iSource.mode === 'local'" v-model="itemsText" rows="12"
        placeholder="一行一個品名"></textarea>
      <ul v-else class="item-list">
        <li v-for="name in sharedItemNames()" :key="name">{{ name }}</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.page-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.page-head h2 { margin: 0; font-size: 20px; font-weight: 680; flex: 1; }
.intro { margin: 0 0 18px; font-size: 13.5px; }

.group-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
.group-chip { border-radius: 999px; }
.group-on, .group-on:hover { background: var(--primary); border-color: var(--primary); color: #fff; }
.group-on:hover { background: var(--primary-hover); border-color: var(--primary-hover); }

.group-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
.group-fields .field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.group-fields .field-label { font-size: 12.5px; font-weight: 550; color: var(--text-muted); }
.field-wide { grid-column: span 2; }
.hook-row { display: flex; gap: 8px; }
.hook-row input { font-family: var(--mono); font-size: 13px; }
.hook-row .btn { flex: none; }
.hook-note { margin: 10px 0 0; font-size: 12.5px; }
.toggle-row { display: flex; align-items: center; gap: 8px; margin-top: 14px; font-size: 14px; cursor: pointer; }
.toggle-row input { width: auto; }

.roster-head { margin-top: 22px; }
.mode-row { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.url-row { display: flex; gap: 8px; margin-bottom: 10px; }
.url-row input { font-family: var(--mono); font-size: 13px; }
.url-row .btn { flex: none; }
.ok-note { margin: 0 0 10px; font-size: 13px; color: var(--success); }
.field-error { margin: 0 0 10px; }

.group-actions { display: flex; align-items: center; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.group-actions .spacer { flex: 1; }
.delete-note { font-size: 12.5px; }
.group-actions .btn:disabled { opacity: .5; cursor: not-allowed; }
.group-actions .btn:disabled:hover { background: var(--surface); border-color: var(--border); color: var(--danger); }

.item-list {
  list-style: none; margin: 0; padding: 0;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 4px 14px;
  font-size: 13.5px;
}
.item-list li { padding: 3px 0; border-bottom: 1px solid var(--surface-2); }
textarea { font-size: 13.5px; line-height: 1.7; resize: vertical; }

@media (max-width: 720px) {
  .field-wide { grid-column: 1 / -1; }
  .hook-row, .url-row { flex-wrap: wrap; }
}
</style>
