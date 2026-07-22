// 發版後發送 Discord webhook 通知。
// 需環境變數 DISCORD_WEBHOOK（GitHub secret）；未設定則安全略過。
import { readFileSync } from 'node:fs'

const webhook = process.env.DISCORD_WEBHOOK
if (!webhook) {
  console.log('未設定 DISCORD_WEBHOOK，略過 Discord 通知')
  process.exit(0)
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const { name, version } = pkg

// 取 CHANGELOG 最新一段（第一個 "## <版本>" 標題到下一個 "## " 之前）
let notes = ''
try {
  const changelog = readFileSync('CHANGELOG.md', 'utf8')
  const m = changelog.match(/##\s+[^\n]*\n([\s\S]*?)(?:\n##\s|$)/)
  if (m) notes = m[1].trim()
} catch {
  // 無 CHANGELOG 時略過
}

const content = `🚀 **${name}** 已發佈 \`v${version}\`${notes ? `\n${notes.slice(0, 1500)}` : ''}`

const res = await fetch(webhook, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content }),
})

if (!res.ok) {
  console.error(`Discord 通知失敗：${res.status} ${await res.text()}`)
  process.exit(1)
}
console.log('Discord 通知已送出')
