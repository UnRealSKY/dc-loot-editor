// 目前選的王。獨立成一個檔案，讓門檻偵測不必 import 整個 session（會互相打結）。

import { ref, watch } from 'vue'
import { bossById } from './bosses'
import { BOSS_KEY } from '../storageKeys'

export const bossId = ref(bossById(localStorage.getItem(BOSS_KEY) ?? '').id)
watch(bossId, (v) => localStorage.setItem(BOSS_KEY, v))
