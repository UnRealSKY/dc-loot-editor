import { describe, it, expect, vi, afterEach } from 'vitest'
import { threadTitle, publishOrSync, applyMentions, CONTENT_LIMIT } from '#src/dc/publish'
import { isBindingLost } from '#src/dc/webhook'
import type { LootRecord } from '#src/types'

const URL = 'https://discord.com/api/webhooks/1/token'

function makeRecord(over: Partial<LootRecord>): LootRecord {
  return {
    id: 'r1', date: '2026-08-02', boss: '混龍',
    members: [
      { handle: '@a', settle: 'pending' },
      { handle: '@b', settle: 'pending' },
    ],
    lootItems: [{ status: 'ok', name: '道具', qty: 1, unitPrice: 100 }],
    purchases: [],
    createdAt: '', updatedAt: '',
    ...over,
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('threadTitle', () => {
  it('[MM-DD]團名，不帶人數與年份', () => {
    expect(threadTitle(makeRecord({}))).toBe('[08-02]混龍')
  })
  it('無日期時只有團名', () => {
    expect(threadTitle(makeRecord({ date: '' }))).toBe('混龍')
  })
})

describe('applyMentions', () => {
  const ENTRIES = [
    { handle: '@a', id: '111' },
    { handle: '@ab', id: '222' },
    { handle: '@.unrealsky', id: '333' },
  ]
  it('把 @handle 換成 <@ID>，長 handle 優先、不誤傷前綴', () => {
    const out = applyMentions('* :ok: @ab: 1 = 1\n* :ok: @a: 2 = 2\n@.unrealsky: 龍鍊x1 = 500x1', ENTRIES)
    expect(out).toContain('* :ok: <@222>: 1 = 1')
    expect(out).toContain('* :ok: <@111>: 2 = 2')
    expect(out).toContain('<@333>: 龍鍊x1 = 500x1')
  })
  it('名冊沒有 ID 的 handle 保持原樣', () => {
    expect(applyMentions('@unknown: x', ENTRIES)).toBe('@unknown: x')
  })
})

describe('publishOrSync', () => {
  it('未發佈時 POST 建立貼文並回傳完整綁定；標題不帶狀態、內文標題行帶狀態', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { id: 'm1', channel_id: 't1' }))
    vi.stubGlobal('fetch', fetchMock)
    const record = makeRecord({})
    const dc = await publishOrSync(URL, record)
    expect(dc.messageId).toBe('m1')
    expect(dc.threadId).toBe('t1')
    expect(dc.publishedAt).toBeTruthy()
    expect(dc.lastSyncAt).toBeTruthy()
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.thread_name).toBe('[08-02]混龍')
    expect(body.content.startsWith('## 2026-08-02 混龍 ｜ :dollar:(2)')).toBe(true)
  })

  it('已發佈時 PATCH 原訊息並更新 lastSyncAt', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, {}))
    vi.stubGlobal('fetch', fetchMock)
    const r = makeRecord({ dc: { threadId: 't1', messageId: 'm1', publishedAt: '2026-08-01T00:00:00Z' } })
    const dc = await publishOrSync(URL, r)
    expect(dc.publishedAt).toBe('2026-08-01T00:00:00Z')
    expect(dc.lastSyncAt).not.toBe(undefined)
    const [calledUrl] = fetchMock.mock.calls[0] as unknown as [string]
    expect(calledUrl).toBe(`${URL}/messages/m1?thread_id=t1`)
  })

  it('綁定失效（400 未知頻道）可被 isBindingLost 辨識', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(400, { message: '未知頻道', code: 10003 })))
    const r = makeRecord({ dc: { threadId: 't1', messageId: 'm1', publishedAt: '2026-08-01T00:00:00Z' } })
    try {
      await publishOrSync(URL, r)
      expect.unreachable('應拋出錯誤')
    } catch (e) {
      expect(isBindingLost(e)).toBe(true)
      expect((e as Error).message).toContain('未知頻道')
    }
  })

  it('內文超過上限時擋下且不打 API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const r = makeRecord({ boss: '長'.repeat(CONTENT_LIMIT) })
    await expect(publishOrSync(URL, r)).rejects.toThrow('超過 Discord 上限')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
