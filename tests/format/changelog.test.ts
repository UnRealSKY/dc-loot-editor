import { describe, it, expect } from 'vitest'
import { rebaseLinks, stripNoise, CHANGELOG_RAW_URL, CHANGELOG_PAGE_URL } from '#src/format/changelog'

describe('rebaseLinks', () => {
  it('圖片的相對路徑指向 raw（要拿到真的圖檔）', () => {
    expect(rebaseLinks('![截圖](docs/screenshots/01-list.png)')).toBe(
      '![截圖](https://raw.githubusercontent.com/UnRealSKY/maplestory-toolkit/main/docs/screenshots/01-list.png)',
    )
  })

  it('一般連結的相對路徑指向 GitHub 頁面（要能瀏覽）', () => {
    expect(rebaseLinks('[設定步驟](docs/discord-bot-setup.md)')).toBe(
      '[設定步驟](https://github.com/UnRealSKY/maplestory-toolkit/blob/main/docs/discord-bot-setup.md)',
    )
  })

  it('已經是絕對網址的不動', () => {
    const md = '[官網](https://example.com/x) ![遠端圖](https://cdn.example.com/a.png)'
    expect(rebaseLinks(md)).toBe(md)
  })

  it('錨點與 mailto 不動', () => {
    const md = '[跳到章節](#設定) [寄信](mailto:a@b.c)'
    expect(rebaseLinks(md)).toBe(md)
  })

  it('去掉 ./ 前綴，不產生雙斜線', () => {
    expect(rebaseLinks('![x](./docs/a.png)')).toContain('/main/docs/a.png')
    expect(rebaseLinks('![x](./docs/a.png)')).not.toContain('main/./')
  })

  it('圖片不會被一般連結的規則重複改寫', () => {
    const out = rebaseLinks('![圖](docs/a.png)')
    expect(out.match(/https:\/\//g)).toHaveLength(1)
    expect(out).toContain('raw.githubusercontent.com')
    expect(out).not.toContain('/blob/')
  })

  it('同一行有圖片也有連結時各自轉對', () => {
    const out = rebaseLinks('![圖](docs/a.png) 與 [文件](docs/b.md)')
    expect(out).toContain('raw.githubusercontent.com/UnRealSKY/maplestory-toolkit/main/docs/a.png')
    expect(out).toContain('github.com/UnRealSKY/maplestory-toolkit/blob/main/docs/b.md')
  })

  it('沒有連結的內容原樣通過', () => {
    const md = '## 1.18.0\n\n- 設定頁移回右上角的齒輪 ⚙'
    expect(rebaseLinks(md)).toBe(md)
  })

  it('公開的兩個網址指向同一份檔案', () => {
    expect(CHANGELOG_RAW_URL).toContain('raw.githubusercontent.com')
    expect(CHANGELOG_RAW_URL).toMatch(/CHANGELOG\.md$/)
    expect(CHANGELOG_PAGE_URL).toContain('github.com')
    expect(CHANGELOG_PAGE_URL).toMatch(/CHANGELOG\.md$/)
  })
})

describe('stripNoise', () => {
  const sample = [
    '# maplestory-toolkit',
    '',
    '## 1.18.0',
    '',
    '### Minor Changes',
    '',
    '- 23cba24: 設定頁移回右上角的齒輪',
    '- 2955f3fa1b2c3d4: 另一條（長 hash）',
    '',
    '## 1.17.0',
    '',
    '- 一般條目沒有 hash',
  ].join('\n')

  it('去掉每條前面的 commit hash', () => {
    const out = stripNoise(sample)
    expect(out).toContain('- 設定頁移回右上角的齒輪')
    expect(out).not.toContain('23cba24')
    expect(out).not.toContain('2955f3fa1b2c3d4')
  })

  it('去掉檔案開頭的套件名標題，但保留版本標題', () => {
    const out = stripNoise(sample)
    expect(out).not.toContain('# maplestory-toolkit')
    expect(out).toContain('## 1.18.0')
  })

  it('去掉 changeset 的分級標題——看更新的人不需要知道這是 minor 還是 patch', () => {
    expect(stripNoise(sample)).not.toContain('Minor Changes')
    expect(stripNoise('### Patch Changes\n\n- 修好了')).toBe('- 修好了')
    expect(stripNoise('### Major Changes\n\n- 大改')).toBe('- 大改')
  })

  it('不會誤刪其他的三級標題', () => {
    expect(stripNoise('### 已知問題\n\n- x')).toContain('### 已知問題')
  })

  it('沒有 hash 的條目原樣保留', () => {
    expect(stripNoise(sample)).toContain('- 一般條目沒有 hash')
  })

  it('不會誤刪內文裡的冒號', () => {
    expect(stripNoise('- 修正：金額算錯')).toBe('- 修正：金額算錯')
  })

  it('不會把像 hash 的中文內容當前綴刪掉', () => {
    expect(stripNoise('- abcdef: 只有六碼不是 hash')).toBe('- abcdef: 只有六碼不是 hash')
  })
})
