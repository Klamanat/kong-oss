<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api/kong'
import type { KongInfo, KongStatus, KongListResponse, Service, Route, Upstream, Plugin } from '@/types/kong'

const router = useRouter()

const info    = ref<KongInfo | null>(null)
const status  = ref<KongStatus | null>(null)
const stats   = ref({ services: 0, routes: 0, upstreams: 0, plugins: 0 })
const loading = ref(true)
const error   = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [infoData, statusData, svc, rts, ups, plg] = await Promise.all([
      api.get<KongInfo>('/'),
      api.get<KongStatus>('/status').catch(() => null),
      api.get<KongListResponse<Service>>('/services?size=1000'),
      api.get<KongListResponse<Route>>('/routes?size=1000'),
      api.get<KongListResponse<Upstream>>('/upstreams?size=1000'),
      api.get<KongListResponse<Plugin>>('/plugins?size=1000'),
    ])
    info.value   = infoData
    status.value = statusData
    stats.value  = {
      services:  svc.data.length,
      routes:    rts.data.length,
      upstreams: ups.data.length,
      plugins:   plg.data.length,
    }
  } catch (e: any) {
    error.value = e.message || 'Cannot connect to Kong Admin API'
  } finally {
    loading.value = false
  }
}

function dbIcon(db?: string) {
  if (db === 'postgres') return '🐘'
  if (db === 'cassandra') return '⚡'
  return '💾'
}

onMounted(load)
</script>

<template>
  <div class="view-page">
    <div class="page-hd">
      <div>
        <div class="page-title">Dashboard</div>
        <div class="page-sub">Kong Gateway overview</div>
      </div>
      <button class="btn" @click="load" :disabled="loading">🔄 Refresh</button>
    </div>

    <!-- Error state -->
    <div v-if="error" class="error-banner">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <div>
        <div style="font-weight:700">Cannot connect to Kong</div>
        <div style="font-size:11px;margin-top:2px">{{ error }}</div>
      </div>
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="loading"><div class="spinner"></div> Loading...</div>

    <template v-else>
      <!-- Stats row -->
      <div class="stats-grid">
        <div class="stat-card" @click="router.push('/services')" style="cursor:pointer">
          <div class="stat-icon teal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
            </svg>
          </div>
          <div>
            <div class="stat-val">{{ stats.services }}</div>
            <div class="stat-label">Services</div>
          </div>
        </div>

        <div class="stat-card" @click="router.push('/routes')" style="cursor:pointer">
          <div class="stat-icon green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
            </svg>
          </div>
          <div>
            <div class="stat-val">{{ stats.routes }}</div>
            <div class="stat-label">Routes</div>
          </div>
        </div>

        <div class="stat-card" @click="router.push('/upstreams')" style="cursor:pointer">
          <div class="stat-icon orange">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
            </svg>
          </div>
          <div>
            <div class="stat-val">{{ stats.upstreams }}</div>
            <div class="stat-label">Upstreams</div>
          </div>
        </div>

        <div class="stat-card" @click="router.push('/plugins')" style="cursor:pointer">
          <div class="stat-icon red">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"/>
            </svg>
          </div>
          <div>
            <div class="stat-val">{{ stats.plugins }}</div>
            <div class="stat-label">Plugins</div>
          </div>
        </div>
      </div>

      <!-- Node info + Status cards -->
      <div class="dash-grid">
        <!-- Node info -->
        <div class="card" v-if="info">
          <div class="card-hd">
            <span class="card-title">Node Information</span>
            <span :class="['badge', 'badge-teal']">Live</span>
          </div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Version</div>
              <div class="info-val">{{ info.version }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Hostname</div>
              <div class="info-val">{{ info.hostname }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Database</div>
              <div class="info-val">{{ dbIcon(info.configuration?.database) }} {{ info.configuration?.database || 'unknown' }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Node ID</div>
              <div class="info-val" style="font-size:10px">{{ info.node_id || '—' }}</div>
            </div>
            <div class="info-item" v-if="info.configuration?.admin_listen">
              <div class="info-label">Admin Listen</div>
              <div class="info-val">{{ info.configuration.admin_listen.join(', ') }}</div>
            </div>
            <div class="info-item" v-if="info.configuration?.proxy_listen">
              <div class="info-label">Proxy Listen</div>
              <div class="info-val">{{ info.configuration.proxy_listen.join(', ') }}</div>
            </div>
          </div>
        </div>

        <!-- Server status -->
        <div class="card" v-if="status?.server">
          <div class="card-hd">
            <span class="card-title">Server Status</span>
            <span :class="['badge', status.database?.reachable ? 'badge-green' : 'badge-red']">
              DB {{ status.database?.reachable ? 'Reachable' : 'Unreachable' }}
            </span>
          </div>
          <div class="status-grid">
            <div class="status-item">
              <div class="status-val">{{ status.server.connections_active }}</div>
              <div class="status-label">Active Connections</div>
            </div>
            <div class="status-item">
              <div class="status-val">{{ status.server.total_requests?.toLocaleString() ?? '—' }}</div>
              <div class="status-label">Total Requests</div>
            </div>
            <div class="status-item">
              <div class="status-val">{{ status.server.connections_handled?.toLocaleString() ?? '—' }}</div>
              <div class="status-label">Handled Connections</div>
            </div>
            <div class="status-item">
              <div class="status-val">{{ status.server.connections_waiting }}</div>
              <div class="status-label">Waiting Connections</div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.error-banner {
  display: flex; align-items: flex-start; gap: 12px;
  background: var(--danger-lt); border: 1px solid #fbb;
  border-radius: var(--radius); padding: 16px 18px;
  color: var(--danger); margin-bottom: 24px;
}
.error-banner svg { width: 20px; height: 20px; flex-shrink: 0; margin-top: 1px; }

.dash-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
}

.status-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0;
}
.status-item {
  padding: 18px 20px; border-bottom: 1px solid var(--border);
  text-align: center;
}
.status-item:nth-child(odd) { border-right: 1px solid var(--border); }
.status-item:last-child, .status-item:nth-last-child(2):nth-child(odd) { border-bottom: none; }
.status-val   { font-size: 26px; font-weight: 800; color: var(--primary); font-family: var(--mono); line-height: 1; }
.status-label { font-size: 11px; color: var(--text3); margin-top: 4px; font-weight: 500; }
</style>
