// 從 Discord 伺服器抓成員清單，重建 members.json。
//
// 為什麼是 Node 而不是做進網頁：Discord 會擋掉帶瀏覽器 User-Agent 的 API 請求
// （回 403 且不帶 CORS 標頭），有效 token 也一樣。而 User-Agent 是 fetch 的
// forbidden header，JS 改不了，所以這件事在瀏覽器裡無解。實測記錄見
// docs/discord-bot-setup.md。
//
// 需要 Bot token，不是 Webhook URL——webhook token 只能往它綁定的頻道發訊息。
// Bot 不需要常駐服務，這支只呼叫一次 REST API 就結束。
//
// 用法：
//   本機   pnpm members            （讀專案根目錄的 .env，已在 .gitignore）
//   CI     由 workflow 提供環境變數
//
// 需要的環境變數：DISCORD_BOT_TOKEN、DISCORD_GUILD_ID
// Discord 端的設定步驟見 docs/discord-bot-setup.md。

import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const API = 'https://discord.com/api/v10'
const MEMBERS_FILE = 'members.json'
const PAGE_SIZE = 1000 // Discord 單次上限

// Discord 顯示名：伺服器暱稱優先，其次全域顯示名，都沒有才退回帳號名。
function nickNameOf(m) {
  return m.nick ?? m.user.global_name ?? m.user.username
}

// 既有名冊 × 伺服器成員 → 新名冊。
// 以 discordId 對應（帳號改名時才不會誤判成「舊的退出、新的加入」），
// 既有項目沒有 id 時退而用 handle 對應並補上。
//
// 只更新 discord* 三個欄位，alias（自己取的名字）原樣保留——這正是把
// 「Discord 那邊的名字」和「自訂名稱」拆成兩欄的目的。
export function mergeRoster(existing, guildMembers) {
  const humans = guildMembers.filter((m) => !m.user.bot)
  const byId = new Map(humans.map((m) => [m.user.id, m]))
  const byHandle = new Map(humans.map((m) => [`@${m.user.username}`, m]))

  const entries = []
  const removed = []
  const renamed = []
  const filledIds = []
  const nickChanged = []
  const seen = new Set()

  // 既有成員維持原順序，讓 git diff 只顯示真正的異動
  for (const old of existing) {
    const m = old.discordId ? byId.get(old.discordId) : byHandle.get(old.discordHandle)
    if (!m) {
      removed.push(old)
      continue
    }
    seen.add(m.user.id)
    const discordHandle = `@${m.user.username}`
    const discordNickName = nickNameOf(m)
    if (discordHandle !== old.discordHandle) {
      renamed.push({ from: old.discordHandle, to: discordHandle })
    }
    if (!old.discordId) filledIds.push(discordHandle)
    if (discordNickName !== old.discordNickName) {
      nickChanged.push({ discordHandle, from: old.discordNickName, to: discordNickName })
    }
    entries.push({
      discordId: m.user.id,
      discordHandle,
      discordNickName,
      ...(old.alias ? { alias: old.alias } : {}),
    })
  }

  const added = []
  for (const m of humans) {
    if (seen.has(m.user.id)) continue
    const entry = {
      discordId: m.user.id,
      discordHandle: `@${m.user.username}`,
      discordNickName: nickNameOf(m),
    }
    entries.push(entry)
    added.push(entry)
  }

  return { entries, added, removed, renamed, filledIds, nickChanged }
}

// 一筆一行，跟 members.json 現有排版一致（讓 git diff 逐人可讀）
export function formatMembersJson(entries) {
  if (!entries.length) return '[]\n'
  const lines = entries.map((e) => {
    const parts = [
      `"discordId": ${JSON.stringify(e.discordId ?? '')}`,
      `"discordHandle": ${JSON.stringify(e.discordHandle)}`,
      `"discordNickName": ${JSON.stringify(e.discordNickName)}`,
    ]
    if (e.alias) parts.push(`"alias": ${JSON.stringify(e.alias)}`)
    return `  { ${parts.join(', ')} }`
  })
  return `[\n${lines.join(',\n')}\n]\n`
}

async function apiError(res) {
  const body = await res.json().catch(() => ({}))
  const detail = body.message ? `${body.message}${body.code ? `（code ${body.code}）` : ''}` : ''
  return new Error(`Discord API ${res.status}${detail ? `：${detail}` : ''}`)
}

