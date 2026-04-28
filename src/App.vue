<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '@/api/kong'
import { auth, clearAuth } from '@/auth'
import type { KongInfo } from '@/types/kong'

const router = useRouter()
const route = useRoute()

const kongVersion = ref('—')
const kongHostname = ref('—')
const connected = ref<boolean | null>(null)

const navSections = [
  {
    label: 'Dashboard',
    items: [
      {
        path: '/dashboard', label: 'Dashboard',
        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      },
    ],
  },
  {
    label: 'API Gateway',
    items: [
      {
        path: '/services', label: 'Services',
        icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01',
      },
      {
        path: '/routes', label: 'Routes',
        icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
      },
      {
        path: '/upstreams', label: 'Upstreams',
        icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
      },
      {
        path: '/plugins', label: 'Plugins',
        icon: 'M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z',
      },
    ],
  },
  {
    label: 'Security',
    items: [
      {
        path: '/token-auth', label: 'Token Auth',
        icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
      },
    ],
  },
]

async function checkConnection() {
  try {
    const info = await api.get<KongInfo>('/')
    kongVersion.value = info.version
    kongHostname.value = info.hostname || '—'
    connected.value = true
  } catch {
    connected.value = false
    kongVersion.value = '—'
    kongHostname.value = '—'
  }
}

function logout() {
  clearAuth()
  router.replace('/login')
}

onMounted(checkConnection)
</script>

<template>
  <!-- Login page: no sidebar -->
  <router-view v-if="route.path === '/login'" />

  <!-- Main shell -->
  <div v-else id="app-shell">
    <nav id="sidebar">
      <!-- Logo -->
      <div class="sb-logo" @click="router.push('/dashboard')">
        <div class="sb-logo-icon">K</div>
        <div class="sb-logo-text">Kong <span>Dashboard</span></div>
      </div>

      <!-- Connection status -->
      <div class="sb-conn">
        <div class="sb-conn-row">
          <span :class="['sb-dot', connected === true ? 'ok' : connected === false ? 'err' : 'pending']"></span>
          <span class="sb-conn-label">
            {{ connected === true ? 'Connected' : connected === false ? 'Disconnected' : 'Connecting...' }}
          </span>
        </div>
        <div class="sb-conn-host">{{ auth.apiUrl.value }}</div>
      </div>

      <!-- Nav sections -->
      <div v-for="section in navSections" :key="section.label" class="sb-group">
        <div class="sb-section-label">{{ section.label }}</div>
        <button
          v-for="item in section.items"
          :key="item.path"
          :class="['nav-item', route.path.startsWith(item.path) ? 'active' : '']"
          @click="router.push(item.path)"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path :d="item.icon" />
          </svg>
          <span>{{ item.label }}</span>
        </button>
      </div>

      <!-- Footer: version + logout -->
      <div class="sb-foot">
        <div class="sb-ver">Kong {{ kongVersion }}</div>
        <button class="sb-logout" @click="logout">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
          Disconnect
        </button>
      </div>
    </nav>

    <main id="content">
      <router-view />
    </main>
  </div>
</template>

<style>
/* ─── Variables ─────────────────────────────── */
:root {
  --sans: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, sans-serif;
  --mono: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;

  /* Content palette */
  --bg:       #f4f4f4;
  --surface:  #ffffff;
  --surface2: #f9fafb;
  --border:   #e0e0e0;
  --border2:  #c8c8c8;
  --text:     #1b1c1d;
  --text2:    #555;
  --text3:    #999;

  /* Primary = Konga teal */
  --primary:       #00b5ad;
  --primary-lt:    #e4f9f8;
  --primary-hover: #009c95;

  /* Semantic states */
  --success:    #21ba45;
  --success-lt: #e8f9ec;
  --warning:    #f2711c;
  --warning-lt: #fff4e5;
  --danger:     #db2828;
  --danger-lt:  #fdf0f0;

  /* Sidebar (dark) */
  --sb-bg:     #1b1c1d;
  --sb-border: rgba(255,255,255,.07);
  --sb-text:   rgba(255,255,255,.68);
  --sb-text2:  rgba(255,255,255,.32);
  --sb-hover:  rgba(255,255,255,.06);
  --sb-active: rgba(0,181,173,.15);
  --sb-w:      240px;

  --radius:    6px;
  --shadow:    0 1px 3px rgba(0,0,0,.1), 0 1px 2px rgba(0,0,0,.06);
  --shadow-md: 0 4px 16px rgba(0,0,0,.12), 0 2px 4px rgba(0,0,0,.08);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); font-family: var(--sans); font-size: 13px; min-height: 100vh; }

