<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { scanHpBar, readRatioIn, type Rect } from '../hp/scan'
import {
  pushPoint,
  recentDps,
  pushDps,
  peakDps,
  etaSeconds,
  type HpPoint,
  type DpsSample,
} from '../hp/history'
import { elapsedText } from '../hp/thresholds'
import { setHpNow, clearHpNow } from '../hp/current'

// 掃描頻率。血條變化不需要每幀讀，一秒一次就夠，
// 而且瀏覽器切到背景時 setInterval 本來就會被壓到一秒一次。
const SCAN_MS = 1000
// 只掃畫面上方——血條固定在最上方，掃整張是白費力氣
const TOP_FRAC = 0.2

const video = document.createElement('video')
video.muted = true
video.playsInline = true

const canvas = document.createElement('canvas')
const stream = shallowRef<MediaStream | null>(null)
const capturing = computed(() => stream.value != null)
const error = ref('')

const ratio = ref<number | null>(null)
const color = ref<string | null>(null)
const nextColor = ref<string | null>(null)
const points = ref<HpPoint[]>([])
const dpsSamples = ref<DpsSample[]>([])
const manualRect = ref<Rect | null>(null) // 手動框選（存畫面比例，視窗大小變了也還能用）
const lastFrame = ref('') // 框選時要有一張畫面可以拖
const picking = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

async function start() {
  error.value = ''
  try {
    const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
    stream.value = s
    video.srcObject = s
    await video.play()
    s.getVideoTracks()[0].addEventListener('ended', stop)
    timer = setInterval(scan, SCAN_MS)
    scan()
  } catch (e) {
    // 使用者自己按取消不算錯誤，不用跳訊息
    error.value = e instanceof Error && e.name === 'NotAllowedError' ? '' : '無法擷取畫面'
  }
}

function stop() {
  clearHpNow()
  clearInterval(timer)
  timer = undefined
  stream.value?.getTracks().forEach((t) => t.stop())
  stream.value = null
  video.srcObject = null
  picking.value = false
}

function grab(): { data: Uint8ClampedArray; width: number; height: number } | null {
  const w = video.videoWidth
  const h = Math.round(video.videoHeight * TOP_FRAC)
  if (!w || !h) return null
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, w, h, 0, 0, w, h)
  return { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h }
}

function scan() {
  const frame = grab()
  if (!frame) return
  const rect = manualRect.value ? toPixels(manualRect.value, frame.width, frame.height) : null
  const res = rect
    ? { ...readRatioIn(frame.data, frame.width, rect), rect }
    : scanHpBar(frame.data, frame.width, frame.height, { topFrac: 1 })
  if (!res || res.total === 0) {
    ratio.value = null
    clearHpNow()
    return
  }
  ratio.value = res.ratio
  color.value = res.color
  nextColor.value = res.nextColor
  const at = Date.now()
  points.value = pushPoint(points.value, at, res.ratio, res.color)
  const speed = recentDps(points.value)
  // 樣本帶著血條顏色，峰值才不會混到別的階段
  if (speed != null) dpsSamples.value = pushDps(dpsSamples.value, at, speed, res.color)
  // 血量門檻的機制面板讀的是這份
  setHpNow(res.ratio * 100, speed, at)
}

// 手動框選存的是比例，換個視窗大小也不用重框
function toPixels(r: Rect, w: number, h: number): Rect {
  return {
    x0: Math.round(r.x0 * w),
    x1: Math.round(r.x1 * w),
    y0: Math.round(r.y0 * h),
    y1: Math.round(r.y1 * h),
  }
}

function startPicking() {
  if (!grab()) return
  lastFrame.value = canvas.toDataURL('image/png')
  picking.value = true
}

// 在畫面快照上拖出血條範圍
const dragFrom = ref<{ x: number; y: number } | null>(null)
const dragTo = ref<{ x: number; y: number } | null>(null)
function pos(e: PointerEvent) {
  const b = (e.currentTarget as HTMLElement).getBoundingClientRect()
  return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height }
}
function onDown(e: PointerEvent) {
  dragFrom.value = pos(e)
  dragTo.value = dragFrom.value
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onMove(e: PointerEvent) {
  if (dragFrom.value) dragTo.value = pos(e)
}
function onUp() {
  const a = dragFrom.value
  const b = dragTo.value
  dragFrom.value = null
  if (!a || !b) return
  const rect = {
    x0: Math.min(a.x, b.x),
    x1: Math.max(a.x, b.x),
    y0: Math.min(a.y, b.y),
    y1: Math.max(a.y, b.y),
  }
  if (rect.x1 - rect.x0 < 0.05 || rect.y1 - rect.y0 < 0.01) return // 手滑點一下不算框
  manualRect.value = rect
  picking.value = false
  scan()
}

function autoAgain() {
  manualRect.value = null
  scan()
}

const dragBox = computed(() => {
  const a = dragFrom.value
  const b = dragTo.value
  if (!a || !b) return null
  return {
    left: `${Math.min(a.x, b.x) * 100}%`,
    top: `${Math.min(a.y, b.y) * 100}%`,
    width: `${Math.abs(a.x - b.x) * 100}%`,
    height: `${Math.abs(a.y - b.y) * 100}%`,
  }
})

const percent = computed(() => (ratio.value == null ? null : Math.round(ratio.value * 1000) / 10))
// 沒在掉血時顯示 0.0%，不要整個消失——不然會以為功能壞了。
// 回血已經在 recentDps 裡忽略掉了，這裡不會拿到負數
const round1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10)
const dps = computed(() => round1(recentDps(points.value)))
// 機制打斷、跑位、王無敵都會讓當下速度掉下來，峰值才看得出打得順時有多快
// 照目前的 DPS 還要打多久
const eta = computed(() => {
  const sec = etaSeconds(percent.value, dps.value)
  return sec == null ? null : elapsedText(sec * 1000)
})
// 只看目前這條血（左邊那段的顏色）；右邊那段是已經打掉後露出的下一條底色，不能拿來算
const peak60 = computed(() => round1(peakDps(dpsSamples.value, 60_000, color.value)))
const peakAll = computed(() => round1(peakDps(dpsSamples.value, undefined, color.value)))
const fillColor = computed(() => `rgb(${color.value ?? '200,40,40'})`)
// 右邊剩下的：多條血時是下一條的底色，最後一條時就留空（灰槽）
const restColor = computed(() => (nextColor.value ? `rgb(${nextColor.value})` : 'transparent'))

