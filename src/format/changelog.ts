// 更新內容：執行期直讀 repo 上的 CHANGELOG.md，跟 members.json 同一個模式——
// 改了 push 上去就看得到，不必為了改文案發一次版。
//
// 代價是相對路徑要自己處理：markdown 裡寫 ![](docs/x.png) 會相對於
// github.io/maplestory-toolkit/ 而失效，所以渲染前先改寫成絕對網址。

const REPO = 'UnRealSKY/maplestory-toolkit'
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/main/`
const BLOB_BASE = `https://github.com/${REPO}/blob/main/`

export const CHANGELOG_RAW_URL = `${RAW_BASE}CHANGELOG.md`
export const CHANGELOG_PAGE_URL = `${BLOB_BASE}CHANGELOG.md`

const ABSOLUTE = /^(https?:|data:|mailto:|#)/

// <https://...> 是 markdown 的 autolink，但 snarkdown 不認得，會把它當成原始
// HTML 吐出去、瀏覽器再當成不認識的標籤丟掉——網址就這樣整個消失。先展開成
// 正規的連結寫法
export function expandAutolinks(md: string): string {
  return md.replace(/<(https?:\/\/[^\s<>]+)>/g, '[$1]($1)')
}

function join(base: string, path: string): string {
  return base + path.replace(/^\.?\//, '')
}

// 圖片指向 raw（要拿到真的圖檔），一般連結指向 GitHub 頁面（要能瀏覽）
export function rebaseLinks(md: string): string {
  return md
    .replace(/!\[([^\]]*)\]\(([^)\s]+)/g, (whole, alt: string, path: string) =>
      ABSOLUTE.test(path) ? whole : `![${alt}](${join(RAW_BASE, path)}`,
    )
    .replace(/(^|[^!])\[([^\]]*)\]\(([^)\s]+)/g, (whole, before: string, text: string, path: string) =>
      ABSOLUTE.test(path) ? whole : `${before}[${text}](${join(BLOB_BASE, path)}`,
    )
}

// 去掉只對開發者有意義的東西：changeset 加在每條前面的 commit hash，
// 檔案開頭的套件名標題（彈窗本身已經叫「更新內容」），以及 changeset 依版號級距
// 產生的 Minor / Patch Changes 分節標題——那是發版用的分級，對看更新的人沒有
// 意義，而且每發一次版就會再長出來一份，只能在這裡拿掉
export function stripNoise(md: string): string {
  return md
    .replace(/^#\s+\S[^\n]*\n+/, '')
    .replace(/^###\s+(Major|Minor|Patch)\s+Changes\s*\n+/gm, '')
    .replace(/^(\s*[-*]\s+)[0-9a-f]{7,40}:\s*/gm, '$1')
}

export async function fetchChangelog(url: string = CHANGELOG_RAW_URL): Promise<string> {
  const res = await fetch(url, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`抓取失敗（HTTP ${res.status}）`)
  return rebaseLinks(expandAutolinks(stripNoise(await res.text())))
}
