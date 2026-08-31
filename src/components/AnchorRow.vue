<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { anchorRef, setAnchor, calibrateAnchor, gameClock } from '../boss/anchor'
import { grabFrame, isCapturing } from '../hp/capture'
import { readTimer } from '../hp/timer'

// 遊戲計時對齊。對齊點是全站共用的，所以這一列可以擺在任何地方，
// 在哪邊對齊、在哪邊校準都算數。
const gameInput = ref('')
const anchor = anchorRef()
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
// 時鐘只到秒，不需要每幀更新
onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 200)))
onBeforeUnmount(() => clearInterval(timer))

function apply() {
  setAnchor(gameInput.value, Date.now())
}

// 從遊戲畫面把「剩餘時間」讀出來，等於幫使用者把數字打進去再按對齊。
// 讀的是「王血量」那張卡已經在分享的畫面，不用再分享一次。
// 計時器可以被拖到任何位置，所以是掃整張畫面。
const syncing = ref(false)
const syncFailed = ref(false)
function syncFromScreen() {
  syncFailed.value = false
  const frame = grabFrame(1)
  const read = frame ? readTimer(frame.data, frame.width, frame.height) : null
  if (!read) {
    syncFailed.value = true
    syncing.value = false
    return
  }
  gameInput.value = read.text
  setAnchor(read.text, Date.now())
  syncing.value = true
  setTimeout(() => (syncing.value = false), 1500)
}
const clock = computed(() => gameClock(now.value))
</script>

<template>
  <div class="anchor-row">
    <input v-model="gameInput" class="anchor-input" placeholder="mm:ss" spellcheck="false"
      @keyup.enter="apply" />
    <button type="button" class="btn btn-sm" @click="apply">對齊</button>
    <button type="button" class="btn btn-sm" :class="{ ok: syncing, fail: syncFailed }"
      :disabled="!isCapturing()" title="讀取遊戲畫面上的剩餘時間並直接對齊"
      @click="syncFromScreen">
      {{ syncFailed ? '讀不到' : syncing ? '✓ 已同步' : '從畫面同步' }}
    </button>
    <template v-if="anchor">
      <button type="button" class="btn btn-sm" title="校準 -1 秒" @click="calibrateAnchor(-1)">−1s</button>
      <button type="button" class="btn btn-sm" title="校準 +1 秒" @click="calibrateAnchor(1)">＋1s</button>
      <span class="game-clock">{{ clock }}</span>
    </template>
  </div>
</template>

<style scoped>
.ok { border-color: var(--success); color: var(--success); }
.fail { border-color: var(--danger); color: var(--danger); }
</style>
