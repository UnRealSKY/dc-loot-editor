import { ref } from 'vue'

// Discord 那邊的資料與自己取的名字分開存：同步只覆蓋 discord* 三個欄位，
// alias 永遠不動，才不會每次同步就把人工取的簡稱蓋掉。
export interface RosterEntry {
  discordHandle: string     // @username，同步時更新（有人改帳號名就跟著改）
  discordNickName: string   // 伺服器暱稱優先，其次全域顯示名
  discordId?: string        // 發佈時把 @handle 轉成 <@ID> 真 mention 用
  alias?: string            // 自己取的名字；有填就優先顯示，同步不會碰
}

// 顯示優先序：自訂別名 → Discord 顯示名 → 都沒有就用 handle
export function nameOf(e: RosterEntry): string {
  return e.alias || e.discordNickName || e.discordHandle
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
// handle → 顯示名。沒有任何可讀名字的人不進表，displayName 會退回顯示 handle。
export function buildAliasMap(entries: RosterEntry[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const e of entries) {
    if (!e?.discordHandle) continue
    const name = e.alias || e.discordNickName
    if (name) out.set(e.discordHandle, name)
  }
  return out
}

// 舊格式 { handle, alias, id } → 新結構。
// 舊的 alias 是「當時的顯示名」，歸入 discordNickName；alias 一律留空重新開始。
export function migrateEntry(raw: unknown): RosterEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Record<string, unknown>
  if (typeof e.discordHandle === 'string' && e.discordHandle) {
    return {
      discordHandle: e.discordHandle,
      discordNickName: typeof e.discordNickName === 'string' ? e.discordNickName : '',
      ...(typeof e.discordId === 'string' && e.discordId ? { discordId: e.discordId } : {}),
      ...(typeof e.alias === 'string' && e.alias ? { alias: e.alias } : {}),
    }
  }
  if (typeof e.handle === 'string' && e.handle) {
    return {
      discordHandle: e.handle,
      discordNickName: typeof e.alias === 'string' ? e.alias : '',
      ...(typeof e.id === 'string' && e.id ? { discordId: e.id } : {}),
    }
  }
  return null
}

export function migrateEntries(raw: unknown): RosterEntry[] {
  if (!Array.isArray(raw)) return []
  return raw.map(migrateEntry).filter((e): e is RosterEntry => e !== null)
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

// 舊格式項目：{ handle, alias, id }
function isLegacy(raw: unknown): boolean {
  return Array.isArray(raw) && raw.some((e) => !!e && typeof e === 'object' && 'handle' in e)
}

function loadCache(): RosterEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    const entries = migrateEntries(parsed)
    // 比照 records.ts 的做法：遷移過就立即寫回，否則每次開站都要重轉一次，
    // 而且「自行輸入」模式不抓網路，舊格式會永遠留在 localStorage 裡
    if (isLegacy(parsed)) localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    return entries
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
  // 舊格式（handle / alias）也吃得下，migrateEntry 會轉成新結構
  const entries = migrateEntries(data)
  if (data.length && !entries.length) {
    throw new Error('格式不對：每筆需含 discordHandle（或舊格式的 handle）字串欄位')
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
  return roster.value.map((e) => e.discordHandle).filter(Boolean)
}

// 有填 Discord 使用者 ID 的名冊項（handle → <@ID> 轉換用）
export function rosterMentions(): Array<{ handle: string; id: string }> {
  return roster.value
    .filter((e) => e.discordHandle && e.discordId)
    .map((e) => ({ handle: e.discordHandle, id: String(e.discordId) }))
}
