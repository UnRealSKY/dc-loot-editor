import type { LootRecord, DcImage } from '../types'
import { serialize } from '../format/serialize'
import { rosterMentions } from '../store/roster'
import {
  createForumPost,
  editMessage,
  getMessage,
  postThreadMessage,
  deleteMessage,
  type OutFile,
} from './webhook'
import { getBlob, deleteBlob } from '../db/imageBlobs'

export const CONTENT_LIMIT = 2000 // Discord 訊息內文上限

// 討論串標題：[MM-DD]團名。不帶人數（人數會變，凍結的標題只放不變資訊）；
// 年份省略（內文標題行有完整日期）。建立後不可再改。
export function threadTitle(record: LootRecord): string {
  const md = record.date.slice(5)
  return md ? `[${md}]${record.boss}` : record.boss
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 把 @handle 換成 <@ID> 真 mention（純文字 @名稱 Discord 不會渲染成 tag）。
// 長 handle 先換避免前綴誤傷；handle 後不得再接 handle 字元（\w 或 .）
export function applyMentions(
  content: string,
  entries: Array<{ handle: string; id: string }>,
): string {
  let out = content
  for (const { handle, id } of [...entries].sort((a, b) => b.handle.length - a.handle.length)) {
    out = out.replace(new RegExp(`${escapeRe(handle)}(?![\\w.])`, 'g'), `<@${id}>`)
  }
  return out
}

// 發佈到 DC 的最終內文（serialize + 真 mention 轉換）；一致性檢查也用同一份
export function publishContent(record: LootRecord): string {
  return applyMentions(serialize(record), rosterMentions())
}

// 串內圖片訊息的內文（領錢綁團員、外購帶註解）；比對 sentContent 偵測變更
export function imageMessageContent(image: DcImage): string {
  if (image.kind === 'payout') {
    const who = image.memberHandle ?? ''
    return applyMentions(`${who} 領錢`.trim(), rosterMentions())
  }
  return `外購${image.note ? `: ${image.note}` : ''}`
}

function activeImages(record: LootRecord): DcImage[] {
  return record.images ?? []
}

// 是否有待同步的圖片變更（新圖、待刪、訊息內文變更）
export function hasImageChanges(record: LootRecord): boolean {
  return activeImages(record).some(
    (img) =>
      img.removed ||
      !img.url ||
      (img.dcMessageId && img.sentContent !== imageMessageContent(img)),
  )
}

// DC 同步狀態（純本地判定）：none 未發佈；synced 一致；dirty 有未同步變更；
// published＝舊版發佈、沒存過 sentContent，無法本地判定（下次同步後即可）
export type DcSyncStatus = 'none' | 'synced' | 'dirty' | 'published'
export function dcSyncStatus(record: LootRecord): DcSyncStatus {
  if (!record.dc) return 'none'
  if (hasImageChanges(record)) return 'dirty'
  if (record.dc.sentContent == null) return 'published'
  return publishContent(record) === record.dc.sentContent ? 'synced' : 'dirty'
}

export interface SyncHooks {
  onProgress?: (done: number, total: number) => void
  onUpdate?: (record: LootRecord) => void // 每完成一步即回呼（部分成功可落盤）
  blobIO?: { getBlob: typeof getBlob; deleteBlob: typeof deleteBlob } // 測試注入
}

async function loadFiles(
  images: DcImage[],
  io: NonNullable<SyncHooks['blobIO']>,
): Promise<OutFile[]> {
  const out: OutFile[] = []
  for (const img of images) {
    const blob = await io.getBlob(img.id)
    if (!blob) throw new Error(`圖片「${img.filename}」的本地檔案遺失，請移除後重新加入`)
    out.push({ name: img.filename, blob })
  }
  return out
}

// 未發佈→建立論壇貼文（含掉落截圖附件）；已發佈→PATCH 內文與附件；
// 領錢/外購截圖各自為串內訊息（新增 POST、待刪 DELETE、內文變更 PATCH）。
// 回傳同步後的紀錄；每完成一步呼叫 onUpdate，中途失敗前面的成果不會遺失。
export async function publishOrSync(
  url: string,
  record: LootRecord,
  hooks: SyncHooks = {},
): Promise<LootRecord> {
  const io = hooks.blobIO ?? { getBlob, deleteBlob }
  const content = publishContent(record)
  if (content.length > CONTENT_LIMIT) {
    throw new Error(`內文 ${content.length} 字元，超過 Discord 上限 ${CONTENT_LIMIT}，請精簡後再發佈`)
  }
  const now = new Date().toISOString()
  let work: LootRecord = { ...record, images: record.images ? [...record.images] : undefined }

  const images = activeImages(work)
  const dropNew = images.filter((i) => i.kind === 'drop' && !i.removed && !i.url)
  const dropRemoved = images.filter((i) => i.kind === 'drop' && i.removed)
  const threadOps = images.filter(
    (i) =>
      i.kind !== 'drop' &&
      (i.removed || !i.url || (i.dcMessageId && i.sentContent !== imageMessageContent(i))),
  )
  const total = 1 + threadOps.length
  let done = 0
  const step = () => hooks.onProgress?.(++done, total)
  const emit = () => hooks.onUpdate?.(work)

  // ---- 主貼（內文＋掉落截圖附件）----
  if (!work.dc) {
    const files = await loadFiles(dropNew, io)
    const { threadId, messageId } = await createForumPost(url, threadTitle(work), content, files)
    work = {
      ...work,
      dc: { threadId, messageId, publishedAt: now, lastSyncAt: now, sentContent: content },
    }
  } else {
    const dc = work.dc
    if (dropNew.length || dropRemoved.length) {
      const keep = images
        .filter((i) => i.kind === 'drop' && !i.removed && i.attachmentId)
        .map((i) => i.attachmentId!)
      await editMessage(url, dc.messageId, dc.threadId, content, {
        keepAttachmentIds: keep,
        files: await loadFiles(dropNew, io),
      })
    } else {
      await editMessage(url, dc.messageId, dc.threadId, content)
    }
    work = { ...work, dc: { ...dc, lastSyncAt: now, sentContent: content } }
  }
  // 讀回主貼附件，依檔名補 attachmentId / URL，移除待刪項並清本地 blob
  if (dropNew.length || dropRemoved.length) {
    const msg = await getMessage(url, work.dc!.messageId, work.dc!.threadId)
    const byFilename = new Map(msg.attachments.map((a) => [a.filename, a]))
    work = {
      ...work,
      images: (work.images ?? [])
        .filter((i) => !(i.kind === 'drop' && i.removed))
        .map((i) => {
          if (i.kind !== 'drop') return i
          const att = byFilename.get(i.filename)
          return att ? { ...i, attachmentId: att.id, url: att.url } : i
        }),
    }
    for (const i of dropNew) await io.deleteBlob(i.id)
  }
  step()
  emit()

  // ---- 串內圖片訊息 ----
  for (const img of threadOps) {
    const list = work.images ?? []
    if (img.removed) {
      if (img.dcMessageId) await deleteMessage(url, img.dcMessageId, work.dc!.threadId)
      await io.deleteBlob(img.id)
      work = { ...work, images: list.filter((i) => i.id !== img.id) }
    } else if (!img.url) {
      const files = await loadFiles([img], io)
      const msgContent = imageMessageContent(img)
      const posted = await postThreadMessage(url, work.dc!.threadId, msgContent, files)
      await io.deleteBlob(img.id)
      work = {
        ...work,
        images: list.map((i) =>
          i.id === img.id
            ? {
                ...i,
                dcMessageId: posted.messageId,
                url: posted.attachments[0]?.url ?? i.url,
                sentContent: msgContent,
              }
            : i,
        ),
      }
    } else if (img.dcMessageId) {
      const msgContent = imageMessageContent(img)
      await editMessage(url, img.dcMessageId, work.dc!.threadId, msgContent)
      work = {
        ...work,
        images: list.map((i) => (i.id === img.id ? { ...i, sentContent: msgContent } : i)),
      }
    }
    step()
    emit()
  }

  return work
}