// 抓成員失敗時，逐項確認到底卡在哪：token 本身、bot 有沒有在伺服器、還是 intent 沒開。
// 這三種情況 Discord 都可能回同一個 403，光看狀態碼分不出來。
async function diagnose(token, guildId) {
  const auth = { headers: { Authorization: `Bot ${token}` } }
  const lines = []

  const me = await fetch(`${API}/users/@me`, auth)
  if (!me.ok) {
    lines.push(`✗ token 無效：GET /users/@me 回 ${me.status}`)
    lines.push('  → 確認 .env 裡填的是 Bot Token（Developer Portal → Bot → Reset Token），')
    lines.push('    不是 Application ID、Public Key 或 Webhook URL。')
    return lines
  }
  const bot = await me.json()
  lines.push(`✓ token 有效，對應的 bot：${bot.username}（id ${bot.id}）`)

  const g = await fetch(`${API}/guilds/${guildId}`, auth)
  if (!g.ok) {
    lines.push(`✗ 這個 bot 讀不到伺服器 ${guildId}：GET /guilds/{id} 回 ${g.status}`)
    lines.push('  → bot 還沒被邀進這個伺服器，或伺服器 ID 填錯了。')
    lines.push('    Developer Portal → OAuth2 → URL Generator → Scopes 勾 bot →')
    lines.push('    用產生的網址把 bot 邀進伺服器。')
    lines.push('    伺服器 ID：Discord 設定 → 進階 → 開發者模式，再右鍵伺服器圖示複製。')
    return lines
  }
  const guild = await g.json()
  lines.push(`✓ bot 在伺服器「${guild.name}」裡`)
  lines.push('✗ 那問題就是 SERVER MEMBERS INTENT 沒開啟')
  lines.push('  → Developer Portal → 你的 App → Bot → 往下捲到')
  lines.push('    Privileged Gateway Intents → 打開 SERVER MEMBERS INTENT →')
  lines.push('    務必按 Save Changes（這步很容易漏）。')
  return lines
}

// 分頁抓完整個伺服器；超過 1000 人時用最後一人的 id 當游標續抓，不會靜默截斷
export async function fetchGuildMembers(token, guildId) {
  const out = []
  let after = '0'
  for (;;) {
    const url = `${API}/guilds/${guildId}/members?limit=${PAGE_SIZE}&after=${after}`
    const res = await fetch(url, { headers: { Authorization: `Bot ${token}` } })
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}))
      const waitSec = typeof body.retry_after === 'number' ? body.retry_after : 1
      console.log(`遇到速率限制，等 ${waitSec} 秒後重試…`)
      await new Promise((r) => setTimeout(r, waitSec * 1000 + 100))
      continue
    }
    if (!res.ok) throw await apiError(res)
    const batch = await res.json()
    out.push(...batch)
    if (batch.length < PAGE_SIZE) break
    after = batch[batch.length - 1].user.id
  }
  return out
}

function report(result) {
  const { entries, added, removed, renamed, filledIds, nickChanged } = result
  const section = (label, items, fmt) => {
    if (!items.length) return
    console.log(`\n${label}（${items.length}）：`)
    for (const it of items) console.log(`  ${fmt(it)}`)
  }
  section('新增', added, (e) => `${e.discordHandle}  ${e.discordNickName}  ${e.discordId}`)
  section('移除（已不在伺服器）', removed, (e) => `${e.discordHandle}  ${e.discordNickName ?? ''}`)
  section('帳號改名', renamed, (r) => `${r.from} → ${r.to}`)
  section('補上 discordId', filledIds, (h) => h)
  section('Discord 顯示名變更', nickChanged, (n) => `${n.discordHandle}  ${n.from} → ${n.to}`)
  const changed =
    added.length + removed.length + renamed.length + filledIds.length + nickChanged.length
  console.log(`\n${MEMBERS_FILE} 共 ${entries.length} 人${changed ? '' : '（無異動）'}`)
  return changed
}

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN
  const guildId = process.env.DISCORD_GUILD_ID
  if (!token || !guildId) {
    console.error(
      '缺少環境變數 DISCORD_BOT_TOKEN 與 DISCORD_GUILD_ID。\n' +
        '本機執行請在專案根目錄建立 .env：\n\n' +
        '  DISCORD_BOT_TOKEN=你的 bot token\n' +
        '  DISCORD_GUILD_ID=你的伺服器 ID\n\n' +
        '設定步驟見 docs/discord-bot-setup.md。',
    )
    process.exit(1)
  }

  const existing = JSON.parse(readFileSync(MEMBERS_FILE, 'utf8'))
  let guildMembers
  try {
    guildMembers = await fetchGuildMembers(token, guildId)
  } catch (e) {
    console.error(`\n抓取失敗：${e.message}\n`)
    console.error('診斷：')
    for (const line of await diagnose(token, guildId)) console.error(line)
    process.exit(1)
  }
  console.log(`從 Discord 取得 ${guildMembers.length} 名成員（含 bot）`)

  const result = mergeRoster(existing, guildMembers)
  writeFileSync(MEMBERS_FILE, formatMembersJson(result.entries))
  const changed = report(result)
  if (changed) console.log('用 git diff members.json 檢查，不對就 git checkout members.json 還原。')
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (invokedDirectly) {
  await main().catch((e) => {
    console.error(`\n失敗：${e.message}`)
    process.exit(1)
  })
}
