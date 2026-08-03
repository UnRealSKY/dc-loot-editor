import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  normalizeWebhookUrl,
  parseMessageLink,
  getWebhook,
  createForumPost,
  editMessage,
} from '#src/dc/webhook'

const VALID = 'https://discord.com/api/webhooks/1234567890/abcDEF_123-xyz'

describe('normalizeWebhookUrl', () => {
  it('合法 URL 通過並去除前後空白與結尾斜線', () => {
    expect(normalizeWebhookUrl(`  ${VALID}/  `)).toEqual({ ok: true, url: VALID })
  })
  it('接受舊網域 discordapp.com 與子網域', () => {
    expect(normalizeWebhookUrl('https://discordapp.com/api/webhooks/1/token').ok).toBe(true)
    expect(normalizeWebhookUrl('https://ptb.discord.com/api/webhooks/1/token').ok).toBe(true)
  })
  it('拒絕 /github、/slack 相容端點', () => {
    const r = normalizeWebhookUrl(`${VALID}/github`)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('GitHub/Slack')
  })
  it('拒絕非 webhook URL 與空字串', () => {
    expect(normalizeWebhookUrl('https://discord.com/channels/1/2/3').ok).toBe(false)
    expect(normalizeWebhookUrl('').ok).toBe(false)
  })
})

describe('parseMessageLink', () => {
  it('取討論串與訊息 id（後兩段）', () => {
    expect(parseMessageLink('https://discord.com/channels/111/222/333')).toEqual({
      threadId: '222',
      messageId: '333',
    })
  })
  it('非訊息連結回 null', () => {
    expect(parseMessageLink('https://discord.com/channels/111/222')).toBeNull()
    expect(parseMessageLink('random')).toBeNull()
  })
})

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('API 呼叫', () => {
  it('getWebhook 回傳名稱與頻道', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, { name: '分寶機器人', channel_id: '999' })))
    expect(await getWebhook(VALID)).toEqual({ name: '分寶機器人', channelId: '999' })
  })

  it('429 依 retry_after 重試後成功', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { retry_after: 0.01 }))
      .mockResolvedValueOnce(jsonResponse(200, { name: 'w', channel_id: '1' }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await getWebhook(VALID)).toEqual({ name: 'w', channelId: '1' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('createForumPost 帶 ?wait=true 與 thread_name，回傳訊息/討論串 id', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { id: '111', channel_id: '222' }))
    vi.stubGlobal('fetch', fetchMock)
    const r = await createForumPost(VALID, '2026-08-02 混龍 / 6', '內文')
    expect(r).toEqual({ messageId: '111', threadId: '222' })
    const [calledUrl, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(calledUrl).toBe(`${VALID}?wait=true`)
    expect(JSON.parse(init.body as string)).toEqual({ thread_name: '2026-08-02 混龍 / 6', content: '內文' })
  })

  it('editMessage 打 messages/{id} 並帶 thread_id', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, {}))
    vi.stubGlobal('fetch', fetchMock)
    await editMessage(VALID, '111', '222', '新內文')
    const [calledUrl, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(calledUrl).toBe(`${VALID}/messages/111?thread_id=222`)
    expect(init.method).toBe('PATCH')
  })

  it('非 2xx 拋出含狀態碼與 Discord 訊息的錯誤', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(404, { message: 'Unknown Webhook' })))
    await expect(getWebhook(VALID)).rejects.toThrow('驗證 Webhook失敗（HTTP 404：Unknown Webhook）')
  })
})
