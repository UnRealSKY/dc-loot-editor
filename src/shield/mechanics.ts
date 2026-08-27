// 機制模板：一份模板＝一套節奏規則（狀態機＋參數欄位），王只提供各自的秒數。
// 目前只有「反盾」一種，engine.ts 的狀態機就是它；日後新增機制時，
// 這裡多一筆，王指到新的 mechanic，兩邊各自的參數就不會互相打架。

export interface Mechanic {
  id: string
  name: string
}

export const MECHANICS: Mechanic[] = [
  { id: 'shield', name: '反盾' }, // 反盾持續／間隔的階段循環（engine.ts）
  { id: 'cycle', name: '循環' }, // 多個各自固定間隔的機制，只算多久觸發一次（cycle.ts）
  { id: 'hp', name: '血量' }, // 看的不是時間而是血量，掉到門檻就出招（hp/thresholds.ts）
]

export const DEFAULT_MECHANIC = MECHANICS[0]

// 找不到就退回預設模板——存在 localStorage 的舊值或手改的值不該讓頁面壞掉
export function mechanicById(id: string): Mechanic {
  return MECHANICS.find((m) => m.id === id) ?? DEFAULT_MECHANIC
}
