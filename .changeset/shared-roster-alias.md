---
"dc-loot-editor": minor
---

共用團員名冊與別名：app 執行期直讀 repo 的 members.json（raw fetch + localStorage
快取），更新名冊只需 push git、不必發版。團員 handle 對應別名後於 UI 顯示（團員列、
內購、代售、分配），DC 序列化/解析仍用 handle 以便貼回自動識別。建議選單 =
共用名冊 ∪ 本機歷史，下拉顯示「別名 (handle)」。
