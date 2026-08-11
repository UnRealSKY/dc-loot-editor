<script setup lang="ts">
import { onBeforeUnmount, reactive, ref, watch } from 'vue'
import type { DcImage, DcImageKind, Member } from '../types'
import { displayNameIn } from '../store/groups'
import { getBlob, deleteBlob } from '../db/imageBlobs'
import { filesToImages, hoveredImageKind } from '../images'

const props = defineProps<{
  title: string
  kind: DcImageKind
  images: DcImage[] // 已過濾為本區 kind
  members?: Member[] // payout：團員選單
  groupId?: string // 顯示名字要用所屬群組的名冊
}>()
const emit = defineEmits<{
  add: [images: DcImage[]]
  update: [image: DcImage]
  remove: [id: string]
  refresh: [image: DcImage]
}>()

// ---- 本地 blob 預覽（object URL，卸載時釋放）----
const previews = reactive<Record<string, string>>({})
async function loadPreview(img: DcImage) {
  if (img.url || previews[img.id]) return
  const blob = await getBlob(img.id)
  if (blob) previews[img.id] = URL.createObjectURL(blob)
}
watch(
  () => props.images,
  (list) => list.forEach(loadPreview),
  { immediate: true, deep: true },
)
onBeforeUnmount(() => Object.values(previews).forEach((u) => URL.revokeObjectURL(u)))

// ---- 加入檔案（選檔／拖拉；貼上由編輯頁統一路由）----
async function addFiles(files: FileList | File[]) {
  const imgs = await filesToImages(Array.from(files), props.kind)
  if (imgs.length) emit('add', imgs)
}

const fileInput = ref<HTMLInputElement | null>(null)
function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) addFiles(input.files)
  input.value = ''
}

const dragging = ref(false)
function onDrop(e: DragEvent) {
  dragging.value = false
  if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files)
}

// 貼上路由：登記滑鼠是否停在本卡（實際 paste 監聽在 RecordEditor），並亮起貼上目標提示
const hovered = ref(false)
function setHover(on: boolean) {
  hovered.value = on
  if (on) hoveredImageKind.value = props.kind
  else if (hoveredImageKind.value === props.kind) hoveredImageKind.value = null
}
onBeforeUnmount(() => setHover(false))

// ---- 單張操作 ----
async function removeImage(img: DcImage) {
  // 尚未上傳：確認後移除＋清 blob（無法復原）；已上傳：標記待刪（再點可反悔），同步時執行
  if (!img.url && !img.dcMessageId && !img.attachmentId) {
    if (!window.confirm('移除這張尚未上傳的圖片？（無法復原）')) return
    await deleteBlob(img.id)
    emit('remove', img.id)
    return
  }
  emit('update', { ...img, removed: !img.removed })
}
function statusOf(img: DcImage): { cls: string; label: string } {
  if (img.removed) return { cls: 'chip-struck', label: '待刪除' }
  if (!img.url) return { cls: 'chip-pending', label: '未上傳' }
  return { cls: 'chip-ok', label: '已上傳' }
}
</script>

<template>
  <div
    class="card image-card"
    :class="{ dragging, hovering: hovered }"
    @mouseenter="setHover(true)"
    @mouseleave="setHover(false)"
    @dragover.prevent="dragging = true"
    @dragleave="dragging = false"
    @drop.prevent="onDrop"
  >
    <div class="section-head">
      <h3>{{ title }}</h3>
      <span class="count">{{ images.length }} 張</span>
      <span v-if="hovered" class="chip chip-cart paste-hint">📋 Ctrl+V 貼到這裡</span>
      <div class="spacer" />
      <button type="button" class="btn btn-sm" @click="fileInput?.click()">＋ 選擇圖片</button>
      <input ref="fileInput" type="file" accept="image/*" multiple class="hidden-input" @change="onPick" />
    </div>
    <p v-if="!images.length" class="muted drop-hint">拖拉圖片到這裡，或按 Ctrl+V 貼上（停在本區塊直接加入，否則會跳選單）。</p>
    <ul v-else class="image-grid">
      <li v-for="img in images" :key="img.id" class="image-item" :class="{ removed: img.removed }">
        <img
          :src="img.url ?? previews[img.id]"
          :alt="img.filename"
          loading="lazy"
          @error="img.url && emit('refresh', img)"
        />
        <div class="image-meta">
          <span class="chip img-chip" :class="statusOf(img).cls">{{ statusOf(img).label }}</span>
          <select
            v-if="kind === 'payout'"
            class="img-field"
            :value="img.memberHandle ?? ''"
            @change="emit('update', { ...img, memberHandle: ($event.target as HTMLSelectElement).value || undefined })"
          >
            <option value="">選擇團員…</option>
            <option v-for="m in members" :key="m.handle" :value="m.handle">{{ displayNameIn(groupId, m.handle) }}</option>
          </select>
          <input
            v-if="kind === 'external'"
            class="img-field"
            placeholder="註解"
            :value="img.note ?? ''"
            @input="emit('update', { ...img, note: ($event.target as HTMLInputElement).value || undefined })"
          />
          <button type="button" class="btn btn-icon btn-danger img-remove"
            :title="img.removed ? '取消待刪除' : '移除'" @click="removeImage(img)">
            {{ img.removed ? '↺' : '✕' }}
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.image-card.dragging,
.image-card.hovering { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.paste-hint { cursor: default; animation: paste-hint-in .18s ease-out; }
@keyframes paste-hint-in {
  from { opacity: 0; transform: translateY(-3px); }
}
.hidden-input { display: none; }
.drop-hint { border: 1px dashed var(--border-strong); border-radius: var(--radius-sm); padding: 18px; text-align: center; }
.image-grid {
  list-style: none; margin: 0; padding: 0;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px;
}
.image-item {
  border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden;
  background: var(--surface-2); display: flex; flex-direction: column;
}
.image-item.removed { opacity: .5; }
.image-item img { width: 100%; height: 120px; object-fit: cover; display: block; background: #e5e7eb; }
.image-meta { display: flex; align-items: center; gap: 6px; padding: 7px 8px; }
.img-chip { cursor: default; flex: none; font-size: 11px; padding: 3px 8px; }
.img-field { flex: 1; min-width: 0; font-size: 13px; padding: 5px 8px; }
.img-remove { width: 28px; height: 28px; flex: none; }
</style>
