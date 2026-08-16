// DC 群組：一個群組＝一套設定集（名稱、群組 hook、名單）。
//
// 分寶紀錄綁定群組（LootRecord.groupId），發佈／同步用該群組的 webhook，
// 顯示名字用該群組的名冊——discordNickName 是伺服器暱稱，同一個人在不同
// 伺服器本來就可能不同名。

import { ref } from 'vue'
import {
  buildAliasMap,
  fetchRoster,
  loadListSource,
  migrateEntries,
  type ListSource,
  type RosterEntry,
} from './roster'

const GROUPS_KEY = 'dc-groups'
const ACTIVE_KEY = 'dc-active-group'
// 遷移來源（舊的單一設定）
const LEGACY_WEBHOOK_KEY = 'dc-webhook-url'
const LEGACY_ROSTER_KEY = 'dc-loot-roster'
const LEGACY_SOURCE_KEY = 'dc-roster-source'

// 舊的「預設來源」＝跟隨官方 repo，遷移後等價於指向這個網址的 url 模式
export const DEFAULT_ROSTER_URL =
  'https://raw.githubusercontent.com/UnRealSKY/dc-loot-editor/main/members.json'

export type RosterMode = 'url' | 'local'

export interface DcGroup {
  id: string
  name: string
  webhookUrl: string
  rosterMode: RosterMode
  rosterUrl?: string // url 模式的來源
  enableLeaderFee?: boolean // 是否啟用團長辛苦費（未設＝啟用，維持既有行為）
  roster: RosterEntry[] // url 模式時是快取
}

function newId(): string {
  return crypto.randomUUID()
}

// ---- 純函式（可單元測試）----

export interface MigrateInput {
  stored: unknown
  // 舊版的三個 key 是否真的存在。loadListSource 找不到時會回 { mode: 'default' }，
  // 光看 legacySource 分不出「使用者選過預設來源」與「全新使用者什麼都沒有」
  hasLegacy: boolean
  legacyWebhook: string
  legacyRoster: RosterEntry[]
  legacySource: ListSource
}

function isGroup(raw: unknown): raw is DcGroup {
  if (!raw || typeof raw !== 'object') return false
  const g = raw as Record<string, unknown>
  return typeof g.id === 'string' && !!g.id && typeof g.name === 'string' && !!g.name
}

// 已有群組資料就原樣沿用；否則把舊的單一 webhook／名冊／來源合成第一個群組
export function migrateGroups(input: MigrateInput): DcGroup[] {
  if (Array.isArray(input.stored)) {
    const valid = input.stored.filter(isGroup).map((g) => ({
      ...g,
      webhookUrl: typeof g.webhookUrl === 'string' ? g.webhookUrl : '',
      rosterMode: g.rosterMode === 'local' ? 'local' : ('url' as RosterMode),
      roster: Array.isArray(g.roster) ? migrateEntries(g.roster) : [],
    }))
    if (valid.length) return valid
  }

  // 全新使用者：給一個空群組。沒設過任何東西就不該自動跟隨官方 repo，
  // 那是取名「贖罪券」才做的事
  if (!input.hasLegacy) {
    return [{ id: newId(), name: '我的公會', webhookUrl: '', rosterMode: 'local', roster: [] }]
  }

  const { legacySource } = input
  const local = legacySource.mode === 'local'
  return [
    {
      id: newId(),
      name: '我的公會',
      webhookUrl: input.legacyWebhook,
      rosterMode: local ? 'local' : 'url',
      // 舊的 default 模式沒存網址，補上官方 repo 的位址，行為與先前一致
      ...(local ? {} : { rosterUrl: legacySource.url || DEFAULT_ROSTER_URL }),
      roster: input.legacyRoster,
    },
  ]
}

export function addGroup(groups: DcGroup[], name: string): DcGroup[] {
  return [
    ...groups,
    { id: newId(), name, webhookUrl: '', rosterMode: 'local', roster: [] },
  ]
}

