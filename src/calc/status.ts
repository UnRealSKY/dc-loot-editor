import type { LootRecord } from '../types'

// 是否全數賣出：沒有「待售」項目（售出/不計入皆視為已處理）
export function allSold(r: LootRecord): boolean {
  return r.lootItems.length > 0 && !r.lootItems.some((it) => it.status === 'cart')
}

// 是否已把錢交給所有團員：所有團員皆已結清
export function allSettled(r: LootRecord): boolean {
  return r.members.length > 0 && r.members.every((m) => m.settle === 'settled')
}
