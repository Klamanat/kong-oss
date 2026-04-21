<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { api } from '@/api/kong'
import { useToast } from '@/composables/useToast'
import type { Plugin, Service, Route, KongListResponse } from '@/types/kong'

const { success, error, toasts } = useToast()

const plugins = ref<Plugin[]>([])
const services = ref<Service[]>([])
const routes = ref<Route[]>([])
const loading = ref(false)
const showModal = ref(false)
const editId = ref<string | null>(null)
const saving = ref(false)

const KNOWN_PLUGINS = [
  // Authentication
  'basic-auth','hmac-auth','jwt','key-auth','ldap-auth','oauth2',
  'openid-connect','saml',
  // Security
  'acl','bot-detection','cors','ip-restriction','opa',
  // Traffic Control
  'rate-limiting','rate-limiting-advanced','request-size-limiting',
  'request-termination','response-ratelimiting','route-by-header',
  // Logging
  'datadog','file-log','http-log','loggly','prometheus',
  'statsd','syslog','tcp-log','udp-log',
  // Transformations
  'correlation-id','grpc-gateway','grpc-web',
  'request-transformer','response-transformer',
  // Serverless
  'aws-lambda','azure-functions',
  // Tracing
  'zipkin',
]

const defaultConfig = () => ({
  'rate-limiting': { minute: 60, policy: 'local' },
  'cors': { origins: ['*'], methods: ['GET','POST'], headers: ['Accept','Content-Type'] },
  'key-auth': { key_names: ['apikey'] },
  'basic-auth': { hide_credentials: false },
  'jwt': { key_claim_name: 'iss' },
  'openid-connect': {
    issuer: 'https://accounts.example.com/.well-known/openid-configuration',
    client_id: ['your-client-id'],
    client_secret: ['your-client-secret'],
    scopes: ['openid','profile','email'],
    auth_methods: ['authorization_code'],
  },
  'request-termination': { status_code: 403, message: 'Forbidden' },
  'http-log': { http_endpoint: 'http://log-server/log', method: 'POST', timeout: 1000, keepalive: 1000 },
} as Record<string, unknown>)

const form = ref({
  name: '' as string,
  enabled: true,
  service_id: '',
  route_id: '',
  config_text: '{}',
})

watch(() => form.value.name, (n) => {
  const def = defaultConfig()[n]
  if (def && !editId.value) {
    form.value.config_text = JSON.stringify(def, null, 2)
  }
})

async function load() {
  loading.value = true
  try {
    const [pd, sd, rd] = await Promise.all([
      api.get<KongListResponse<Plugin>>('/plugins?size=1000'),
      api.get<KongListResponse<Service>>('/services?size=1000'),
      api.get<KongListResponse<Route>>('/routes?size=1000'),
    ])
    plugins.value = pd.data
    services.value = sd.data
    routes.value = rd.data
  } catch (e: any) {
    error(e.message)
  } finally {
    loading.value = false
  }
}

function openAdd() {
  editId.value = null
  form.value = { name: KNOWN_PLUGINS[0], enabled: true, service_id: '', route_id: '', config_text: '{}' }
  showModal.value = true
}
function openEdit(p: Plugin) {
  editId.value = p.id
  form.value = {
    name: p.name,
    enabled: p.enabled,
    service_id: p.service?.id || '',
    route_id: p.route?.id || '',
    config_text: JSON.stringify(p.config || {}, null, 2),
  }
  showModal.value = true
}

async function save() {
  saving.value = true
  try {
    let config: Record<string, unknown> = {}
    try { config = JSON.parse(form.value.config_text) } catch { return error('Invalid JSON in config') }
    const body: any = {
      name: form.value.name,
      enabled: form.value.enabled,
      config,
      service: form.value.service_id ? { id: form.value.service_id } : null,
      route: form.value.route_id ? { id: form.value.route_id } : null,
    }
    if (editId.value) {
      await api.patch(`/plugins/${editId.value}`, body)
      success('Plugin updated')
    } else {
      await api.post('/plugins', body)
      success('Plugin created')
    }
    showModal.value = false
    await load()
  } catch (e: any) {
    error(e.message)
  } finally {
    saving.value = false
  }
}

