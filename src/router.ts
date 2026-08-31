import { createRouter, createWebHashHistory } from 'vue-router'
import BossToolkit from './components/BossToolkit.vue'
import { bossId } from './boss/bossId'

// 兩個工具箱各一個區段。BOSS 工具箱是用得最多的，所以放在根路徑，
// 也因此直接靜態引入——開站第一眼就是它，沒必要再多載一支 chunk。
//
// 選哪隻王寫在網址裡，這樣「杜納斯的計時器」本身就是一個可以貼給隊友、
// 可以加書籤的東西。不帶王的 /boss-toolkit 導到上次選的那隻（bossId 開站
// 時就從 localStorage 讀好了），跟改版前直接進站的行為一樣。
export const routes = [
  { path: '/', redirect: '/boss-toolkit' },
  { path: '/boss-toolkit', redirect: () => `/boss-toolkit/${bossId.value}` },
  { path: '/boss-toolkit/:bossId', component: BossToolkit },
  { path: '/loot', component: () => import('./components/RecordList.vue') },
  { path: '/loot/edit/:id', component: () => import('./components/RecordEditor.vue') },
  { path: '/loot/pending', component: () => import('./components/PendingOverview.vue') },
  { path: '/loot/settings', component: () => import('./components/SettingsPage.vue') },
  // 改版前的網址：舊書籤不要變成空白頁
  { path: '/shield', redirect: '/boss-toolkit' },
  { path: '/pending', redirect: '/loot/pending' },
  { path: '/settings', redirect: '/loot/settings' },
  { path: '/edit/:id', redirect: (to: { params: Record<string, unknown> }) => `/loot/edit/${to.params.id}` },
]

export const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})
