<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  useRoster,
  rosterSource,
  setRosterSource,
  fetchRoster,
  saveRosterLocal,
  initRoster,
  rosterLoading,
  type RosterEntry,
  type ListSource,
  type ListSourceMode,
} from '../store/roster'
import {
  sharedItemNames,
  itemsSource,
  setItemsSource,
  fetchItems,
  saveItemsLocal,
  initSharedItems,
  sharedItemsLoading,
} from '../store/sharedItems'

const MODES: Array<{ value: ListSourceMode; label: string }> = [
  { value: 'default', label: '預設來源' },
  { value: 'url', label: '自訂 URL' },
  { value: 'local', label: '自行輸入' },
]

// ---- 名冊 ----
const { roster } = useRoster()
const rSource = rosterSource()
const rUrlDraft = ref(rSource.value.url ?? '')
const rBusy = ref(false)
const rError = ref('')
const rOk = ref('')

function setRosterMode(mode: ListSourceMode) {
  rError.value = ''
  rOk.value = ''
  if (mode === 'url') {
    // 切到 URL 模式僅顯示輸入框，抓取成功才落地
    rSource.value.mode !== 'url' && setRosterSource({ mode: 'url', url: rSource.value.url })
    return
  }
  setRosterSource({ mode })
  if (mode === 'default') initRoster()
}

async function applyRosterUrl() {
  rError.value = ''
  rOk.value = ''
  const url = rUrlDraft.value.trim()
  if (!url) {
    rError.value = '請貼上 JSON 網址'
    return
  }
  rBusy.value = true
  try {
    const entries = await fetchRoster(url)
    saveRosterLocal(entries)
    setRosterSource({ mode: 'url', url })
    rOk.value = `✓ 已套用，共 ${entries.length} 筆`
  } catch (e) {
    rError.value = e instanceof Error ? e.message : String(e)
  } finally {
    rBusy.value = false
  }
}

function editRoster(i: number, part: Partial<RosterEntry>) {
  const next = roster.value.map((e, idx) => (idx === i ? { ...e, ...part } : e))
  saveRosterLocal(next)
}
function addRosterRow() {
  // 手動加的一列沒有 Discord 資料，名字填在 alias
  saveRosterLocal([...roster.value, { discordHandle: '', discordNickName: '', alias: '' }])
}
function removeRosterRow(i: number) {
  saveRosterLocal(roster.value.filter((_, idx) => idx !== i))
}

// ---- 品名清單 ----
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

// ---- 匯出 JSON（複製到剪貼簿，団長可放上自己的 repo/Gist 共用）----
const copied = ref('')
let copiedTimer: ReturnType<typeof setTimeout> | undefined
async function copyJson(key: 'roster' | 'items') {
  const data = key === 'roster' ? roster.value : sharedItemNames()
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
      <h2>名單管理</h2>
    </div>
    <p class="muted intro">
      名冊與品名清單是 autocomplete 與別名顯示的來源。預設跟隨官方 repo；
      其他公會可貼自己的 JSON 網址（GitHub raw／Gist），或直接在此自行輸入。
    </p>

    <!-- 名冊 -->
    <div class="card">
      <div class="section-head">
        <h3>名冊</h3>
        <span class="count">{{ roster.length }} 筆</span>
        <span v-if="rosterLoading().value" class="count">載入中…</span>
        <div class="spacer" />
        <button type="button" class="btn btn-sm" @click="copyJson('roster')">
          {{ copied === 'roster' ? '✓ 已複製' : '匯出 JSON' }}
        </button>
      </div>
      <div class="mode-row">
        <button v-for="m in MODES" :key="m.value" type="button" class="chip"
          :class="rSource.mode === m.value ? 'chip-ok' : 'chip-struck'"
          @click="setRosterMode(m.value)">{{ m.label }}</button>
      </div>
      <div v-if="rSource.mode === 'url'" class="url-row">
        <input v-model="rUrlDraft" placeholder="https://raw.githubusercontent.com/…/members.json"
          spellcheck="false" @input="rError = ''" />
        <button type="button" class="btn btn-primary btn-sm" :disabled="rBusy" @click="applyRosterUrl">
          {{ rBusy ? '抓取中…' : '抓取並套用' }}
        </button>
      </div>
      <p v-if="rError" class="field-error">{{ rError }}</p>
      <p v-if="rOk" class="ok-note">{{ rOk }}</p>

      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Discord 帳號</th><th>Discord 顯示名</th><th>自訂別名</th><th>Discord 使用者 ID</th>
            <th v-if="rSource.mode === 'local'"></th>
          </tr></thead>
          <tbody>
            <tr v-for="(e, i) in roster" :key="i">
              <template v-if="rSource.mode === 'local'">
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
      <button v-if="rSource.mode === 'local'" type="button" class="btn btn-sm add-row"
        @click="addRosterRow">＋ 新增一列</button>
    </div>

    <!-- 品名清單 -->
    <div class="card">
      <div class="section-head">
        <h3>品名清單</h3>
        <span class="count">{{ sharedItemNames().length }} 項</span>
        <span v-if="sharedItemsLoading().value" class="count">載入中…</span>
        <div class="spacer" />
        <button type="button" class="btn btn-sm" @click="copyJson('items')">
          {{ copied === 'items' ? '✓ 已複製' : '匯出 JSON' }}
        </button>
      </div>
      <div class="mode-row">
        <button v-for="m in MODES" :key="m.value" type="button" class="chip"
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

.mode-row { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.url-row { display: flex; gap: 8px; margin-bottom: 10px; }
.url-row input { font-family: var(--mono); font-size: 13px; }
.url-row .btn { flex: none; }
.ok-note { margin: 0 0 10px; font-size: 13px; color: var(--success); }
.field-error { margin: 0 0 10px; }

.add-row { margin-top: 10px; }
.item-list {
  list-style: none; margin: 0; padding: 0;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 4px 14px;
  font-size: 13.5px;
}
.item-list li { padding: 3px 0; border-bottom: 1px solid var(--surface-2); }
textarea { font-size: 13.5px; line-height: 1.7; resize: vertical; }
</style>
