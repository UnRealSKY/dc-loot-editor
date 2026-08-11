import { createRouter, createWebHashHistory } from 'vue-router'
import RecordList from './components/RecordList.vue'

const routes = [
  { path: '/', component: RecordList },
  { path: '/edit/:id', component: () => import('./components/RecordEditor.vue') },
  { path: '/pending', component: () => import('./components/PendingOverview.vue') },
  { path: '/settings', component: () => import('./components/SettingsPage.vue') },
  { path: '/shield', component: () => import('./components/ShieldTimer.vue') },
]

export const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})
