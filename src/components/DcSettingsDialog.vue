<script setup lang="ts">
import { ref, watch } from 'vue'
import { normalizeWebhookUrl, getWebhook, type WebhookInfo } from '../dc/webhook'
import { webhookUrl, setWebhookUrl, clearWebhookUrl } from '../store/webhook'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const stored = webhookUrl()
const input = ref('')
const busy = ref(false)
const error = ref('')
const info = ref<WebhookInfo | null>(null)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      input.value = stored.value
      error.value = ''
      info.value = null
    }
  },
)

async function saveAndVerify() {
  error.value = ''
  info.value = null
  const norm = normalizeWebhookUrl(input.value)
  if (!norm.ok) {
    error.value = norm.error
    return
  }
  busy.value = true
  try {
    info.value = await getWebhook(norm.url)
    setWebhookUrl(norm.url)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

function clear() {
  clearWebhookUrl()
  input.value = ''
  info.value = null
  error.value = ''
}
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <div class="dialog">
      <h3>DC Webhook 設定</h3>
      <p class="muted note">
        目標頻道必須是<strong>論壇頻道</strong>（一般文字頻道無法由 webhook 建立討論串）。
        Webhook URL 等同密鑰，勿貼到公開頻道；共用電腦用畢請清除。
      </p>
      <input v-model="input" placeholder="https://discord.com/api/webhooks/…"
        autocomplete="off" spellcheck="false" @input="error = ''" />
      <p v-if="error" class="field-error">{{ error }}</p>
      <p v-if="info" class="verified">
        ✓ 已驗證並儲存：<strong>{{ info.name }}</strong>
        <span class="muted">（頻道 {{ info.channelId }}）</span>
      </p>
      <div class="actions">
        <button v-if="stored" type="button" class="btn btn-ghost btn-danger" @click="clear">清除</button>
        <div class="spacer" />
        <button type="button" class="btn btn-ghost" @click="emit('close')">關閉</button>
        <button type="button" class="btn btn-primary" :disabled="busy" @click="saveAndVerify">
          {{ busy ? '驗證中…' : '驗證並儲存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
  background: rgba(17, 24, 39, .5); backdrop-filter: blur(2px); padding: 20px;
}
.dialog {
  background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-lg);
  padding: 20px; width: min(560px, 92vw);
}
.dialog h3 { margin: 0 0 10px; font-size: 16px; font-weight: 650; }
.note { margin: 0 0 12px; font-size: 13px; }
.dialog input { font-family: var(--mono); font-size: 13px; }
.field-error { margin: 8px 0 0; }
.verified { margin: 10px 0 0; font-size: 13.5px; color: var(--success); }
.actions { display: flex; gap: 8px; margin-top: 14px; align-items: center; }
.actions .spacer { flex: 1; }
</style>
