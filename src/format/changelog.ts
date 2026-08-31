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
// 以及檔案開頭的套件名標題（彈窗本身已經叫「更新內容」）
export function stripNoise(md: string): string {
  return md
    .replace(/^#\s+\S[^\n]*\n+/, '')
    .replace(/^(\s*[-*]\s+)[0-9a-f]{7,40}:\s*/gm, '$1')
}

export async function fetchChangelog(url: string = CHANGELOG_RAW_URL): Promise<string> {
  const res = await fetch(url, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`抓取失敗（HTTP ${res.status}）`)
  return rebaseLinks(stripNoise(await res.text()))
}
