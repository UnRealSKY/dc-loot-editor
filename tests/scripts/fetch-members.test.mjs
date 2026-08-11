// scripts/ 不在 tsconfig 的 include 範圍內，所以這支測試用 .mjs 直接吃 script 的 export
import { describe, it, expect } from 'vitest'
import { mergeRoster, formatMembersJson } from '../../scripts/fetch-members.mjs'

const gm = (id, username, over = {}) => ({
  user: { id, username, global_name: over.global_name ?? null, bot: over.bot },
  nick: over.nick ?? null,
})

describe('mergeRoster', () => {
  it('排除 bot 帳號', () => {
    const { entries } = mergeRoster([], [gm('1', 'alice'), gm('2', 'somebot', { bot: true })])
    expect(entries.map((e) => e.discordHandle)).toEqual(['@alice'])
  })

  it('discordNickName 取伺服器暱稱優先，其次全域顯示名，最後才是帳號名', () => {
    const { entries } = mergeRoster([], [
      gm('1', 'alice', { nick: '團長', global_name: 'Alice' }),
      gm('2', 'bob', { global_name: 'Bob' }),
      gm('3', 'carol'),
    ])
    expect(entries.map((e) => e.discordNickName)).toEqual(['團長', 'Bob', 'carol'])
  })

  it('既有成員維持原順序，新成員接在後面', () => {
    const existing = [
      { discordId: '2', discordHandle: '@bob', discordNickName: 'Bob' },
      { discordId: '1', discordHandle: '@alice', discordNickName: 'Alice' },
    ]
    const { entries } = mergeRoster(existing, [
      gm('1', 'alice', { global_name: 'Alice' }),
      gm('3', 'carol', { global_name: 'Carol' }),
      gm('2', 'bob', { global_name: 'Bob' }),
    ])
    expect(entries.map((e) => e.discordHandle)).toEqual(['@bob', '@alice', '@carol'])
  })

  it('用 discordId 對應：帳號改名時更新 handle，不會誤判成新成員', () => {
    const existing = [{ discordId: '1', discordHandle: '@oldname', discordNickName: '天天' }]
    const { entries, renamed } = mergeRoster(existing, [gm('1', 'newname', { nick: '天天' })])
    expect(entries).toEqual([
      { discordId: '1', discordHandle: '@newname', discordNickName: '天天' },
    ])
    expect(renamed).toEqual([{ from: '@oldname', to: '@newname' }])
  })

  it('既有成員沒有 discordId 時用 handle 對應並補上', () => {
    const existing = [{ discordHandle: '@alice', discordNickName: 'Alice' }]
    const { entries, filledIds } = mergeRoster(existing, [gm('1', 'alice', { nick: 'Alice' })])
    expect(entries).toEqual([{ discordId: '1', discordHandle: '@alice', discordNickName: 'Alice' }])
    expect(filledIds).toEqual(['@alice'])
  })

  it('discordNickName 以 Discord 為準，變更會回報', () => {
    const existing = [{ discordId: '1', discordHandle: '@alice', discordNickName: '舊名' }]
    const { entries, nickChanged } = mergeRoster(existing, [gm('1', 'alice', { nick: '新名' })])
    expect(entries[0].discordNickName).toBe('新名')
    expect(nickChanged).toEqual([{ discordHandle: '@alice', from: '舊名', to: '新名' }])
  })

  it('自訂 alias 同步時原樣保留，不被 Discord 顯示名蓋掉', () => {
    const existing = [
      { discordId: '1', discordHandle: '@alice', discordNickName: '舊名', alias: '我取的名字' },
    ]
    const { entries } = mergeRoster(existing, [gm('1', 'alice', { nick: '新名' })])
    expect(entries[0]).toEqual({
      discordId: '1',
      discordHandle: '@alice',
      discordNickName: '新名',
      alias: '我取的名字',
    })
  })

  it('新成員不帶 alias 欄位', () => {
    const { added } = mergeRoster([], [gm('1', 'alice', { nick: 'Alice' })])
    expect(added).toEqual([{ discordId: '1', discordHandle: '@alice', discordNickName: 'Alice' }])
  })

  it('已離開伺服器的成員會被移除並回報', () => {
    const existing = [
      { discordId: '1', discordHandle: '@alice', discordNickName: 'Alice' },
      { discordId: '9', discordHandle: '@gone', discordNickName: '已退團' },
    ]
    const { entries, removed } = mergeRoster(existing, [gm('1', 'alice', { nick: 'Alice' })])
    expect(entries.map((e) => e.discordHandle)).toEqual(['@alice'])
    expect(removed).toEqual([{ discordId: '9', discordHandle: '@gone', discordNickName: '已退團' }])
  })

  it('不改動傳入的既有名冊', () => {
    const existing = [{ discordId: '1', discordHandle: '@alice', discordNickName: '舊名' }]
    mergeRoster(existing, [gm('1', 'alice', { nick: '新名' })])
    expect(existing).toEqual([{ discordId: '1', discordHandle: '@alice', discordNickName: '舊名' }])
  })
})

describe('formatMembersJson', () => {
  it('每筆一行，維持 members.json 既有的排版', () => {
    const out = formatMembersJson([
      { discordId: '1', discordHandle: '@alice', discordNickName: 'Alice' },
      { discordId: '2', discordHandle: '@bob', discordNickName: 'Bob' },
    ])
    expect(out).toBe(
      '[\n' +
        '  { "discordId": "1", "discordHandle": "@alice", "discordNickName": "Alice" },\n' +
        '  { "discordId": "2", "discordHandle": "@bob", "discordNickName": "Bob" }\n' +
        ']\n',
    )
  })

  it('有自訂 alias 才輸出該欄位', () => {
    const out = formatMembersJson([
      { discordId: '1', discordHandle: '@a', discordNickName: 'A', alias: '甲' },
    ])
    expect(out).toContain('"discordNickName": "A", "alias": "甲"')
  })

  it('輸出可被 JSON.parse 還原', () => {
    const entries = [{ discordId: '1', discordHandle: '@a "quoted"', discordNickName: '中文\\反斜線' }]
    expect(JSON.parse(formatMembersJson(entries))).toEqual(entries)
  })

  it('空名冊輸出合法 JSON', () => {
    expect(JSON.parse(formatMembersJson([]))).toEqual([])
  })
})
