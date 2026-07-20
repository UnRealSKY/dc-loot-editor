<template>
  <div class="app">
    <header class="appbar">
      <router-link to="/" class="brand">
        <span class="logo">分</span>
        <h1>DC 打王分寶 Editor</h1>
      </router-link>
    </header>
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
  background: rgba(255, 255, 255, .82);
  backdrop-filter: saturate(1.4) blur(10px);
  border-bottom: 1px solid var(--border);
}
.brand { display: inline-flex; align-items: center; gap: 11px; text-decoration: none; color: inherit; }
.brand .logo {
  width: 32px; height: 32px; border-radius: 9px; flex: none;
  display: grid; place-items: center; color: #fff; font-weight: 800; font-size: 16px;
  background: linear-gradient(135deg, var(--primary), #8b5cf6);
  box-shadow: var(--shadow-sm);
}
.brand h1 { margin: 0; font-size: 18px; font-weight: 650; letter-spacing: .01em; }

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
.section-head h3 { margin: 0; font-size: 15px; font-weight: 650; }
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
.chip-struck { background: #f3f4f6; color: #9ca3af; text-decoration: line-through; }
.chip-pending { background: var(--warn-soft); color: var(--warn); }

/* ---- Alerts ---- */
.alert { padding: 9px 13px; border-radius: var(--radius-sm); font-size: 13.5px; margin: 0 0 14px; }
.alert-warn { background: var(--warn-soft); color: var(--warn); border: 1px solid #fcd888; }
.field-error { color: var(--danger); font-size: 12px; margin-top: 3px; display: block; }

/* ---- Utility ---- */
.muted { color: var(--text-muted); }
.toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.empty {
  text-align: center; color: var(--text-muted); padding: 48px 20px;
  border: 1px dashed var(--border-strong); border-radius: var(--radius); background: var(--surface);
}
</style>