/* ─── App shell ─────────────────────────────── */
#app-shell { display: flex; min-height: 100vh; }

/* ─── Sidebar ───────────────────────────────── */
#sidebar {
  width: var(--sb-w); flex-shrink: 0;
  position: fixed; top: 0; bottom: 0; left: 0;
  background: var(--sb-bg);
  border-right: 1px solid var(--sb-border);
  display: flex; flex-direction: column;
  overflow-y: auto; z-index: 40;
}

.sb-logo {
  display: flex; align-items: center; gap: 10px;
  padding: 17px 16px; cursor: pointer; flex-shrink: 0;
  border-bottom: 1px solid var(--sb-border);
  user-select: none;
}
.sb-logo-icon {
  width: 32px; height: 32px; border-radius: 8px;
  background: var(--primary);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 900; font-size: 16px; font-family: var(--mono);
  flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,181,173,.4);
}
.sb-logo-text { font-weight: 700; font-size: 14px; color: #fff; letter-spacing: .01em; }
.sb-logo-text span { color: var(--primary); }

.sb-conn {
  padding: 10px 16px 12px;
  border-bottom: 1px solid var(--sb-border);
  flex-shrink: 0;
}
.sb-conn-row { display: flex; align-items: center; gap: 7px; }
.sb-dot { width: 7px; height: 7px; border-radius: 50%; background: #555; flex-shrink: 0; transition: all .3s; }
.sb-dot.ok      { background: var(--success); box-shadow: 0 0 0 3px rgba(33,186,69,.2); }
.sb-dot.err     { background: var(--danger);  box-shadow: 0 0 0 3px rgba(219,40,40,.2); }
.sb-dot.pending { background: #888; animation: sbpulse 1.5s ease infinite; }
@keyframes sbpulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
.sb-conn-label { font-size: 11px; color: var(--sb-text); font-weight: 500; }
.sb-conn-host  { font-size: 10px; color: var(--sb-text2); margin-top: 3px; font-family: var(--mono); padding-left: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.sb-group { padding: 4px 0; border-bottom: 1px solid var(--sb-border); }
.sb-section-label {
  font-size: 10px; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; color: var(--sb-text2);
  padding: 10px 16px 4px;
}
.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 16px 9px 13px; width: 100%;
  background: none; border: none; border-left: 3px solid transparent;
  cursor: pointer; color: var(--sb-text); font-size: 13px; font-family: var(--sans);
  transition: all .15s; text-align: left;
}
.nav-item:hover { background: var(--sb-hover); color: #fff; }
.nav-item.active {
  background: var(--sb-active);
  border-left-color: var(--primary);
  color: #fff; font-weight: 600;
}
.nav-icon { width: 16px; height: 16px; flex-shrink: 0; opacity: .65; transition: opacity .15s; }
.nav-item:hover .nav-icon, .nav-item.active .nav-icon { opacity: 1; }

.sb-foot {
  margin-top: auto; padding: 12px 16px;
  border-top: 1px solid var(--sb-border); flex-shrink: 0;
}
.sb-ver { font-size: 10px; color: var(--sb-text2); font-family: var(--mono); margin-bottom: 8px; }
.sb-logout {
  display: flex; align-items: center; gap: 7px;
  width: 100%; padding: 7px 10px; border-radius: 6px;
  background: rgba(219,40,40,.12); border: 1px solid rgba(219,40,40,.2);
  color: rgba(255,100,100,.85); font-size: 12px; font-family: var(--sans);
  cursor: pointer; transition: all .15s;
}
.sb-logout:hover { background: rgba(219,40,40,.22); color: #ff8080; }
.sb-logout svg { width: 14px; height: 14px; flex-shrink: 0; }

/* ─── Content area ──────────────────────────── */
#content { margin-left: var(--sb-w); flex: 1; min-width: 0; }
.view-page { padding: 28px; }
.page-hd { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
.page-title { font-size: 20px; font-weight: 700; color: var(--text); margin-bottom: 3px; }
.page-sub   { font-size: 12px; color: var(--text3); }

/* ─── Buttons ───────────────────────────────── */
.btn {
  display: inline-flex; align-items: center; gap: 5px;
  font-family: var(--sans); font-size: 12px; font-weight: 500;
  padding: 8px 14px; border-radius: var(--radius); cursor: pointer;
  border: 1px solid var(--border2); background: var(--surface);
  color: var(--text2); transition: all .15s; white-space: nowrap;
}
.btn:hover { background: var(--surface2); border-color: #bbb; }
.btn:disabled { opacity: .45; cursor: not-allowed; }
.btn-primary { background: var(--primary); border-color: var(--primary); color: #fff; }
.btn-primary:hover { background: var(--primary-hover); border-color: var(--primary-hover); color: #fff; }
.btn-danger  { color: var(--danger); border-color: var(--border2); }
.btn-danger:hover  { background: var(--danger-lt); border-color: var(--danger); }
.btn-sm { padding: 5px 10px; font-size: 11px; }

/* ─── Cards ─────────────────────────────────── */
.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden;
}
.card-hd {
  padding: 13px 18px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
}
.card-title { font-size: 13px; font-weight: 700; color: var(--text); text-transform: uppercase; letter-spacing: .04em; }
.card-body { padding: 18px; }

/* ─── Stat cards ────────────────────────────── */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 20px 22px;
  box-shadow: var(--shadow); display: flex; align-items: center; gap: 16px;
}
.stat-icon {
  width: 46px; height: 46px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.stat-icon.teal   { background: var(--primary-lt); color: var(--primary); }
.stat-icon.green  { background: var(--success-lt); color: var(--success); }
.stat-icon.orange { background: var(--warning-lt); color: var(--warning); }
.stat-icon.red    { background: var(--danger-lt);  color: var(--danger); }
.stat-icon svg { width: 22px; height: 22px; }
.stat-val   { font-size: 30px; font-weight: 800; color: var(--text); line-height: 1; font-family: var(--mono); }
.stat-label { font-size: 12px; color: var(--text3); margin-top: 4px; font-weight: 500; }

/* ─── Tables ────────────────────────────────── */
.tbl-wrap {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow);
}
table { width: 100%; border-collapse: collapse; }
th {
  background: #fafafa; border-bottom: 2px solid var(--border);
  padding: 11px 14px; text-align: left; font-size: 11px; font-weight: 700;
  color: var(--text2); text-transform: uppercase; letter-spacing: .06em; white-space: nowrap;
}
td { padding: 11px 14px; border-bottom: 1px solid var(--border); font-size: 13px; color: var(--text); vertical-align: middle; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: #fafcfc; }
.mono { font-family: var(--mono); font-size: 11px; }
.uuid { font-family: var(--mono); font-size: 10px; color: var(--text3); }

/* Badges */
.badge {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;
}
.badge-teal   { background: var(--primary-lt); color: var(--primary); }
.badge-green  { background: var(--success-lt); color: var(--success); }
.badge-red    { background: var(--danger-lt);  color: var(--danger); }
.badge-blue   { background: #e8f0fe; color: #1a56db; }
.badge-gray   { background: #f0f0f0; color: var(--text3); border: 1px solid var(--border); }
.badge-orange { background: var(--warning-lt); color: var(--warning); }
.tag-list { display: flex; flex-wrap: wrap; gap: 4px; }
.tag { background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; padding: 1px 6px; font-size: 10px; color: var(--text2); }
.actions { display: flex; gap: 6px; }
.empty-row td { text-align: center; color: var(--text3); padding: 44px; font-size: 13px; }

/* ─── Modal ─────────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 100; padding: 20px;
}
.modal {
  background: var(--surface); border-radius: 8px;
  box-shadow: var(--shadow-md); width: 100%; max-width: 560px;
  max-height: 90vh; overflow-y: auto;
}
.modal-hd {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 3px solid var(--primary);
  background: #fafafa;
}
.modal-title { font-size: 15px; font-weight: 700; color: var(--text); }
.modal-close { background: none; border: none; cursor: pointer; font-size: 18px; color: var(--text3); line-height: 1; padding: 2px 4px; border-radius: 4px; }
.modal-close:hover { background: var(--danger-lt); color: var(--danger); }
.modal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.modal-ft { padding: 14px 20px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px; background: #fafafa; }

.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field label { font-size: 11px; font-weight: 700; color: var(--text2); text-transform: uppercase; letter-spacing: .04em; }
.field input, .field select, .field textarea {
  background: var(--surface); border: 1px solid var(--border2); border-radius: var(--radius);
  color: var(--text); font-family: var(--sans); font-size: 13px;
  padding: 8px 10px; outline: none; transition: border-color .2s;
}
.field input:focus, .field select:focus, .field textarea:focus {
  border-color: var(--primary); box-shadow: 0 0 0 2px rgba(0,181,173,.15);
}
.field.full { grid-column: 1 / -1; }
.field-hint { font-size: 10px; color: var(--text3); }
.toggle-row { display: flex; align-items: center; justify-content: space-between; flex-direction: row !important; }
.toggle { position: relative; display: inline-block; width: 38px; height: 21px; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute; inset: 0; background: var(--border2); border-radius: 21px; cursor: pointer; transition: .25s;
}
.toggle-slider::before {
  content: ''; position: absolute; height: 15px; width: 15px; border-radius: 50%;
  left: 3px; bottom: 3px; background: #fff; transition: .25s;
  box-shadow: 0 1px 3px rgba(0,0,0,.2);
}
input:checked + .toggle-slider { background: var(--primary); }
input:checked + .toggle-slider::before { transform: translateX(17px); }

/* ─── Toasts ────────────────────────────────── */
.toast-area {
  position: fixed; bottom: 20px; right: 20px; z-index: 200;
  display: flex; flex-direction: column; gap: 8px; pointer-events: none;
}
.toast {
  display: flex; align-items: center; gap: 10px;
  background: #333; color: #fff; border-radius: 6px;
  padding: 11px 16px; font-size: 12px; min-width: 240px;
  box-shadow: var(--shadow-md); animation: slideIn .2s ease;
}
.toast.success { background: var(--success); }
.toast.error   { background: var(--danger); }
@keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

/* ─── Loading ───────────────────────────────── */
.loading { display: flex; align-items: center; justify-content: center; padding: 56px; color: var(--text3); gap: 10px; font-size: 13px; }
.spinner { width: 20px; height: 20px; border: 2px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin .7s linear infinite; flex-shrink: 0; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ─── Info grid (for dashboard) ─────────────── */
.info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0; }
.info-item { padding: 12px 18px; border-bottom: 1px solid var(--border); }
.info-item:nth-child(odd) { border-right: 1px solid var(--border); }
.info-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--text3); margin-bottom: 4px; }
.info-val   { font-size: 13px; font-weight: 600; color: var(--text); font-family: var(--mono); word-break: break-all; }
</style>
