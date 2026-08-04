import { ref } from 'vue'

export interface RosterEntry {
  handle: string
  alias: string
  id?: string // Discord 使用者 ID（發佈時把 @handle 轉成 <@ID> 真 mention 用）
}

const STORAGE_KEY = 'dc-loot-roster'
const SOURCE_KEY = 'dc-roster-source'
// 執行期直讀 repo 上的名冊：更新名冊只需 push git（改 members.json），不必發版部署。
const RAW_URL = 'https://raw.githubusercontent.com/UnRealSKY/dc-loot-editor/main/members.json'

// 名冊來源：預設 repo／自訂 URL（他公會共用）／本機自訂（管理頁直接編輯）
export type ListSourceMode = 'default' | 'url' | 'local'
export interface ListSource {
  mode: ListSourceMode
  url?: string
}

export function loadListSource(key: string): ListSource {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (parsed && ['default', 'url', 'local'].includes(parsed.mode)) {
      return { mode: parsed.mode, url: typeof parsed.url === 'string' ? parsed.url : undefined }
    }
  } catch {
    // 壞資料回預設
  }
  return { mode: 'default' }
}

// ---- 純函式（可單元測試）----
export function buildAliasMap(entries: RosterEntry[]): Map<string, string> {
  return new Map(entries.filter((e) => e && e.handle && e.alias).map((e) => [e.handle, e.alias]))
}

// ---- 響應式單例 ----
const roster = ref<RosterEntry[]>(loadCache())
const aliasMap = ref<Map<string, string>>(buildAliasMap(roster.value))
const source = ref<ListSource>(loadListSource(SOURCE_KEY))

export function rosterSource() {
  return source
}

export function setRosterSource(s: ListSource): void {
  source.value = s
  localStorage.setItem(SOURCE_KEY, JSON.stringify(s))
}

function loadCache(): RosterEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const data = raw ? JSON.parse(raw) : []
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function setRoster(entries: RosterEntry[]): void {
  roster.value = entries
  aliasMap.value = buildAliasMap(entries)
}

// 名冊背景載入中（autocomplete 顯示「載入中」提示用）
const loading = ref(false)
export function rosterLoading() {
  return loading
}

// 抓取並驗證名冊 JSON（管理頁「自訂 URL」驗證也用這支）；格式不對會拋錯
export async function fetchRoster(url: string): Promise<RosterEntry[]> {
  const res = await fetch(url, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`抓取失敗（HTTP ${res.status}）`)
  const data = await res.json().catch(() => null)
  if (!Array.isArray(data)) throw new Error('格式不對：內容必須是 JSON 陣列')
  const entries = data.filter(
    (e): e is RosterEntry => !!e && typeof e.handle === 'string' && typeof e.alias === 'string',
  )
  if (data.length && !entries.length) {
    throw new Error('格式不對：每筆需含 handle 與 alias 字串欄位')
  }
  return entries
}

// 本機自訂模式的儲存（管理頁編輯用）
export function saveRosterLocal(entries: RosterEntry[]): void {
  setRoster(entries)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

// 開站呼叫一次：先用 localStorage 快取即時顯示，背景再依來源模式更新並回寫快取
export async function initRoster(): Promise<void> {
  const s = source.value
  if (s.mode === 'local') return // 本機自訂：不抓網路
  const url = s.mode === 'url' && s.url ? s.url : RAW_URL
  loading.value = true
  try {
    saveRosterLocal(await fetchRoster(url))
  } catch {
    // 離線或抓取失敗：沿用 localStorage 快取
  } finally {
    loading.value = false
  }
}

export function useRoster() {
  return { roster }
}

export function aliasOf(handle: string): string | undefined {
  return aliasMap.value.get(handle)
}

// 顯示用名稱：有別名用別名，否則用原 handle
export function displayName(handle: string): string {
  return aliasMap.value.get(handle) || handle
}

export function rosterHandles(): string[] {
  return roster.value.map((e) => e.handle).filter(Boolean)
}

// 有填 Discord 使用者 ID 的名冊項（handle → <@ID> 轉換用）
export function rosterMentions(): Array<{ handle: string; id: string }> {
  return roster.value
    .filter((e) => e.handle && e.id)
    .map((e) => ({ handle: e.handle, id: String(e.id) }))
}