export function updateGroup(groups: DcGroup[], id: string, part: Partial<DcGroup>): DcGroup[] {
  return groups.map((g) => (g.id === id ? { ...g, ...part, id: g.id } : g))
}

// 不允許刪到一個都不剩，否則設定頁會變成空白、紀錄也無處可綁
export function removeGroup(groups: DcGroup[], id: string): DcGroup[] {
  if (groups.length <= 1) return groups
  return groups.filter((g) => g.id !== id)
}

// 隱藏捷徑：群組取這個名字，名單自動接上本 repo 的 members.json，
// 不必自己去貼網址。回傳同一個物件代表沒有變動（呼叫端據此判斷要不要重抓）。
export const MAGIC_GROUP_NAME = '贖罪券'

export function applyMagicRoster(group: DcGroup): DcGroup {
  if (group.name.trim() !== MAGIC_GROUP_NAME) return group
  if (group.rosterMode === 'url' && group.rosterUrl === DEFAULT_ROSTER_URL) return group
  return { ...group, rosterMode: 'url', rosterUrl: DEFAULT_ROSTER_URL }
}

// 辛苦費開關。未設定＝啟用，既有群組不必特地補這個欄位就維持原本行為。
export function leaderFeeEnabled(group: DcGroup | undefined): boolean {
  return group?.enableLeaderFee !== false
}

// 綁在某群組的紀錄數。沒設 groupId 的舊紀錄算在第一個群組頭上——
// 它們實際上就是用那個群組的 webhook 與名冊。
export function countRecordsIn(
  records: Array<{ groupId?: string }>,
  groups: DcGroup[],
  id: string,
): number {
  const fallback = groups[0]?.id
  return records.filter((r) => (r.groupId ?? fallback) === id).length
}

// 找不到或沒指定時退回第一個群組——舊紀錄沒有 groupId，就屬於遷移出來的那個
export function groupById(groups: DcGroup[], id: string | undefined): DcGroup | undefined {
  return (id ? groups.find((g) => g.id === id) : undefined) ?? groups[0]
}

// 在指定群組的名冊裡查顯示名；查不到就顯示原 handle
export function nameIn(groups: DcGroup[], groupId: string | undefined, handle: string): string {
  return aliasIn(groups, groupId, handle) ?? handle
}

export function aliasIn(
  groups: DcGroup[],
  groupId: string | undefined,
  handle: string,
): string | undefined {
  const g = groupById(groups, groupId)
  if (!g) return undefined
  return buildAliasMap(g.roster).get(handle)
}

// ---- 響應式單例 ----

function loadGroups(): DcGroup[] {
  let stored: unknown = null
  try {
    stored = JSON.parse(localStorage.getItem(GROUPS_KEY) ?? 'null')
  } catch {
    // 壞資料走遷移路徑
  }
  let legacyRoster: RosterEntry[] = []
  try {
    legacyRoster = migrateEntries(JSON.parse(localStorage.getItem(LEGACY_ROSTER_KEY) ?? '[]'))
  } catch {
    // 沒有舊名冊就空的
  }
  const groups = migrateGroups({
    stored,
    hasLegacy: [LEGACY_WEBHOOK_KEY, LEGACY_ROSTER_KEY, LEGACY_SOURCE_KEY].some(
      (k) => localStorage.getItem(k) !== null,
    ),
    legacyWebhook: localStorage.getItem(LEGACY_WEBHOOK_KEY) ?? '',
    legacyRoster,
    legacySource: loadListSource(LEGACY_SOURCE_KEY),
  })
  // 比照 records.ts：遷移過就立即寫回，不然每次開站都要重來一次
  if (!Array.isArray(stored)) localStorage.setItem(GROUPS_KEY, JSON.stringify(groups))
  return groups
}

const groups = ref<DcGroup[]>(loadGroups())
const activeId = ref<string>(
  localStorage.getItem(ACTIVE_KEY) || groups.value[0]?.id || '',
)

function persist(): void {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups.value))
}

export function useGroups() {
  return { groups, activeId }
}

