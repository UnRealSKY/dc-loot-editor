import type { LootRecord, DcBinding } from '../types'
import { serialize } from '../format/serialize'
import { rosterMentions } from '../store/roster'
import { createForumPost, editMessage } from './webhook'

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

// 未發佈→建立論壇貼文；已發佈→PATCH 開頭訊息內文。回傳最新綁定。
export async function publishOrSync(url: string, record: LootRecord): Promise<DcBinding> {
  const content = applyMentions(serialize(record), rosterMentions())
  if (content.length > CONTENT_LIMIT) {
    throw new Error(`內文 ${content.length} 字元，超過 Discord 上限 ${CONTENT_LIMIT}，請精簡後再發佈`)
  }
  const now = new Date().toISOString()
  if (record.dc) {
    await editMessage(url, record.dc.messageId, record.dc.threadId, content)
    return { ...record.dc, lastSyncAt: now }
  }
  const { threadId, messageId } = await createForumPost(url, threadTitle(record), content)
  return { threadId, messageId, publishedAt: now, lastSyncAt: now }
}
