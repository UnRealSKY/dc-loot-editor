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

/**
 * 把內容縮到剛好塞滿視窗——小視窗裡出現捲軸就等於看不到下面那半。
 * zoom 縮小後 viewport 的 CSS 寬度會等比變大，body 維持 100% 就會自己填滿，
 * 不需要（也不能）再去撐寬度，撐了反而右邊溢出被切掉。
 * 縮放會改變換行進而改變高度，所以跑幾輪讓它收斂。
 */
export function fitToWindow(win: Window): void {
  const b = win.document.body
  const have = win.innerHeight
  if (!have) return
  // 用 transform 而不是 zoom：zoom 會改變佈局寬度，內容跟著重新換行、
  // 高度反覆變動，比例算不收斂。transform 只影響外觀，排版完全不動。
  b.style.transformOrigin = 'top left'
  b.style.transform = 'none'
  b.style.width = '100%'
  const natural = b.scrollHeight
  if (natural <= have) return // 本來就塞得下，不用縮
  // 先算出要縮多少，再把佈局寬度按同一比例撐開，縮回來才會剛好填滿視窗寬。
  const z0 = have / natural
  b.style.width = `${100 / z0}%`
  // 撐寬之後換行變少、高度通常會降；但萬一反而更高就得縮更多，取保守的那個
  const widened = b.scrollHeight
  const z = Math.max(0.3, Math.min(z0, have / Math.max(1, widened)))
  b.style.transform = `scale(${z})`
}

/** 內容一變（換王、開始擷取、字型載入）或視窗被拉大縮小時重新縮放 */
export function keepFitted(win: Window): void {
  const fit = () => fitToWindow(win)
  // 視窗剛開時版面還沒穩定，量到的高度會偏小，隔幾拍再各量一次
  const settle = () => {
    fit()
    win.requestAnimationFrame(fit)
    win.setTimeout(fit, 300)
    win.setTimeout(fit, 1000)
  }
  settle()
  win.addEventListener('resize', fit)
  const RO = (win as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver
  if (RO) {
    const ro = new RO(() => fit())
    ro.observe(win.document.body) // 總高度變了就重算，這是主要的觸發來源
    for (const el of Array.from(win.document.body.children)) ro.observe(el)
  }
  const MO = (win as unknown as { MutationObserver?: typeof MutationObserver }).MutationObserver
  // 只看直接子元素的增減（換王會整塊換掉）；倒數每幀都在改文字，不能跟著跑
  if (MO) new MO(settle).observe(win.document.body, { childList: true })
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
    // 縮放後 body 佔的位置仍是原尺寸，捲軸交給 overflow 藏起來
    win.document.documentElement.style.overflow = 'hidden'
    return win
  } catch {
    return null
  }
}
