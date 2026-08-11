# 用 Discord Bot 同步團員名冊

`members.json` 的 `id` 欄位（Discord 使用者 ID）是發佈時「真 mention」用的。
一個個右鍵複製很煩，這支腳本可以一次抓回整個伺服器的成員：

```bash
pnpm members
```

**狀態：腳本已經寫好可用（`scripts/fetch-members.mjs`），還差 Discord 端的設定。**

---

## 為什麼不能做成網頁上的按鈕

這件事試過了，**行不通**，別再花時間。

Discord 會擋掉帶瀏覽器 User-Agent 的 API 請求。實測（同一個 token，只改請求標頭）：

| 請求標頭 | 回應 |
|---|---|
| Origin + Authorization | **401**（API 正常處理，只是嫌 token 無效） |
| ＋ `Sec-Fetch-Site` / `Sec-Fetch-Mode` | 401 |
| **＋ 瀏覽器 User-Agent** | **403**，且回應不帶 CORS 標頭 |

用**有效 token** 從瀏覽器實測的結果也一樣：`OPTIONS 200 → GET 403 → Failed to fetch`。
所以這不是 token 或 CORS 設定的問題，是 Discord 的反濫用機制——不讓 bot token 出現在網頁裡。

`User-Agent` 是 fetch 的 forbidden header，JS 改不了，因此瀏覽器路線無解。
（現有的 webhook 發佈功能之所以能在瀏覽器運作，是因為 webhook 的 token 藏在 URL
路徑裡，根本不需要 `Authorization` header，兩者待遇完全不同。）

## 這不需要公開 IP，也不需要常駐服務

```
你可能想的那種 bot（不是這個）：
   Discord ──── 推訊息過來 ────> 你的機器
   （必須 24 小時開著、要有公開位址）

這支腳本：
   你的電腦 ──「把成員名單給我」──> Discord
            <────── 一包 JSON ──────
   （3 秒跑完，關掉。跟瀏覽器開網頁一樣）
```

連線是**你打出去**的，不是 Discord 打進來。家用網路、浮動 IP、防火牆全都沒差。
「Bot」在這裡只是 Discord 用來發權杖的名目，不是一個要跑起來的服務。
網站本身完全不受影響，仍然是純靜態站。

---

## 第一件事：去 Discord 拿兩串字

**① Token**

1. 開 <https://discord.com/developers/applications>
2. 右上 **New Application** → 名字隨意（例如 `dc-loot-members`）→ 建立
3. 左側選單 **Bot**
4. **Reset Token** → 確認 → **複製那串 token**

> ⚠️ Token 只會顯示這一次，關掉頁面就看不到了（要再看只能 Reset 產生新的）。

**② 解鎖成員清單權限**（沒做這步會回 403）

5. 還在 **Bot** 頁面，往下捲到 **Privileged Gateway Intents**
6. 打開 **SERVER MEMBERS INTENT**
7. 按 **Save Changes**

**③ 把 bot 邀進伺服器**（沒做這步會回 404）

8. 左側選單 **OAuth2** → 找到 **URL Generator**
9. **Scopes** 只勾 **bot**（下面跑出來的 Bot Permissions 一個都不用勾）
10. 複製頁面最下方產生的網址 → 在瀏覽器開啟 → 選你的伺服器 → 授權

> Bot 會出現在成員列表且永遠顯示離線——這是正常的，它本來就沒有要連線。
> 權限一個都不勾，是為了讓這串 token 就算外洩，能做的也只有讀成員名單。

**④ 伺服器 ID**

11. Discord 應用程式 → 設定（左下齒輪）→ **進階** → 打開 **開發者模式**
12. 右鍵你的伺服器圖示 → **複製伺服器 ID**

## 第二件事：貼進 .env 跑指令

專案根目錄建立 `.env`（已在 `.gitignore`，不會進版控）：

```
DISCORD_BOT_TOKEN=第 4 步複製的 token
DISCORD_GUILD_ID=第 12 步複製的伺服器 ID
```

然後：

```bash
pnpm members
```

完成。以後有新團員加入，重跑這行就好。

> 🔑 Token 等於帳號鑰匙。**絕對不能**寫進網站程式碼——這是純靜態站，
> 任何寫進去的憑證所有人都看得到。它只該存在你本機的 `.env`。

---

## 腳本會做什麼

名冊每個人有四個欄位，同步**只碰前三個**：

| 欄位 | 同步時 |
|---|---|
| `discordHandle` | 更新（有人改帳號名就跟著改） |
| `discordNickName` | 更新成 Discord 顯示名（伺服器暱稱 → 全域顯示名 → 帳號名） |
| `discordId` | 補上 |
| `alias` | **原樣保留，永遠不碰** |

- **用 `discordId` 對應**既有名冊，不是用 handle。有人改 Discord 帳號名時會正確認出是同一個人
  並更新 handle，不會誤判成「舊的退出＋新的加入」。
- 自動排除 bot 帳號。
- 已離開伺服器的人會從名冊移除。
- 印出新增／移除／改名／`discordNickName` 變更的摘要。

想讓某個人在畫面上顯示簡稱（例如把「天天(UnRealSKY)」顯示成「天天」），就在名單管理頁
的**自訂別名**欄填「天天」——顯示優先序是 `alias` → `discordNickName` → `discordHandle`，
而且往後同步都不會被蓋掉。

改完先 `git diff members.json` 看一眼，不對就 `git checkout members.json` 還原。

## 出錯時

| 訊息 | 原因 |
|---|---|
| `401：token 無效` | `DISCORD_BOT_TOKEN` 填錯（別填成 Webhook URL） |
| `403：沒有權限` | 忘了開 **SERVER MEMBERS INTENT**（上面第 6 步） |
| `404：找不到伺服器` | `DISCORD_GUILD_ID` 錯，或 bot 還沒邀進伺服器（上面第 10 步） |

> 腳本尚未對真實 Discord API 跑過（撰寫時沒有 token）。
> 合併名冊的純函式有測試涵蓋，但 API 互動要等第一次實跑才算驗證過。
