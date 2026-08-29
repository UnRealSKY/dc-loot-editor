// 跨面板共用的偏好。獨立成一個檔案是為了避免相依打結：
// session 與門檻偵測都要看聲音開關，但它們之間不該互相 import。

import { ref, watch } from 'vue'

const SOUND_KEY = 'dc-shield-sound'

export const soundOn = ref(localStorage.getItem(SOUND_KEY) !== 'off')
watch(soundOn, (v) => localStorage.setItem(SOUND_KEY, v ? 'on' : 'off'))
