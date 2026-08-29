// 全站共用的「現在」。面板、門檻判定、循環倒數都讀它，
// 各自呼叫 Date.now() 的話會差個幾百毫秒，顯示出來就是差一秒。

import { ref } from 'vue'

export const now = ref(Date.now())

/** 取得現在並同步共用時鐘；發生事件的當下要用它，倒數才不會先閃一個差一秒的數字 */
export function touchNow(t = Date.now()): number {
  now.value = t
  return t
}
