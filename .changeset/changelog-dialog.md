---
'dc-loot-editor': minor
---

appbar 右上角顯示目前版本號，點一下開「更新內容」彈窗。內容是執行期直讀 repo 上的 CHANGELOG.md（跟 members.json 同一個模式），所以改了 push 上去就看得到，不必為了更新文案發一次版；未來 CHANGELOG 裡放圖片也能正常顯示。用 snarkdown 渲染（gzip 約 1KB），並自動去掉只對開發者有意義的 commit hash 前綴。離線或抓取失敗時會提示並附上 GitHub 連結，版本號本身不依賴網路。
