import { ref } from 'vue'
import type { DcImage, DcImageKind } from './types'
import { putBlob } from './db/imageBlobs'

function extOf(file: File): string {
  const m = file.name.match(/\.(\w+)$/)
  if (m) return m[1].toLowerCase()
  return file.type.split('/')[1] || 'png'
}

// 檔案 → DcImage（blob 進 IndexedDB）；非圖片檔自動略過
export async function filesToImages(files: Iterable<File>, kind: DcImageKind): Promise<DcImage[]> {
  const imgs: DcImage[] = []
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue
    const id = crypto.randomUUID()
    await putBlob(id, f)
    imgs.push({ id, kind, filename: `${id}.${extOf(f)}` })
  }
  return imgs
}

// 滑鼠目前停留的圖片區（貼上路由用：停留中直接加入該區，否則跳選單）
export const hoveredImageKind = ref<DcImageKind | null>(null)