export function activeGroup(): DcGroup | undefined {
  return groupById(groups.value, activeId.value)
}

export function setActiveGroup(id: string): void {
  activeId.value = id
  localStorage.setItem(ACTIVE_KEY, id)
}

export function createGroup(name: string): DcGroup {
  groups.value = addGroup(groups.value, name)
  const created = groups.value[groups.value.length - 1]
  persist()
  setActiveGroup(created.id)
  // 空更新只為了走 patchGroup 裡的 applyMagicRoster——直接用魔法名字建立時也要接上名冊
  patchGroup(created.id, {})
  return groups.value.find((g) => g.id === created.id) ?? created
}

export function patchGroup(id: string, part: Partial<DcGroup>): void {
  groups.value = updateGroup(groups.value, id, part)
  const g = groups.value.find((x) => x.id === id)
  const magic = g ? applyMagicRoster(g) : undefined
  // 取名「贖罪券」時自動接上本 repo 的名冊並立即抓一次；
  // 已經接好的情況 applyMagicRoster 回傳同一個物件，不會重複觸發
  if (g && magic && magic !== g) {
    groups.value = updateGroup(groups.value, id, magic)
    persist()
    void refreshRoster(id)
    return
  }
  persist()
}

// 重抓單一群組的名冊（url 模式才有作用）；失敗沿用既有快取
export async function refreshRoster(id: string): Promise<void> {
  const g = groups.value.find((x) => x.id === id)
  if (!g || g.rosterMode !== 'url' || !g.rosterUrl) return
  loading.value = true
  try {
    patchGroup(id, { roster: await fetchRoster(g.rosterUrl) })
  } catch {
    // 離線或抓取失敗：沿用快取
  } finally {
    loading.value = false
  }
}

export function deleteGroup(id: string): void {
  const next = removeGroup(groups.value, id)
  if (next === groups.value) return
  groups.value = next
  persist()
  if (activeId.value === id) setActiveGroup(next[0].id)
}

export function groupOf(groupId: string | undefined): DcGroup | undefined {
  return groupById(groups.value, groupId)
}

// 給 calc/format 用的選項：那兩層是純函式，開關由這裡查好再傳進去
export function distOptionsFor(groupId: string | undefined) {
  return { leaderFeeEnabled: leaderFeeEnabled(groupOf(groupId)) }
}

// 顯示用名稱：依紀錄所屬群組的名冊查，查不到就用原 handle
export function displayNameIn(groupId: string | undefined, handle: string): string {
  return nameIn(groups.value, groupId, handle)
}

export function aliasOfIn(groupId: string | undefined, handle: string): string | undefined {
  return aliasIn(groups.value, groupId, handle)
}

export function rosterHandlesIn(groupId: string | undefined): string[] {
  return (groupOf(groupId)?.roster ?? []).map((e) => e.discordHandle).filter(Boolean)
}

// 有填 Discord 使用者 ID 的名冊項（handle → <@ID> 轉換用）
export function mentionsIn(groupId: string | undefined): Array<{ handle: string; id: string }> {
  return (groupOf(groupId)?.roster ?? [])
    .filter((e) => e.discordHandle && e.discordId)
    .map((e) => ({ handle: e.discordHandle, id: String(e.discordId) }))
}

// 名冊背景載入中（autocomplete 顯示「載入中」提示用）
const loading = ref(false)
export function rosterLoading() {
  return loading
}

// 開站呼叫一次：url 模式的群組在背景重抓名冊並回寫快取
export async function initGroups(): Promise<void> {
  const targets = groups.value.filter((g) => g.rosterMode === 'url' && g.rosterUrl)
  if (!targets.length) return
  loading.value = true
  try {
    await Promise.all(
      targets.map(async (g) => {
        try {
          patchGroup(g.id, { roster: await fetchRoster(g.rosterUrl!) })
        } catch {
          // 離線或抓取失敗：沿用快取
        }
      }),
    )
  } finally {
    loading.value = false
  }
}
