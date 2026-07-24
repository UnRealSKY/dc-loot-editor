# dc-loot-editor

## 1.4.0

### Minor Changes

- 6dbe7fc: 共用團員名冊與別名：app 執行期直讀 repo 的 members.json（raw fetch + localStorage
  快取），更新名冊只需 push git、不必發版。團員 handle 對應別名後於 UI 顯示（團員列、
  內購、代售、分配），DC 序列化/解析仍用 handle 以便貼回自動識別。建議選單 =
  共用名冊 ∪ 本機歷史，下拉顯示「別名 (handle)」。

### Patch Changes

- f54f31e: 總表新增項目調整：狀態預設「待售」、數量預設空白（單價/剪刀價/剪刀數本就空白）。
  修正品名/王名 autocomplete：還原為前綴比對（別名欄才用顯示文字子字串比對）。
- 62aef47: 狀態循環順序改為 待售 → 售出 → 不計入；不計入圖標改用 ✖（DC 輸出 struck 行改
  `:heavy_multiplication_x:`，解析相容舊的 `:shopping_cart:`）。

## 1.3.0

### Minor Changes

- d93561a: 代售支援剪刀成本：代售的物品若需消耗剪刀交易，剪刀成本從代售者持有額扣除
  （持有淨額 = 單價 × 數量 − 剪刀單價 × 剪刀數），同總表。編輯卡片加剪刀價/剪刀數欄，
  DC 代售行支援 `= 300x1 - 80(剪刀)x2` 寫法，匯入相容。

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
