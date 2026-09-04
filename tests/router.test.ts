import { describe, it, expect, beforeEach } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from '#src/router'
import { bossId } from '#src/boss/bossId'

// 轉址是 router 自己的事，不必掛元件。每次都建一份新的，
// 上一個測試留下的網址不會漏過來。
async function go(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  await router.isReady()
  return router.currentRoute.value.fullPath
}

describe('進站', () => {
  beforeEach(() => (bossId.value = 'dunas'))

  it('根路徑導到上次選的王', async () => {
    expect(await go('/')).toBe('/boss-toolkit/dunas')
  })

  it('不帶王的 /boss-toolkit 導到上次選的那隻', async () => {
    expect(await go('/boss-toolkit')).toBe('/boss-toolkit/dunas')
  })
})

describe('改版前的網址', () => {
  beforeEach(() => (bossId.value = 'dunas'))

  it('/shield 一路導到現在的王', async () => {
    expect(await go('/shield')).toBe('/boss-toolkit/dunas')
  })

  it('/pending 導到未領總覽', async () => {
    expect(await go('/pending')).toBe('/loot/pending')
  })

  it('/settings 導到設定', async () => {
    expect(await go('/settings')).toBe('/loot/settings')
  })

  it('/edit/:id 帶著 id 導到分寶的編輯頁', async () => {
    expect(await go('/edit/r1')).toBe('/loot/edit/r1')
  })
})

// 列舉得出來的舊網址上面那組管，這組管的是列舉不出來的：打錯字、
// 被截斷的分享連結、更早以前的網址。沒有這條就是一片空白——
// header 與第二層頁籤是 App.vue 自己畫的，照樣會在，看起來像壞掉
describe('沒有匹配到的網址一律導回首頁', () => {
  beforeEach(() => (bossId.value = 'dunas'))

  it('不存在的路徑', async () => {
    expect(await go('/abc')).toBe('/boss-toolkit/dunas')
  })

  it('第二層打錯字', async () => {
    expect(await go('/loot/abc')).toBe('/boss-toolkit/dunas')
  })

  it('王的網址多接了一層', async () => {
    expect(await go('/boss-toolkit/x/y')).toBe('/boss-toolkit/dunas')
  })
})
