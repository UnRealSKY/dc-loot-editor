# dc-loot-editor

## 1.2.0

### Minor Changes

- db925df: 新增「代售」功能：記錄某團員代賣的物品／金額（獨立清單，代售者限團員），
  併入分配結算——結算 = 收入 − 自己代售額，避免金幣二次轉手被遊戲扣手續費。
  分配面板於有代售時顯示「代售」「結算」兩欄；DC 格式新增 `## 代售` 區塊、
  分配行末端補 `- <代售額>`，匯入相容。

## 1.1.0

### Minor Changes

- bf1742e: 分配金額改為無條件進位（`Math.ceil`）：每人基本、他人內購/(人數 −1)、個人收入與序列化輸出一律向上取整，避免因四捨五入使團員少拿。

## 1.0.1

### Patch Changes

- c8f5b1d: 修正發版不產生 git tag 的問題：private 套件在 changeset 預設下不被打 tag，
  於 config.json 設 `privatePackages: { version: true, tag: true }`；並將
  `changeset tag` 移到 `# Version` commit 之後，使版本 tag 指向 package.json
  已是新版號的 commit。

## 1.0.0

### Major Changes

- 46ea76d: 首次正式發佈：DC 打王分寶 editor

  - 表單化編輯：總表（單價 × 數量、剪刀成本）、內購（限團員）、直播檔、即時分配面板
  - 分配公式：總表均分 + 他人內購/(人數 −1) − 自己內購；人數由團員數推導
  - 貼上／複製 DC round-trip，相容 emoji 與短碼、@名稱與 <@數字 ID>
  - 歷史建議（品名、團員、帶日期單價、王名）、多筆紀錄以 localStorage 保存
  - pnpm + changeset 版本管控、GitHub Actions 手動發版部署至 GitHub Pages
