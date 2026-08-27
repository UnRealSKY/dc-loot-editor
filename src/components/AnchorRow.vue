<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { anchorRef, setAnchor, calibrateAnchor, gameClock } from '../shield/anchor'

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
const clock = computed(() => gameClock(now.value))
</script>

<template>
  <div class="anchor-row">
    <input v-model="gameInput" class="anchor-input" placeholder="mm:ss" spellcheck="false"
      @keyup.enter="apply" />
    <button type="button" class="btn btn-sm" @click="apply">對齊</button>
    <template v-if="anchor">
      <button type="button" class="btn btn-sm" title="校準 -1 秒" @click="calibrateAnchor(-1)">−1s</button>
      <button type="button" class="btn btn-sm" title="校準 +1 秒" @click="calibrateAnchor(1)">＋1s</button>
      <span class="game-clock">{{ clock }}</span>
    </template>
  </div>
</template>
