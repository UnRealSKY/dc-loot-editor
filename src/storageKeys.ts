// 這個站在瀏覽器裡存了什麼、叫什麼名字，全部在這一支。
//
// 集中的理由是「改名搬遷」需要一個保證會先跑到的位置：各模組是在載入當下就讀
// localStorage，只要 key 都跟這裡拿，ES module 的相依順序就會逼這支先跑完，
// 不必靠 main.ts 的 import 排序（那太容易被人順手改掉）。
// 順帶讓前綴規則一眼看得出來——兩個工具箱各一組，不再混用。

const BOSS = 'maplestory-boss-toolkit-'
export const BOSS_KEY = `${BOSS}boss`
export const SOUND_KEY = `${BOSS}sound`
export const OVERRIDES_KEY = `${BOSS}overrides`
export const DISPEL_KEY = `${BOSS}dispel`
export const HP_LEAD_KEY = `${BOSS}hp-lead`

const LOOT = 'dc-loot-'
export const RECORDS_KEY = `${LOOT}records`
export const MIGRATION_KEY = `${LOOT}migration`
export const ITEMS_KEY = `${LOOT}items`
export const ITEMS_SOURCE_KEY = `${LOOT}items-source`
export const GROUPS_KEY = `${LOOT}groups`
export const ACTIVE_GROUP_KEY = `${LOOT}active-group`

// 舊名字 → 新名字。開頁面時搬一次就把舊的清掉，使用者什麼都不用做。
// groups.ts 那三個 legacy key 不在這裡：它們是「有沒有更早版本的資料」的判斷依據，
// 改名等於讓那段遷移永遠偵測不到。
const RENAMED: Array<[string, string]> = [
  ['dc-shield-boss', BOSS_KEY],
  ['dc-shield-sound', SOUND_KEY],
  ['dc-shield-overrides', OVERRIDES_KEY],
  ['dc-shield-dispel', DISPEL_KEY],
  ['dc-hp-lead', HP_LEAD_KEY],
  ['dc-groups', GROUPS_KEY],
  ['dc-active-group', ACTIVE_GROUP_KEY],
  ['dc-items-source', ITEMS_SOURCE_KEY],
]

/** 把舊 key 的值搬到新 key。新的已經有值就不蓋——那是使用者在新版動過的 */
export function migrateRenamedKeys(): void {
  for (const [from, to] of RENAMED) {
    const value = localStorage.getItem(from)
    if (value === null) continue
    if (localStorage.getItem(to) === null) localStorage.setItem(to, value)
    localStorage.removeItem(from)
  }
}

migrateRenamedKeys()
