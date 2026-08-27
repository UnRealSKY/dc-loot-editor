<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { scanHpBar, readRatioIn, type Rect } from '../hp/scan'
import { pushPoint, sparklinePoints, recentDps, type HpPoint } from '../hp/history'

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
const colors = ref<string[]>([])
const points = ref<HpPoint[]>([])
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
    return
  }
  ratio.value = res.ratio
  colors.value = res.colors
  points.value = pushPoint(points.value, Date.now(), res.ratio)
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
const dps = computed(() => {
  const v = recentDps(points.value)
  return v == null || v <= 0 ? null : Math.round(v * 10) / 10
})
const curve = computed(() => sparklinePoints(points.value, 600, 100))
const barColors = computed(() => (colors.value.length ? colors.value : ['200,40,40']))

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
        <button v-if="points.length" type="button" class="btn btn-sm" @click="points = []">清除紀錄</button>
        <button type="button" class="btn btn-sm" @click="stop">停止</button>
      </template>
      <button v-else type="button" class="btn btn-sm btn-primary" @click="start">擷取畫面</button>
    </div>

    <p v-if="error" class="muted err">{{ error }}</p>

    <template v-if="capturing">
      <p v-if="percent == null" class="muted no-bar">找不到血條，可以用「框選血條」直接指定範圍</p>
      <template v-else>
        <div class="hp-row">
          <div class="hp-percent">{{ percent }}<span class="unit">%</span></div>
          <div class="hp-side">
            <div class="hp-bar">
              <div v-for="(c, i) in barColors" :key="i" class="hp-bar-fill"
                :style="{ width: `${((ratio ?? 0) * 100) / barColors.length}%`, background: `rgb(${c})` }" />
            </div>
            <div v-if="dps" class="hp-dps">每秒 {{ dps }}%</div>
          </div>
        </div>

        <svg v-if="curve" class="hp-curve" viewBox="0 0 600 100" preserveAspectRatio="none">
          <polyline :points="curve" />
        </svg>
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

.hp-row { display: flex; align-items: center; gap: 16px; }
.hp-percent {
  font-size: 44px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums;
  font-family: var(--mono); letter-spacing: -1px; flex: none;
}
.hp-percent .unit { font-size: 18px; font-weight: 600; margin-left: 2px; }
.hp-side { flex: 1; min-width: 0; }
.hp-bar {
  display: flex; height: 14px; border-radius: 999px; overflow: hidden;
  background: var(--surface-2); border: 1px solid var(--border);
}
.hp-bar-fill { height: 100%; }
.hp-dps { margin-top: 4px; font-size: 12.5px; color: var(--text-muted); font-variant-numeric: tabular-nums; }

.hp-curve { width: 100%; height: 60px; margin-top: 10px; display: block; }
.hp-curve polyline { fill: none; stroke: var(--danger); stroke-width: 2; vector-effect: non-scaling-stroke; }

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
