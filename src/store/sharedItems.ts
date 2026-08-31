import { ref } from 'vue'
import { loadListSource, type ListSource } from './roster'

const STORAGE_KEY = 'dc-loot-items'
const SOURCE_KEY = 'dc-items-source'
// 執行期直讀 repo 的共用品名清單：更新只需 push git（改 items.json），不必發版。
const RAW_URL = 'https://raw.githubusercontent.com/UnRealSKY/boss-toolkit/main/items.json'

function onlyStrings(data: unknown): string[] {
  return Array.isArray(data) ? data.filter((x): x is string => typeof x === 'string') : []
}

function loadCache(): string[] {
  try {
    return onlyStrings(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'))
  } catch {
    return []
  }
}

const items = ref<string[]>(loadCache())
const source = ref<ListSource>(loadListSource(SOURCE_KEY))

export function itemsSource() {
  return source
}

export function setItemsSource(s: ListSource): void {
  source.value = s
  localStorage.setItem(SOURCE_KEY, JSON.stringify(s))
}

// 共用品名清單背景載入中（autocomplete 顯示「載入中」提示用）
const loading = ref(false)
export function sharedItemsLoading() {
  return loading
}

// 抓取並驗證品名 JSON（管理頁「自訂 URL」驗證也用這支）；格式不對會拋錯
export async function fetchItems(url: string): Promise<string[]> {
  const res = await fetch(url, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`抓取失敗（HTTP ${res.status}）`)
  const data = await res.json().catch(() => null)
  if (!Array.isArray(data)) throw new Error('格式不對：內容必須是 JSON 陣列')
  const names = onlyStrings(data)
  if (data.length && !names.length) throw new Error('格式不對：陣列內容必須是字串品名')
  return names
}

// 本機自訂模式的儲存（管理頁編輯用）
export function saveItemsLocal(names: string[]): void {
  items.value = names
  localStorage.setItem(STORAGE_KEY, JSON.stringify(names))
}

// 開站呼叫一次：先用快取，背景再依來源模式更新並回寫
export async function initSharedItems(): Promise<void> {
  const s = source.value
  if (s.mode === 'local') return // 本機自訂：不抓網路
  const url = s.mode === 'url' && s.url ? s.url : RAW_URL
  loading.value = true
  try {
    saveItemsLocal(await fetchItems(url))
  } catch {
    // 離線或抓取失敗：沿用快取
  } finally {
    loading.value = false
  }
}

export function sharedItemNames(): string[] {
  return items.value
}
