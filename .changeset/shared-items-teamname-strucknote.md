---
"dc-loot-editor": minor
---

- 共用品名清單：app 執行期直讀 repo 的 items.json（raw fetch + localStorage 快取），
  併入品名 autocomplete；更新只需 push git、不必發版。
- 「王名」欄位標籤改為「團名」。
- 標記「不計入」時自動帶上註解「(價格過低不計入)」（已有自訂註解則保留；離開不計入
  且為自動值時清除）。
