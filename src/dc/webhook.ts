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

async function fail(res: Response, action: string): Promise<never> {
  let detail = ''
  try {
    const body = await res.json()
    if (body?.message) detail = `：${body.message}`
  } catch {
    // 無 JSON body 時只帶狀態碼
  }
  throw new Error(`${action}失敗（HTTP ${res.status}${detail}）`)
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
    body: JSON.stringify({ thread_name: threadName, content }),
  })
  if (!res.ok) return fail(res, '發佈')
  const data = await res.json()
  // id＝開頭訊息、channel_id＝新討論串；不可假設兩者相等
  return { messageId: String(data.id), threadId: String(data.channel_id) }
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
    body: JSON.stringify({ content }),
  })
  if (!res.ok) return fail(res, '同步')
}
