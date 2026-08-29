<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  capturing,
  error,
  ratio,
  color,
  nextColor,
  points,
  manualRect,
  percent,
  dps,
  peak60,
  peakAll,
  etaSec,
  startCapture,
  stopCapture,
  clearHistory,
  useManualRect,
  grabFrame,
} from '../hp/capture'
import { elapsedText } from '../hp/thresholds'

// 這張卡會同時出現在主視窗與抬頭顯示，狀態全在 hp/capture 那一份，
// 這裡只負責畫出來與接操作。
const picking = ref(false)
const lastFrame = ref('')

function startPicking() {
  const frame = grabFrame(0.2)
  if (!frame) return
  lastFrame.value = frame.toDataURL()
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
  useManualRect(rect)
  picking.value = false
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

const eta = computed(() => (etaSec.value == null ? null : elapsedText(etaSec.value * 1000)))
const fillColor = computed(() => `rgb(${color.value ?? '200,40,40'})`)
// 右邊剩下的：多條血時是下一條的底色，最後一條時就留空（灰槽）
const restColor = computed(() => (nextColor.value ? `rgb(${nextColor.value})` : 'transparent'))
</script>

<template>
  <div class="card hp-card">
    <div class="section-head">
      <h3>王血量</h3>
      <span v-if="capturing && manualRect" class="chip chip-pending">手動範圍</span>
      <div class="spacer" />
      <template v-if="capturing">
        <button type="button" class="btn btn-sm" @click="startPicking">框選血條</button>
        <button v-if="manualRect" type="button" class="btn btn-sm" @click="useManualRect(null)">自動偵測</button>
        <button v-if="points.length" type="button" class="btn btn-sm"
          @click="clearHistory()">清除紀錄</button>
        <button type="button" class="btn btn-sm" @click="stopCapture()">停止</button>
      </template>
      <button v-else type="button" class="btn btn-sm btn-primary" @click="startCapture()">擷取畫面</button>
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
            <span class="stat"><i>DPS</i><b>{{ dps.toFixed(1) }}%</b></span>
            <span v-if="peak60 != null" class="stat"><i>60秒最高</i><b>{{ peak60.toFixed(1) }}%</b></span>
            <span v-if="peakAll != null" class="stat"><i>整場最高</i><b>{{ peakAll.toFixed(1) }}%</b></span>
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
/* 不同統計之間拉開，標籤與自己的數字貼緊——間距一樣寬就看不出數字屬於誰 */
.hp-dps {
  display: flex; align-items: baseline; gap: 20px; flex-wrap: nowrap; min-width: 0;
  font-size: 12.5px; font-variant-numeric: tabular-nums; font-family: var(--mono);
}
.stat { display: inline-flex; align-items: baseline; gap: 4px; }
.stat i { font-style: normal; color: var(--text-muted); }
.stat b { font-weight: 700; color: var(--text); }
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