onBeforeUnmount(stop)
</script>

<template>
  <div class="card hp-card">
    <div class="section-head">
      <h3>王血量</h3>
      <span v-if="capturing && manualRect" class="chip chip-pending">手動範圍</span>
      <div class="spacer" />
      <template v-if="capturing">
        <button type="button" class="btn btn-sm" @click="startPicking">框選血條</button>
        <button v-if="manualRect" type="button" class="btn btn-sm" @click="autoAgain">自動偵測</button>
        <button v-if="points.length" type="button" class="btn btn-sm"
          @click="points = []; dpsSamples = []">清除紀錄</button>
        <button type="button" class="btn btn-sm" @click="stop">停止</button>
      </template>
      <button v-else type="button" class="btn btn-sm btn-primary" @click="start">擷取畫面</button>
    </div>

    <p v-if="error" class="muted err">{{ error }}</p>

    <template v-if="capturing">
      <p v-if="percent == null" class="muted no-bar">找不到血條，可以用「框選血條」直接指定範圍</p>
      <template v-else>
        <div class="hp-bar" :style="{ background: restColor }">
          <div class="hp-bar-fill" :style="{ width: `${(ratio ?? 0) * 100}%`, background: fillColor }" />
        </div>
        <div class="hp-row">
          <div class="hp-percent">{{ percent.toFixed(1) }}<span class="unit">%</span></div>
          <span v-if="eta" class="chip chip-eta">預估 {{ eta }}</span>
          <div v-if="dps != null" class="hp-dps">
            DPS {{ dps.toFixed(1) }}%
            <span v-if="peak60 != null" class="peak">60秒最高 {{ peak60.toFixed(1) }}%</span>
            <span v-if="peakAll != null" class="peak">整場最高 {{ peakAll.toFixed(1) }}%</span>
          </div>
        </div>
      </template>
    </template>

    <div v-if="picking" class="overlay" @click.self="picking = false">
      <div class="pick-dialog">
        <h3>拖出血條範圍</h3>
        <div class="pick-canvas" @pointerdown.prevent="onDown" @pointermove="onMove" @pointerup="onUp">
          <img :src="lastFrame" alt="" />
          <div v-if="dragBox" class="pick-box" :style="dragBox" />
        </div>
        <div class="pick-actions">
          <button type="button" class="btn btn-ghost" @click="picking = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hp-card { margin-bottom: 12px; }
.section-head { display: flex; align-items: center; gap: 8px; }
.section-head h3 { margin: 0; }
.section-head .spacer { flex: 1; }
.no-bar, .err { margin: 0; font-size: 13px; }

.hp-bar {
  display: flex; height: 18px; border-radius: 999px; overflow: hidden;
  background: var(--surface-2); border: 1px solid var(--border);
}
.hp-bar-fill { height: 100%; }
.hp-row { display: flex; align-items: baseline; gap: 10px; margin-top: 8px; flex-wrap: nowrap; }
/* 位數變動時版面不能跟著跳，所以固定字寬：最長就是 100.0 */
.hp-percent {
  font-size: 44px; font-weight: 800; line-height: 1;
  font-variant-numeric: tabular-nums; font-family: var(--mono); letter-spacing: -1px;
  flex: none; min-width: 5ch; text-align: right;
}
.hp-percent .unit { font-size: 18px; font-weight: 600; margin-left: 2px; }
.hp-dps {
  display: flex; align-items: baseline; gap: 10px; flex-wrap: nowrap; min-width: 0;
  font-size: 12.5px; color: var(--text-muted);
  font-variant-numeric: tabular-nums; font-family: var(--mono);
}
.peak { color: var(--primary); font-weight: 650; }
.chip-eta {
  background: var(--primary-soft); color: var(--primary);
  font-family: var(--mono); font-variant-numeric: tabular-nums; flex: none;
}

.pick-dialog {
  background: var(--surface); border-radius: var(--radius); padding: 16px;
  max-width: min(920px, 92vw); box-shadow: var(--shadow-md);
}
.pick-dialog h3 { margin: 0 0 10px; }
.pick-canvas { position: relative; cursor: crosshair; touch-action: none; }
.pick-canvas img { display: block; width: 100%; user-select: none; }
.pick-box { position: absolute; border: 2px solid var(--primary); background: var(--primary-soft); opacity: .55; }
.pick-actions { display: flex; justify-content: flex-end; margin-top: 12px; }
</style>
