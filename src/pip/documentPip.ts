// 子母畫面（Document Picture-in-Picture）：把頁面上的一塊 DOM 搬到一個永遠置頂的小視窗。
// 打王時遊戲佔滿整個螢幕，瀏覽器在背景就看不到倒數了，這個視窗會浮在最上面。
// 只有 Chromium 系列支援；其他瀏覽器就當作沒有這個功能。

interface PipOptions {
  width?: number
  height?: number
}

interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>
  window: Window | null
}

function api(): DocumentPictureInPicture | null {
  const w = window as unknown as { documentPictureInPicture?: DocumentPictureInPicture }
  return w.documentPictureInPicture ?? null
}

export function pipSupported(): boolean {
  return api() != null
}

// 樣式表不會跟著節點走，得整份複製過去，否則搬過去的內容會變成裸 HTML。
// 跨網域的樣式表讀不到 cssRules，改用 link 帶過去。
export function copyStyles(from: Document, to: Document): void {
  for (const sheet of Array.from(from.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join('\n')
      const style = to.createElement('style')
      style.textContent = css
      to.head.appendChild(style)
    } catch {
      if (!sheet.href) continue
      const link = to.createElement('link')
      link.rel = 'stylesheet'
      link.href = sheet.href
      to.head.appendChild(link)
    }
  }
}

/** 開一個子母畫面視窗；不支援或使用者拒絕時回 null */
export async function openPipWindow(opts: PipOptions = {}): Promise<Window | null> {
  const pip = api()
  if (!pip) return null
  try {
    const win = await pip.requestWindow({
      width: opts.width ?? 420,
      height: opts.height ?? 560,
    })
    copyStyles(document, win.document)
    win.document.body.classList.add('app', 'pip-body')
    return win
  } catch {
    return null
  }
}
