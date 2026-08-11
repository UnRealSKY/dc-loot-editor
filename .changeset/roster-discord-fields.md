---
'dc-loot-editor': minor
---

名冊改為四個欄位：`discordHandle`、`discordNickName`、`discordId`、`alias`。Discord 那邊的名字與自己取的別名分開存，同步只覆蓋 discord* 三欄，`alias` 永遠不會被蓋掉。顯示優先序為 `alias` → `discordNickName` → `discordHandle`。舊格式（`handle` / `alias` / `id`）會自動搬遷，localStorage 的舊快取在開站時轉換並立即寫回。新增 `pnpm members` 從 Discord 伺服器一次抓回所有成員（需 Bot Token，設定步驟見 docs/discord-bot-setup.md）。
