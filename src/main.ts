import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { initRoster } from './store/roster'

// number 輸入聚焦時，滾輪會意外增減數值；聚焦中滾動時讓它失焦，
// 頁面照常捲動、數值不被誤改。
document.addEventListener(
  'wheel',
  (e) => {
    const el = e.target as HTMLElement
    if (el instanceof HTMLInputElement && el.type === 'number' && document.activeElement === el) {
      el.blur()
    }
  },
  { passive: true },
)

createApp(App).use(createPinia()).use(router).mount('#app')

// 背景載入共用團員名冊（raw fetch，失敗則沿用 localStorage 快取）
initRoster()
