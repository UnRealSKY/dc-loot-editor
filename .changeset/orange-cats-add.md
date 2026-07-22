---
"dc-loot-editor": major
---

首次正式發佈：DC 打王分寶 editor

- 表單化編輯：總表（單價×數量、剪刀成本）、內購（限團員）、直播檔、即時分配面板
- 分配公式：總表均分 + 他人內購/(人數−1) − 自己內購；人數由團員數推導
- 貼上／複製 DC round-trip，相容 emoji 與短碼、@名稱與 <@數字ID>
- 歷史建議（品名、團員、帶日期單價、王名）、多筆紀錄以 localStorage 保存
- pnpm + changeset 版本管控、GitHub Actions 手動發版部署至 GitHub Pages
