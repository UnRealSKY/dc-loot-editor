import { ref } from 'vue'

const STORAGE_KEY = 'dc-loot-items'
// 執行期直讀 repo 的共用品名清單：更新只需 push git（改 items.json），不必發版。
const RAW_URL = 'https://raw.githubusercontent.com/UnRealSKY/dc-loot-editor/main/items.json'

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

// 開站呼叫一次：先用快取，背景再從 raw 更新並回寫
export async function initSharedItems(): Promise<void> {
  try {
    const res = await fetch(RAW_URL, { cache: 'no-cache' })
    if (!res.ok) return
    const names = onlyStrings(await res.json())
    items.value = names
    localStorage.setItem(STORAGE_KEY, JSON.stringify(names))
  } catch {
    // 離線或抓取失敗：沿用快取
  }
}

export function sharedItemNames(): string[] {
  return items.value
}
