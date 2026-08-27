<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useRecordsStore } from './store/records'
import { dcSyncStatus } from './dc/publish'
import ChangelogDialog from './components/ChangelogDialog.vue'
import pkg from '../package.json'

// 版本號從 package.json 讀（CI 發版時更新的權威來源），不依賴網路
const version = pkg.version
const showChangelog = ref(false)

// 關閉分頁守衛：只管「當下正在編輯的這一筆」。掃全部紀錄會讓刻意留著不同步的
// 場次（例如東西還在慢慢賣）每次關分頁都跳提醒。
// 先跳瀏覽器標準確認；使用者選擇留下（頁面仍存活）→ 再跳自訂 dialog 補上原因。
const store = useRecordsStore()
const route = useRoute()
const showUnsynced = ref(false)

const currentDirty = computed(() => {
  if (!route.path.startsWith('/edit/')) return undefined
  const r = store.get(route.params.id as string)
  return r && dcSyncStatus(r) === 'dirty' ? r : undefined
})

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!currentDirty.value) return
  e.preventDefault()
  e.returnValue = '' // 觸發瀏覽器標準「未儲存變更」確認
  setTimeout(() => {
    // 走到這裡代表使用者取消了關閉，補上原因說明
    if (currentDirty.value) showUnsynced.value = true
  }, 400)
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
</script>

<template>
  <div class="app">
    <header class="appbar">
      <router-link to="/" class="brand">
        <span class="logo">分</span>
        <h1>DC 打王分寶 Editor</h1>
      </router-link>
      <nav class="nav">
        <router-link to="/" class="nav-link" exact-active-class="nav-active">分寶紀錄</router-link>
        <router-link to="/pending" class="nav-link" active-class="nav-active">未領總覽</router-link>
        <router-link to="/shield" class="nav-link" active-class="nav-active">機制計算機</router-link>
      </nav>
      <div class="appbar-spacer" />
      <button type="button" class="btn btn-ghost btn-sm version" title="看更新內容"
        @click="showChangelog = true">v{{ version }}</button>
      <router-link to="/settings" class="btn btn-icon gear" active-class="gear-active"
        title="設定（DC 群組、名單、品名清單）">⚙</router-link>
    </header>

    <ChangelogDialog :open="showChangelog" @close="showChangelog = false" />

    <div v-if="showUnsynced" class="unsync-overlay" @click.self="showUnsynced = false">
      <div class="unsync-dialog">
        <h3>這筆紀錄尚未同步到 DC</h3>
        <p class="unsync-note">資料已存在本機，不會遺失；要更新 DC 貼文請按「同步至 DC」。</p>
        <div class="unsync-actions">
          <button type="button" class="btn btn-primary" @click="showUnsynced = false">知道了</button>
        </div>
      </div>
    </div>

    <router-view />
  </div>
</template>

<style>
:root {
  --font: 'Segoe UI', system-ui, -apple-system, 'Noto Sans TC', 'Microsoft JhengHei', sans-serif;
  --mono: 'JetBrains Mono', 'Consolas', 'Menlo', monospace;
  --bg: #f3f4f6;
  --surface: #ffffff;
  --surface-2: #f9fafb;
  --border: #e5e7eb;
  --border-strong: #d1d5db;
  --text: #1f2937;
  --text-muted: #6b7280;
  --primary: #6366f1;
  --primary-hover: #4f46e5;
  --primary-soft: #eef2ff;
  --success: #15803d;
  --success-soft: #dcfce7;
  --warn: #b45309;
  --warn-soft: #fef3c7;
  --danger: #dc2626;
  --danger-soft: #fee2e2;
  --info-soft: #e0f2fe;
  --info: #0369a1;
  --radius: 12px;
  --radius-sm: 8px;
  --shadow-sm: 0 1px 2px rgba(16, 24, 40, .06), 0 1px 3px rgba(16, 24, 40, .08);
  --shadow-md: 0 4px 6px -1px rgba(16, 24, 40, .08), 0 2px 4px -2px rgba(16, 24, 40, .05);
  --shadow-lg: 0 20px 25px -5px rgba(16, 24, 40, .14), 0 8px 10px -6px rgba(16, 24, 40, .08);
}

