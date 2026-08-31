---
'maplestory-toolkit': minor
---

存在瀏覽器裡的東西統一前綴：BOSS 工具箱的用 `maplestory-boss-toolkit-`，分寶工具箱的用 `dc-loot-`。原本兩邊混著站還叫 dc-loot-editor 時留下的名字（`dc-shield-*`、`dc-hp-lead`、`dc-groups`、`dc-active-group`、`dc-items-source`）。開頁面時會自動把舊的搬到新的並清掉，使用者不用做任何事；新舊都有值時以新的為準。更早期版本的遷移標記（`dc-webhook-url`、`dc-loot-roster`、`dc-roster-source`）刻意不改名——那是判斷有沒有舊資料的依據。
