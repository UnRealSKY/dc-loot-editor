import { createRouter, createWebHashHistory } from 'vue-router'
import ShieldTimer from './components/ShieldTimer.vue'

// 兩個工具箱各一個區段。BOSS 工具箱是用得最多的，所以放在根路徑，
// 也因此直接靜態引入——開站第一眼就是它，沒必要再多載一支 chunk。
const routes = [
  { path: '/', redirect: '/boss-toolkit' },
  { path: '/boss-toolkit', component: ShieldTimer },
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