* { box-sizing: border-box; }
html, body { margin: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 15px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

.app { max-width: 980px; margin: 0 auto; padding: 0 20px 72px; }

/* ---- App bar ---- */
.appbar {
  position: sticky; top: 0; z-index: 30;
  margin: 0 -20px 26px; padding: 13px 20px;
  display: flex; align-items: center; gap: 24px;
  background: rgba(255, 255, 255, .82);
  backdrop-filter: saturate(1.4) blur(10px);
  border-bottom: 1px solid var(--border);
}
.nav { display: flex; gap: 4px; }
.appbar-spacer { flex: 1; }
.nav-link {
  text-decoration: none; color: var(--text-muted);
  font-size: 14px; font-weight: 550; padding: 6px 13px; border-radius: 999px;
  transition: color .14s, background .14s;
  white-space: nowrap; /* 中文每字都是斷點，不鎖住會被擠成一字一行 */
}
.nav-link:hover { color: var(--text); background: var(--surface-2); }
.nav-active { color: var(--primary-hover); background: var(--primary-soft); }
.brand { display: inline-flex; align-items: center; gap: 11px; text-decoration: none; color: inherit; }
.brand .logo {
  width: 32px; height: 32px; border-radius: 9px; flex: none;
  display: grid; place-items: center; color: #fff; font-weight: 800; font-size: 16px;
  background: linear-gradient(135deg, var(--primary), #8b5cf6);
  box-shadow: var(--shadow-sm);
}
.brand h1 { margin: 0; font-size: 18px; font-weight: 650; letter-spacing: .01em; }
.version {
  font-family: var(--mono); font-size: 12px; color: var(--text-muted); flex: none;
}
.version:hover { color: var(--text); }
.gear { text-decoration: none; font-size: 17px; }
.gear-active { color: var(--primary-hover); background: var(--primary-soft); }

/* ---- Buttons ---- */
button { font-family: inherit; }
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 15px; border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--surface); color: var(--text);
  font-size: 14px; font-weight: 550; line-height: 1; cursor: pointer;
  transition: background .14s, border-color .14s, color .14s, transform .06s, box-shadow .14s;
  white-space: nowrap;
}
.btn:hover { background: var(--surface-2); border-color: var(--border-strong); }
.btn:active { transform: translateY(1px); }
.btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--primary-soft); }
.btn-primary { background: var(--primary); border-color: var(--primary); color: #fff; box-shadow: var(--shadow-sm); }
.btn-primary:hover { background: var(--primary-hover); border-color: var(--primary-hover); }
.btn-sm { padding: 6px 11px; font-size: 13px; }
.btn-danger { color: var(--danger); }
.btn-danger:hover { background: var(--danger-soft); border-color: var(--danger); }
.btn-ghost { background: transparent; border-color: transparent; }
.btn-ghost:hover { background: var(--surface-2); border-color: var(--border); }
.btn-icon {
  padding: 0; width: 34px; height: 34px; flex: none; color: var(--text-muted);
  border-radius: var(--radius-sm);
}
.btn-icon:hover { color: var(--text); }
.btn-icon.btn-danger:hover { color: var(--danger); }

/* ---- Inputs ---- */
.app input:not([type=checkbox]):not([type=radio]),
.app textarea,
.app select {
  font-family: inherit; font-size: 14px; color: var(--text);
  padding: 8px 11px; width: 100%;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--surface);
  transition: border-color .14s, box-shadow .14s;
}
.app input::placeholder, .app textarea::placeholder { color: #9ca3af; }
.app input:focus, .app textarea:focus, .app select:focus {
  outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft);
}
.app input.field-invalid { border-color: var(--danger); }
.app input.field-invalid:focus { box-shadow: 0 0 0 3px var(--danger-soft); }
.app input[type=number] { text-align: right; font-variant-numeric: tabular-nums; }