async function remove(p: Plugin) {
  if (!confirm(`Delete plugin "${p.name}"?`)) return
  try {
    await api.delete(`/plugins/${p.id}`)
    success('Plugin deleted')
    await load()
  } catch (e: any) {
    error(e.message)
  }
}

async function toggleEnabled(p: Plugin) {
  try {
    await api.patch(`/plugins/${p.id}`, { enabled: !p.enabled })
    p.enabled = !p.enabled
    success(`Plugin ${p.enabled ? 'enabled' : 'disabled'}`)
  } catch (e: any) {
    error(e.message)
  }
}

function svcName(id?: string) { return services.value.find(s => s.id === id)?.name || id || '—' }
function rtName(id?: string) { return routes.value.find(r => r.id === id)?.name || id || '—' }

onMounted(load)
</script>

<template>
  <div class="view-page">
    <div class="page-hd">
      <div>
        <div class="page-title">Plugins</div>
        <div class="page-sub">{{ plugins.length }} plugin(s)</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn" @click="load" :disabled="loading">🔄 Refresh</button>
        <button class="btn btn-primary" @click="openAdd">+ Add Plugin</button>
      </div>
    </div>

    <div v-if="loading" class="loading"><div class="spinner"></div> Loading...</div>
    <div v-else class="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>Name / ID</th>
            <th>Scope</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="plugins.length === 0" class="empty-row"><td colspan="4">No plugins found</td></tr>
          <tr v-for="p in plugins" :key="p.id">
            <td>
              <div style="font-weight:600">{{ p.name }}</div>
              <div class="mono" style="color:var(--text3)">{{ p.id }}</div>
            </td>
            <td>
              <div v-if="p.service" style="font-size:11px">Service: <span class="mono">{{ svcName(p.service.id) }}</span></div>
              <div v-else-if="p.route" style="font-size:11px">Route: <span class="mono">{{ rtName(p.route.id) }}</span></div>
              <span v-else class="badge badge-gray">Global</span>
            </td>
            <td>
              <span :class="['badge', p.enabled ? 'badge-green' : 'badge-red']" style="cursor:pointer" @click="toggleEnabled(p)">
                {{ p.enabled ? 'Enabled' : 'Disabled' }}
              </span>
            </td>
            <td>
              <div class="actions">
                <button class="btn btn-sm" @click="openEdit(p)">Edit</button>
                <button class="btn btn-sm btn-danger" @click="remove(p)">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal=false">
      <div class="modal">
        <div class="modal-hd">
          <span class="modal-title">{{ editId ? 'Edit' : 'Add' }} Plugin</span>
          <button class="modal-close" @click="showModal=false">✕</button>
        </div>
        <div class="modal-body">
          <div class="field full">
            <label>Plugin Name</label>
            <select v-model="form.name" :disabled="!!editId">
              <option v-for="n in KNOWN_PLUGINS" :key="n" :value="n">{{ n }}</option>
            </select>
          </div>
          <div class="form-row">
            <div class="field">
              <label>Service (optional)</label>
              <select v-model="form.service_id">
                <option value="">— Global —</option>
                <option v-for="s in services" :key="s.id" :value="s.id">{{ s.name || s.id }}</option>
              </select>
            </div>
            <div class="field">
              <label>Route (optional)</label>
              <select v-model="form.route_id">
                <option value="">— Global —</option>
                <option v-for="r in routes" :key="r.id" :value="r.id">{{ r.name || r.id }}</option>
              </select>
            </div>
          </div>
          <div class="field full">
            <label>Config (JSON)</label>
            <textarea v-model="form.config_text" rows="8" style="font-family:var(--mono);font-size:11px;resize:vertical"></textarea>
          </div>
          <div class="field full toggle-row">
            <label>Enabled</label>
            <label class="toggle"><input type="checkbox" v-model="form.enabled" /><span class="toggle-slider"></span></label>
          </div>
        </div>
        <div class="modal-ft">
          <button class="btn" @click="showModal=false">Cancel</button>
          <button class="btn btn-primary" @click="save" :disabled="saving">{{ saving ? 'Saving...' : 'Save' }}</button>
        </div>
      </div>
    </div>

    <div class="toast-area">
      <div v-for="t in toasts" :key="t.id" :class="['toast', t.type]">{{ t.message }}</div>
    </div>
  </div>
</template>
