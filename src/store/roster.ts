import { ref } from 'vue'

export interface RosterEntry {
  handle: string
  alias: string
}

const STORAGE_KEY = 'dc-loot-roster'
// 執行期直讀 repo 上的名冊：更新名冊只需 push git（改 members.json），不必發版部署。
const RAW_URL = 'https://raw.githubusercontent.com/UnRealSKY/dc-loot-editor/main/members.json'

// ---- 純函式（可單元測試）----
export function buildAliasMap(entries: RosterEntry[]): Map<string, string> {
  return new Map(entries.filter((e) => e && e.handle && e.alias).map((e) => [e.handle, e.alias]))
}

// ---- 響應式單例 ----
const roster = ref<RosterEntry[]>(loadCache())
const aliasMap = ref<Map<string, string>>(buildAliasMap(roster.value))

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

// 開站呼叫一次：先用 localStorage 快取即時顯示，背景再從 raw 更新並回寫快取
export async function initRoster(): Promise<void> {
  try {
    const res = await fetch(RAW_URL, { cache: 'no-cache' })
    if (!res.ok) return
    const data = await res.json()
    if (Array.isArray(data)) {
      setRoster(data)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
  } catch {
    // 離線或抓取失敗：沿用 localStorage 快取
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
