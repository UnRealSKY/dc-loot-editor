import { ref } from 'vue'

// Webhook URL 等同密鑰：只存本機 localStorage，共用電腦用畢應清除
const STORAGE_KEY = 'dc-webhook-url'

const url = ref<string>(localStorage.getItem(STORAGE_KEY) ?? '')

export function webhookUrl() {
  return url
}

export function setWebhookUrl(v: string): void {
  url.value = v
  localStorage.setItem(STORAGE_KEY, v)
}

export function clearWebhookUrl(): void {
  url.value = ''
  localStorage.removeItem(STORAGE_KEY)
}