/* ---- Cards & sections ---- */
.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); box-shadow: var(--shadow-sm);
  padding: 18px 20px; margin-bottom: 18px;
}
.section-head { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
.section-head h3 { margin: 0; font-size: 15px; font-weight: 650; white-space: nowrap; }
.section-head .spacer { flex: 1; }
.section-head .count { font-size: 12px; color: var(--text-muted); font-weight: 500; }

/* ---- Tables ---- */
.table-wrap { overflow-x: auto; margin: 0 -4px; }
.app table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 14px; }
.app thead th {
  text-align: left; font-weight: 600; font-size: 11.5px; letter-spacing: .03em;
  text-transform: none; color: var(--text-muted);
  padding: 6px 10px; border-bottom: 1px solid var(--border); white-space: nowrap;
}
.app tbody td { padding: 7px 10px; border-bottom: 1px solid var(--surface-2); vertical-align: middle; }
.app tbody tr:last-child td { border-bottom: none; }
.app tbody tr:hover { background: var(--surface-2); }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.app thead th.num { text-align: right; }

/* ---- Chips ---- */
.chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 11px; border-radius: 999px; border: 1px solid transparent;
  font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap;
  transition: filter .14s;
}
.chip:hover { filter: brightness(.96); }
.chip-ok { background: var(--success-soft); color: var(--success); }
.chip-cart { background: var(--info-soft); color: var(--info); }
.chip-struck { background: #f3f4f6; color: #9ca3af; }
.chip-pending { background: var(--warn-soft); color: var(--warn); }

/* ---- Alerts ---- */
.alert { padding: 9px 13px; border-radius: var(--radius-sm); font-size: 13.5px; margin: 0 0 14px; }
.alert-warn { background: var(--warn-soft); color: var(--warn); border: 1px solid #fcd888; }
.field-error { color: var(--danger); font-size: 12px; margin-top: 3px; display: block; }

/* ---- 未同步提醒 dialog ---- */
.unsync-overlay {
  position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center;
  background: rgba(17, 24, 39, .5); backdrop-filter: blur(2px); padding: 20px;
}
.unsync-dialog {
  background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-lg);
  padding: 20px; width: min(440px, 92vw);
}
.unsync-dialog h3 { margin: 0 0 8px; font-size: 16px; font-weight: 650; }
.unsync-note { margin: 0 0 12px; font-size: 13px; color: var(--text-muted); }
.unsync-actions { display: flex; justify-content: flex-end; margin-top: 14px; }

/* ---- 窄螢幕（手機）----
   通則：短標籤一律 nowrap，放不下時讓容器橫捲或整塊換行，
   絕不讓中文被擠成一字一行。 */
@media (max-width: 720px) {
  .app { padding: 0 14px 56px; }

  /* appbar 分兩行：brand ＋ 設定鈕一行，導覽列獨占第二行可橫捲 */
  .appbar { margin: 0 -14px 20px; padding: 10px 14px; gap: 10px; flex-wrap: wrap; }
  .brand h1 { font-size: 16px; }
  .nav { order: 3; width: 100%; overflow-x: auto; scrollbar-width: none; }
  .nav::-webkit-scrollbar { display: none; }

  .card { padding: 14px; margin-bottom: 14px; }
  .section-head { flex-wrap: wrap; }
  /* 表格原本被壓縮到容器寬，每格一起逐字折行；改成不小於內容自然寬度，
     .table-wrap 的 overflow-x 才會真的接手橫向捲動（欄少的表格則維持不捲） */
  .app table { min-width: max-content; }
  .empty { padding: 32px 16px; }
}

/* ---- Utility ---- */
.muted { color: var(--text-muted); }
.toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.empty {
  text-align: center; color: var(--text-muted); padding: 48px 20px;
  border: 1px dashed var(--border-strong); border-radius: var(--radius); background: var(--surface);
}

/* ---- 機制計算機的色塊面板（反盾與女皇兩種模板共用同一套視覺語言）----
   idle 灰＝還沒開始；attack 綠＝安全可打；shield 紅＝機制正在發生或即將發生。
   引信邊框與進度條都表示「本段剩多少」。 */
.phase-panel {
  position: relative; text-align: center; padding: 26px 20px;
  transition: background .25s, border-color .25s;
}

/* 引信：SVG 不設 viewBox，rect 用 100% 貼齊容器，所以圓角與線寬都不會被拉伸。
   pathLength=100 把周長正規化成 100，dasharray 直接吃百分比。 */
.fuse { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.fuse rect {
  x: 1.5px; y: 1.5px; width: calc(100% - 3px); height: calc(100% - 3px);
  rx: 11px; fill: none; stroke: currentColor; stroke-width: 3; stroke-linecap: round;
}
.phase-shield .fuse rect { stroke: var(--danger); }
.phase-attack .fuse rect { stroke: var(--success); }
.phase-idle { background: var(--surface-2); }
.phase-shield { background: var(--danger-soft); border-color: var(--danger); }
.phase-attack { background: var(--success-soft); border-color: var(--success); }
.phase-title { font-size: 22px; font-weight: 750; }
.phase-shield .phase-title { color: var(--danger); }
.phase-attack .phase-title { color: var(--success); }
.remaining-row { display: flex; align-items: center; justify-content: center; gap: 14px; }
.nudge { flex: none; font-variant-numeric: tabular-nums; }
.phase-remaining { font-size: 64px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.1; }
.phase-remaining .unit { font-size: 24px; font-weight: 600; margin-left: 4px; }
.phase-bar { height: 6px; border-radius: 999px; background: rgba(0,0,0,.08); margin: 12px auto 0; max-width: 420px; overflow: hidden; }
.phase-bar-fill { height: 100%; background: currentColor; opacity: .45; }

/* 對齊遊戲計時：反盾與女皇兩個面板共用 */
.anchor-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
/* 用 flex-basis 定寬：全域的 input{width:100%} 特異性較高，
   在有 spacer 的標題列裡會把輸入框整條撐開 */
.anchor-input { flex: 0 0 130px; font-family: var(--mono); font-size: 13px; }
.game-clock {
  font-family: var(--mono); font-variant-numeric: tabular-nums; font-size: 15px; font-weight: 750;
  padding: 3px 10px; border-radius: 6px; background: var(--primary-soft); color: var(--primary);
}

/* ---- 子母畫面：整組面板搬到一個很小的置頂視窗，字級與留白全部收緊 ---- */
.pip-body { margin: 0; padding: 8px; background: var(--bg); overflow: hidden; }
.pip-body.app { max-width: none; padding: 8px; }
.pip-body .card { margin-bottom: 6px; padding: 8px 10px; }
.pip-body .phase-panel { padding: 8px 10px; }
.pip-body .phase-title { font-size: 15px; }
.pip-body .phase-remaining { font-size: 26px; }
.pip-body .until-label { margin-top: 2px; font-size: 11px; }
.pip-body .phase-bar { margin-top: 6px; }
.pip-body .remaining-row, .pip-body .seg-row { margin-top: 2px; gap: 6px; }
.pip-body .ctrl { min-width: 0; padding: 6px 4px; font-size: 12px; }
.pip-body .controls { gap: 5px; }
/* 小視窗放不下也不需要的：操作說明、事件表、待機時的提示 */
.pip-body .ctrl-hint, .pip-body .phase-note, .pip-body .events-card { display: none; }
/* 小視窗裡排成一列：疊成多排會讓整體變高，等比縮下來字就小到看不清 */
.pip-body .cycle-grid {
  grid-template-columns: none !important;
  grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 5px;
}
.pip-body .cycle-item { padding: 6px 4px; }
.pip-body .cycle-item .phase-title { font-size: 13px; }
.pip-body .cycle-item .phase-remaining { font-size: 19px; }
.pip-body .cycle-item .trigger { margin-top: 5px; padding: 4px 6px; font-size: 12px; }
.pip-body .cycle-head { margin-bottom: 5px; }
/* 血量：標題那行收成一列小字，數字與血條擠在同一張卡裡 */
.pip-body .hp-card .section-head { margin-bottom: 4px; }
.pip-body .hp-card h3 { font-size: 13px; }
.pip-body .hp-percent { font-size: 26px; min-width: 5ch; }
.pip-body .hp-row { margin-top: 4px; }
.pip-body .hp-bar { height: 14px; }
</style>
