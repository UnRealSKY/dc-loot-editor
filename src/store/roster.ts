// 名冊的資料結構與純函式。狀態（有哪些群組、目前選哪個）在 store/groups.ts，
// 這裡不持有任何單例——名冊是「群組的一部分」，不是全域唯一的東西。

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

// 舊的名冊來源模式，只在遷移成群組時讀一次
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

// handle → 顯示名。沒有任何可讀名字的人不進表，呼叫端會退回顯示 handle。
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

// 抓取並驗證名冊 JSON（設定頁的 URL 模式用）；格式不對會拋錯
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
