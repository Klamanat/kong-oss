<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { saveAuth, loadAuth } from '@/auth'
import type { KongInfo } from '@/types/kong'

const router = useRouter()

const apiUrl   = ref('http://localhost:8001')
const username = ref('')
const password = ref('')
const loading  = ref(false)
const error    = ref('')
const showPass = ref(false)

async function testAndLogin() {
  error.value = ''
  if (!apiUrl.value.trim()) { error.value = 'Kong API URL is required'; return }

  loading.value = true
  try {
    const base = apiUrl.value.trim().replace(/\/$/, '')
    const headers: Record<string, string> = {}
    if (username.value) {
      headers['Authorization'] = 'Basic ' + btoa(`${username.value}:${password.value}`)
    }

    const res = await fetch(`${base}/`, { headers })
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`)

    const info: KongInfo = await res.json()
    if (!info.version) throw new Error('Response is not a Kong Admin API')

    saveAuth(base, username.value, password.value)
    router.replace('/dashboard')
  } catch (e: any) {
    error.value = e.message || 'Cannot connect to Kong Admin API'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-shell">
    <div class="login-card">
      <!-- Logo -->
      <div class="login-logo">
        <div class="login-icon">K</div>
        <div class="login-brand">Kong <span>Dashboard</span></div>
      </div>

      <div class="login-title">Connect to Kong</div>
      <div class="login-sub">Enter your Kong Admin API details to continue</div>

      <div v-if="error" class="login-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        {{ error }}
      </div>

      <div class="lfield">
        <label>Kong Admin API URL</label>
        <input
          v-model="apiUrl"
          type="url"
          placeholder="http://localhost:8001"
          @keyup.enter="testAndLogin"
          :disabled="loading"
        />
        <span class="lfield-hint">Default: http://localhost:8001</span>
      </div>

      <div class="lfield-sep">
        <span>Credentials (optional)</span>
      </div>

      <div class="lfield">
        <label>Username</label>
        <input
          v-model="username"
          type="text"
          placeholder="admin"
          @keyup.enter="testAndLogin"
          :disabled="loading"
        />
      </div>

      <div class="lfield">
        <label>Password</label>
        <div class="pass-wrap">
          <input
            v-model="password"
            :type="showPass ? 'text' : 'password'"
            placeholder="••••••••"
            @keyup.enter="testAndLogin"
            :disabled="loading"
          />
          <button class="pass-toggle" @click="showPass = !showPass" type="button" tabindex="-1">
            {{ showPass ? '🙈' : '👁' }}
          </button>
        </div>
      </div>

      <button class="login-btn" @click="testAndLogin" :disabled="loading">
        <span v-if="loading" class="login-spinner"></span>
        <span>{{ loading ? 'Connecting...' : 'Connect' }}</span>
      </button>

      <div class="login-note">
        Credentials are stored in your browser's localStorage.<br/>
        Leave username/password empty if no auth is configured.
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-shell {
  min-height: 100vh;
  background: #1b1c1d;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.login-card {
  background: #fff;
  border-radius: 12px;
  padding: 36px 40px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 20px 60px rgba(0,0,0,.4);
}

.login-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 28px;
}
.login-icon {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background: #00b5ad;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 900;
  font-size: 18px;
  font-family: var(--mono);
  box-shadow: 0 3px 10px rgba(0,181,173,.4);
}
.login-brand {
  font-size: 18px;
  font-weight: 800;
  color: #1b1c1d;
}
.login-brand span { color: #00b5ad; }

.login-title { font-size: 20px; font-weight: 700; color: #1b1c1d; margin-bottom: 6px; }
.login-sub   { font-size: 13px; color: #888; margin-bottom: 24px; }

.login-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: #fdf0f0;
  border: 1px solid #fbb;
  border-radius: 6px;
  padding: 10px 14px;
  color: #db2828;
  font-size: 12px;
  margin-bottom: 18px;
}
.login-error svg { width: 16px; height: 16px; flex-shrink: 0; margin-top: 1px; }

.lfield {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 14px;
}
.lfield label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: #555;
}
.lfield input {
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 9px 12px;
  font-size: 13px;
  font-family: var(--sans);
  color: #1b1c1d;
  outline: none;
  transition: border-color .2s;
  width: 100%;
}
.lfield input:focus { border-color: #00b5ad; box-shadow: 0 0 0 2px rgba(0,181,173,.15); }
.lfield input:disabled { opacity: .6; background: #f9f9f9; }
.lfield-hint { font-size: 10px; color: #aaa; }

.lfield-sep {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 6px 0 16px;
  font-size: 11px;
  color: #aaa;
  font-weight: 600;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.lfield-sep::before, .lfield-sep::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e0e0e0;
}

.pass-wrap { position: relative; }
.pass-wrap input { padding-right: 40px; }
.pass-toggle {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 2px;
  opacity: .6;
}
.pass-toggle:hover { opacity: 1; }

.login-btn {
  width: 100%;
  padding: 11px;
  background: #00b5ad;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 700;
  font-family: var(--sans);
  cursor: pointer;
  transition: background .15s;
  margin-top: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.login-btn:hover:not(:disabled) { background: #009c95; }
.login-btn:disabled { opacity: .6; cursor: not-allowed; }

.login-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: lspin .7s linear infinite;
  flex-shrink: 0;
}
@keyframes lspin { to { transform: rotate(360deg); } }

.login-note {
  font-size: 10px;
  color: #bbb;
  text-align: center;
  margin-top: 18px;
  line-height: 1.6;
}
</style>
