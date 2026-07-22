import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useRecordsStore } from './records'
import { rosterHandles } from './roster'

function uniqueByFrequency(values: string[]): string[] {
  const freq = new Map<string, number>()
  for (const v of values) {
    if (!v) continue
    freq.set(v, (freq.get(v) ?? 0) + 1)
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v)
}

export interface PriceSuggestion {
  price: number
  date: string
}

export function useHistory() {
  const store = useRecordsStore()

  const itemNames: ComputedRef<string[]> = computed(() =>
    uniqueByFrequency(store.records.flatMap((r) => r.lootItems.map((it) => it.name))),
  )

  // 建議 = 共用名冊 handle ∪ 本機歷史 handle（名冊優先列前）
  const handles: ComputedRef<string[]> = computed(() =>
    uniqueByFrequency([
      ...rosterHandles(),
      ...store.records.flatMap((r) => r.members.map((m) => m.handle)),
    ]),
  )

  const bosses: ComputedRef<string[]> = computed(() =>
    uniqueByFrequency(store.records.map((r) => r.boss)),
  )

  function priceSuggestions(name: string): PriceSuggestion[] {
    const out: PriceSuggestion[] = []
    for (const r of store.records) {
      for (const it of r.lootItems) {
        if (it.name === name && it.unitPrice != null) {
          out.push({ price: it.unitPrice, date: r.date })
        }
      }
    }
    return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }

  return { itemNames, handles, bosses, priceSuggestions }
}
