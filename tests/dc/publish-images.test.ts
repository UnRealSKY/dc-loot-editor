import { describe, it, expect, vi, afterEach } from 'vitest'
import { publishOrSync, hasImageChanges, imageMessageContent } from '#src/dc/publish'
import type { LootRecord, DcImage } from '#src/types'

const URL_ = 'https://discord.com/api/webhooks/1/token'

function makeRecord(over: Partial<LootRecord>): LootRecord {
  return {
    id: 'r1', date: '2026-08-04', boss: '混龍',
    members: [{ handle: '@a', settle: 'pending' }],
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

function makeBlobIO() {
  return {
    getBlob: vi.fn(async () => new Blob(['x'], { type: 'image/png' })),
    deleteBlob: vi.fn(async () => undefined),
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('hasImageChanges / imageMessageContent', () => {
  it('新圖、待刪、訊息內文變更都算有變更', () => {
    const base = makeRecord({})
    expect(hasImageChanges(base)).toBe(false)
    const pending: DcImage = { id: 'i1', kind: 'drop', filename: 'i1.png' }
    expect(hasImageChanges(makeRecord({ images: [pending] }))).toBe(true)
    const removed: DcImage = { id: 'i2', kind: 'payout', filename: 'i2.png', url: 'u', dcMessageId: 'm', sentContent: '@a 領錢', removed: true }
    expect(hasImageChanges(makeRecord({ images: [removed] }))).toBe(true)
    const noteChanged: DcImage = { id: 'i3', kind: 'external', filename: 'i3.png', url: 'u', dcMessageId: 'm', sentContent: '外購', note: '新註解' }
    expect(hasImageChanges(makeRecord({ images: [noteChanged] }))).toBe(true)
    const synced: DcImage = { id: 'i4', kind: 'external', filename: 'i4.png', url: 'u', dcMessageId: 'm', sentContent: '外購' }
    expect(hasImageChanges(makeRecord({ images: [synced] }))).toBe(false)
  })
  it('訊息內文格式', () => {
    expect(imageMessageContent({ id: 'x', kind: 'payout', filename: 'x.png', memberHandle: '@a' })).toBe('@a 領錢')
    expect(imageMessageContent({ id: 'x', kind: 'external', filename: 'x.png', note: '賣給路人' })).toBe('外購: 賣給路人')
    expect(imageMessageContent({ id: 'x', kind: 'external', filename: 'x.png' })).toBe('外購')
  })
})

describe('publishOrSync 含圖片', () => {
  it('首次發佈：掉落圖隨主貼上傳、領錢圖發串內訊息，成功後清 blob', async () => {
    const drop: DcImage = { id: 'd1', kind: 'drop', filename: 'd1.png' }
    const payout: DcImage = { id: 'p1', kind: 'payout', filename: 'p1.png', memberHandle: '@a' }
    const record = makeRecord({ images: [drop, payout] })
    const io = makeBlobIO()
    const fetchMock = vi
      .fn()
      // 1. 建立主貼（multipart）
      .mockResolvedValueOnce(jsonResponse(200, { id: 'm1', channel_id: 't1' }))
      // 2. 讀回主貼附件
      .mockResolvedValueOnce(jsonResponse(200, { content: '', attachments: [{ id: 'a1', filename: 'd1.png', url: 'url-d1' }] }))
      // 3. 領錢圖串內訊息
      .mockResolvedValueOnce(jsonResponse(200, { id: 'm2', attachments: [{ id: 'a2', filename: 'p1.png', url: 'url-p1' }] }))
    vi.stubGlobal('fetch', fetchMock)

    const progress: string[] = []
    const out = await publishOrSync(URL_, record, {
      blobIO: io,
      onProgress: (d, t) => progress.push(`${d}/${t}`),
    })

    expect(out.dc?.threadId).toBe('t1')
    const outDrop = out.images!.find((i) => i.id === 'd1')!
    expect(outDrop).toMatchObject({ attachmentId: 'a1', url: 'url-d1' })
    const outPayout = out.images!.find((i) => i.id === 'p1')!
    expect(outPayout).toMatchObject({ dcMessageId: 'm2', url: 'url-p1', sentContent: '@a 領錢' })
    expect(io.deleteBlob).toHaveBeenCalledWith('d1')
    expect(io.deleteBlob).toHaveBeenCalledWith('p1')
    expect(progress).toEqual(['1/2', '2/2'])
    // 主貼建立走 multipart（FormData），串內訊息帶 thread_id
    const [, init1] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init1.body).toBeInstanceOf(FormData)
    const [postUrl] = fetchMock.mock.calls[2] as unknown as [string]
    expect(postUrl).toBe(`${URL_}?wait=true&thread_id=t1`)
  })

  it('待刪圖片：DELETE 串內訊息並自清單移除', async () => {
    const img: DcImage = {
      id: 'p1', kind: 'payout', filename: 'p1.png', memberHandle: '@a',
      url: 'u', dcMessageId: 'm2', sentContent: '@a 領錢', removed: true,
    }
    const record = makeRecord({
      dc: { threadId: 't1', messageId: 'm1', publishedAt: '2026-08-01T00:00:00Z' },
      images: [img],
    })
    const io = makeBlobIO()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, {})) // PATCH 主貼內文
      .mockResolvedValueOnce(new Response(null, { status: 204 })) // DELETE 串內訊息
    vi.stubGlobal('fetch', fetchMock)

    const out = await publishOrSync(URL_, record, { blobIO: io })
    expect(out.images).toEqual([])
    const [delUrl, delInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit]
    expect(delUrl).toBe(`${URL_}/messages/m2?thread_id=t1`)
    expect(delInit.method).toBe('DELETE')
  })

  it('註解變更：PATCH 串內訊息並更新 sentContent', async () => {
    const img: DcImage = {
      id: 'e1', kind: 'external', filename: 'e1.png',
      url: 'u', dcMessageId: 'm3', sentContent: '外購', note: '賣給路人',
    }
    const record = makeRecord({
      dc: { threadId: 't1', messageId: 'm1', publishedAt: '2026-08-01T00:00:00Z' },
      images: [img],
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, {})) // PATCH 主貼
      .mockResolvedValueOnce(jsonResponse(200, {})) // PATCH 串內訊息
    vi.stubGlobal('fetch', fetchMock)

    const out = await publishOrSync(URL_, record, { blobIO: makeBlobIO() })
    expect(out.images![0].sentContent).toBe('外購: 賣給路人')
    const [patchUrl, patchInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit]
    expect(patchUrl).toBe(`${URL_}/messages/m3?thread_id=t1`)
    expect(JSON.parse(patchInit.body as string).content).toBe('外購: 賣給路人')
  })
})

describe('物品出售：全部圖共用一則訊息', () => {
  const published = { threadId: 't1', messageId: 'm0', publishedAt: '', sentContent: 'x' }

  it('第一次同步時發成一則訊息，帶所有新圖', async () => {
    const calls: Array<{ url: string; method: string }> = []
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET' })
      if (init?.method === 'POST') {
        return jsonResponse(200, {
          id: 'saleMsg',
          attachments: [
            { id: 'a1', filename: 's1.png', url: 'https://cdn/s1.png' },
            { id: 'a2', filename: 's2.png', url: 'https://cdn/s2.png' },
          ],
        })
      }
      return jsonResponse(200, { id: 'm0', content: 'x', attachments: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    const images: DcImage[] = [
      { id: 's1', kind: 'sale', filename: 's1.png' },
      { id: 's2', kind: 'sale', filename: 's2.png' },
    ]
    const out = await publishOrSync(URL_, makeRecord({ dc: published, images }), { blobIO: makeBlobIO() })
    // 兩張圖只發一則訊息
    const posts = calls.filter((c) => c.method === 'POST' && c.url.includes('thread_id'))
    expect(posts).toHaveLength(1)
    const sale = out.images!.filter((i) => i.kind === 'sale')
    expect(sale.every((i) => i.dcMessageId === 'saleMsg')).toBe(true)
    expect(sale.map((i) => i.url)).toEqual(['https://cdn/s1.png', 'https://cdn/s2.png'])
    expect(sale.map((i) => i.attachmentId)).toEqual(['a1', 'a2'])
  })

  it('加新圖時 PATCH 原訊息並保留既有附件', async () => {
    let patchBody: FormData | undefined
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH' && url.includes('saleMsg')) patchBody = init.body as FormData
      if (url.includes('saleMsg')) {
        return jsonResponse(200, {
          id: 'saleMsg',
          attachments: [
            { id: 'a1', filename: 's1.png', url: 'https://cdn/s1.png' },
            { id: 'a3', filename: 's3.png', url: 'https://cdn/s3.png' },
          ],
        })
      }
      return jsonResponse(200, { id: 'm0', content: 'x', attachments: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    const images: DcImage[] = [
      { id: 's1', kind: 'sale', filename: 's1.png', url: 'https://cdn/s1.png', attachmentId: 'a1', dcMessageId: 'saleMsg' },
      { id: 's3', kind: 'sale', filename: 's3.png' },
    ]
    const out = await publishOrSync(URL_, makeRecord({ dc: published, images }), { blobIO: makeBlobIO() })
    expect(patchBody).toBeDefined()
    const payload = JSON.parse(patchBody!.get('payload_json') as string)
    expect(payload.attachments[0]).toEqual({ id: 'a1' }) // 保留舊的那張，後面接新檔佔位
    expect(out.images!.find((i) => i.id === 's3')?.attachmentId).toBe('a3')
  })

  it('整區清空時刪掉那則訊息', async () => {
    const calls: Array<{ url: string; method: string }> = []
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET' })
      return jsonResponse(200, { id: 'm0', content: 'x', attachments: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    const images: DcImage[] = [
      { id: 's1', kind: 'sale', filename: 's1.png', url: 'u', attachmentId: 'a1', dcMessageId: 'saleMsg', removed: true },
    ]
    const out = await publishOrSync(URL_, makeRecord({ dc: published, images }), { blobIO: makeBlobIO() })
    expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('saleMsg'))).toBe(true)
    expect(out.images!.filter((i) => i.kind === 'sale')).toHaveLength(0)
  })

  it('沒有變更時不動那則訊息', async () => {
    const calls: Array<{ url: string; method: string }> = []
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET' })
      return jsonResponse(200, { id: 'm0', content: 'x', attachments: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    const images: DcImage[] = [
      { id: 's1', kind: 'sale', filename: 's1.png', url: 'u', attachmentId: 'a1', dcMessageId: 'saleMsg' },
    ]
    await publishOrSync(URL_, makeRecord({ dc: published, images }), { blobIO: makeBlobIO() })
    expect(calls.some((c) => c.url.includes('saleMsg'))).toBe(false)
  })
})

describe('每則訊息 10 張附件上限', () => {
  const many = (kind: DcImage['kind'], n: number): DcImage[] =>
    Array.from({ length: n }, (_, i) => ({ id: `${kind}${i}`, kind, filename: `${kind}${i}.png` }))

  it('掉落截圖超過 10 張擋在發佈之前', async () => {
    vi.stubGlobal('fetch', vi.fn())
    await expect(
      publishOrSync(URL_, makeRecord({ images: many('drop', 11) }), { blobIO: makeBlobIO() }),
    ).rejects.toThrow(/掉落截圖.*10/)
  })

  it('物品出售超過 10 張也擋下', async () => {
    vi.stubGlobal('fetch', vi.fn())
    await expect(
      publishOrSync(URL_, makeRecord({ images: many('sale', 11) }), { blobIO: makeBlobIO() }),
    ).rejects.toThrow(/物品出售.*10/)
  })

  it('剛好 10 張放行', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, { id: 'm', attachments: [] })))
    await expect(
      publishOrSync(URL_, makeRecord({ images: many('drop', 10) }), { blobIO: makeBlobIO() }),
    ).resolves.toBeDefined()
  })

  it('待刪的不算在上限內', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, { id: 'm', attachments: [] })))
    const images = [...many('drop', 10), { id: 'x', kind: 'drop' as const, filename: 'x.png', url: 'u', removed: true }]
    await expect(
      publishOrSync(URL_, makeRecord({ images }), { blobIO: makeBlobIO() }),
    ).resolves.toBeDefined()
  })

  it('領錢截圖每張自己一則，不受上限影響', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, { id: 'm', attachments: [] })))
    await expect(
      publishOrSync(URL_, makeRecord({ images: many('payout', 11) }), { blobIO: makeBlobIO() }),
    ).resolves.toBeDefined()
  })
})
