// Discord Webhook API client（純函式層，不含 UI 狀態）
// 關鍵約束：目標須為論壇頻道；POST 須 ?wait=true 才拿得到訊息 id；
// 訊息 GET/PATCH 須帶 thread_id；thread_name 建立後不可改；webhook 無法枚舉歷史訊息。

export type NormalizeResult = { ok: true; url: string } | { ok: false; error: string }

export function normalizeWebhookUrl(input: string): NormalizeResult {
  const raw = input.trim().replace(/\/+$/, '')
  if (!raw) return { ok: false, error: '請貼上 Webhook URL' }
  if (/\/(github|slack)$/i.test(raw)) {
    return { ok: false, error: '這是 GitHub/Slack 相容端點，請回 Discord 重新複製原始 Webhook URL' }
  }
  const valid = /^https:\/\/(?:\w+\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(raw)
  if (!valid) {
    return { ok: false, error: '格式不對：應為 https://discord.com/api/webhooks/{id}/{token}' }
  }
  return { ok: true, url: raw }
}

// 訊息連結 https://discord.com/channels/{guild}/{threadId}/{messageId} 取後兩段（救援綁定用）
export function parseMessageLink(link: string): { threadId: string; messageId: string } | null {
  const m = link.trim().match(/discord(?:app)?\.com\/channels\/\d+\/(\d+)\/(\d+)/)
  if (!m) return null
  return { threadId: m[1], messageId: m[2] }
}

// 429 依 retry_after 等待重試（上限 3 次），其他狀態原樣回傳
async function fetchDc(input: string, init?: RequestInit, attempt = 0): Promise<Response> {
  const res = await fetch(input, init)
  if (res.status === 429 && attempt < 3) {
    let waitSec = 1
    try {
      const body = await res.clone().json()
      if (typeof body.retry_after === 'number') waitSec = body.retry_after
    } catch {
      // 無 body 時用預設等待
    }
    await new Promise((r) => setTimeout(r, waitSec * 1000 + 100))
    return fetchDc(input, init, attempt + 1)
  }
  return res
}

export class DcHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number, // Discord 錯誤碼（如 10003 未知頻道、10008 未知訊息）
  ) {
    super(message)
  }
}

// 綁定失效：討論串或訊息已不存在（被刪除、或綁定資料過期）。
// 只認 Discord 錯誤碼 10003（未知頻道）/ 10008（未知訊息）——
// 其他失敗（webhook 被刪 10015、權限、網路、5xx）屬一般錯誤，不可誤導使用者重新發文。
export function isBindingLost(e: unknown): boolean {
  return e instanceof DcHttpError && (e.code === 10003 || e.code === 10008)
}

async function fail(res: Response, action: string): Promise<never> {
  let detail = ''
  let code: number | undefined
  try {
    const body = await res.json()
    if (body?.message) detail = `：${body.message}`
    if (typeof body?.code === 'number') code = body.code
  } catch {
    // 無 JSON body 時只帶狀態碼
  }
  throw new DcHttpError(`${action}失敗（HTTP ${res.status}${detail}）`, res.status, code)
}

export interface WebhookInfo {
  name: string
  channelId: string
}

export async function getWebhook(url: string): Promise<WebhookInfo> {
  const res = await fetchDc(url)
  if (!res.ok) return fail(res, '驗證 Webhook')
  const data = await res.json()
  return { name: data.name ?? '', channelId: data.channel_id ?? '' }
}

export interface ThreadBinding {
  threadId: string
  messageId: string
}

export async function createForumPost(
  url: string,
  threadName: string,
  content: string,
): Promise<ThreadBinding> {
  const res = await fetchDc(`${url}?wait=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      thread_name: threadName,
      content,
      allowed_mentions: { parse: ['users'] },
    }),
  })
  if (!res.ok) return fail(res, '發佈')
  const data = await res.json()
  // id＝開頭訊息、channel_id＝新討論串；不可假設兩者相等
  return { messageId: String(data.id), threadId: String(data.channel_id) }
}

// 讀回自己發過的訊息（一致性檢查用；webhook 只能讀自己的訊息且須知道 id）
export async function getMessage(
  url: string,
  messageId: string,
  threadId: string,
): Promise<{ content: string }> {
  const res = await fetchDc(`${url}/messages/${messageId}?thread_id=${threadId}`)
  if (!res.ok) return fail(res, '讀取貼文')
  const data = await res.json()
  return { content: String(data.content ?? '') }
}

export async function editMessage(
  url: string,
  messageId: string,
  threadId: string,
  content: string,
): Promise<void> {
  const res = await fetchDc(`${url}/messages/${messageId}?thread_id=${threadId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, allowed_mentions: { parse: ['users'] } }),
  })
  if (!res.ok) return fail(res, '同步')
}
