<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { api } from '@/api/kong'
import { useToast } from '@/composables/useToast'
import type {
  Consumer, JwtCredential,
  Service, Route, Plugin, KongListResponse,
} from '@/types/kong'

const { success, error, toasts } = useToast()

// ── Tabs ──────────────────────────────────────────────────────────────────────
type Tab = 'consumers' | 'jwt' | 'protect'
const activeTab = ref<Tab>('consumers')

// ── Shared data ───────────────────────────────────────────────────────────────
const consumers  = ref<Consumer[]>([])
const services   = ref<Service[]>([])
const routes     = ref<Route[]>([])
const loading    = ref(false)

// ── Consumer tab ──────────────────────────────────────────────────────────────
const showConsumerModal  = ref(false)
const editConsumerId     = ref<string | null>(null)
const savingConsumer     = ref(false)
const consumerForm       = ref({ username: '', custom_id: '' })

function openAddConsumer() {
  editConsumerId.value = null
  consumerForm.value = { username: '', custom_id: '' }
  showConsumerModal.value = true
}
function openEditConsumer(c: Consumer) {
  editConsumerId.value = c.id
  consumerForm.value = { username: c.username || '', custom_id: c.custom_id || '' }
  showConsumerModal.value = true
}
async function saveConsumer() {
  const body: Record<string, string> = {}
  if (consumerForm.value.username.trim())  body.username  = consumerForm.value.username.trim()
  if (consumerForm.value.custom_id.trim()) body.custom_id = consumerForm.value.custom_id.trim()
  if (!body.username && !body.custom_id) return error('Username or Custom ID required')
  savingConsumer.value = true
  try {
    if (editConsumerId.value) {
      await api.patch(`/consumers/${editConsumerId.value}`, body)
      success('Consumer updated')
    } else {
      await api.post('/consumers', body)
      success('Consumer created')
    }
    showConsumerModal.value = false
    await loadConsumers()
  } catch (e: any) { error(e.message) }
  finally { savingConsumer.value = false }
}
async function deleteConsumer(c: Consumer) {
  if (!confirm(`Delete consumer "${c.username || c.custom_id || c.id}"?`)) return
  try {
    await api.delete(`/consumers/${c.id}`)
    success('Consumer deleted')
    await loadConsumers()
  } catch (e: any) { error(e.message) }
}
function goToJwt(c: Consumer) {
  selectedConsumer.value = c.id
  activeTab.value = 'jwt'
  loadJwtCreds()
}

// ── JWT Credentials tab ───────────────────────────────────────────────────────
const selectedConsumer = ref('')
const jwtCreds         = ref<JwtCredential[]>([])
const loadingJwt       = ref(false)
const showJwtModal     = ref(false)
const savingJwt        = ref(false)
const copiedCred       = ref<JwtCredential | null>(null)
const showSecret       = ref<Record<string, boolean>>({})

const JWT_ALGOS = ['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512', 'PS256', 'PS384', 'PS512']
const jwtForm = ref({ key: '', algorithm: 'HS256', secret: '' })

function isHmac(algo: string) { return algo.startsWith('HS') }
function genUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
function genSecret(len = 40) {
  const ch = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: len }, () => ch[Math.floor(Math.random() * ch.length)]).join('')
}
function openAddJwt() {
  jwtForm.value = { key: genUUID(), algorithm: 'HS256', secret: genSecret() }
  showJwtModal.value = true
}
async function saveJwt() {
  if (!selectedConsumer.value) return error('Select a consumer first')
  if (!jwtForm.value.key.trim()) return error('Key (iss) is required')
  savingJwt.value = true
  try {
    const body: any = { key: jwtForm.value.key.trim(), algorithm: jwtForm.value.algorithm }
    if (isHmac(jwtForm.value.algorithm) && jwtForm.value.secret.trim())
      body.secret = jwtForm.value.secret.trim()
    const cred = await api.post<JwtCredential>(`/consumers/${selectedConsumer.value}/jwt`, body)
    success('JWT credential created')
    showJwtModal.value = false
    copiedCred.value = cred
    await loadJwtCreds()
  } catch (e: any) { error(e.message) }
  finally { savingJwt.value = false }
}
async function deleteJwtCred(cred: JwtCredential) {
  if (!confirm('Delete this JWT credential?')) return
  try {
    await api.delete(`/consumers/${selectedConsumer.value}/jwt/${cred.id}`)
    success('JWT credential deleted')
    if (copiedCred.value?.id === cred.id) copiedCred.value = null
    await loadJwtCreds()
  } catch (e: any) { error(e.message) }
}
async function loadJwtCreds() {
  if (!selectedConsumer.value) return
  loadingJwt.value = true
  try {
    const res = await api.get<KongListResponse<JwtCredential>>(`/consumers/${selectedConsumer.value}/jwt`)
    jwtCreds.value = res.data
  } catch (e: any) { error(e.message) }
  finally { loadingJwt.value = false }
}
function copyText(text: string) {
  navigator.clipboard.writeText(text).then(() => success('Copied!'))
}
const selectedConsumerLabel = computed(() => {
  const c = consumers.value.find(x => x.id === selectedConsumer.value)
  return c ? (c.username || c.custom_id || c.id) : 'Select consumer…'
})

// ── Protect Resource tab ──────────────────────────────────────────────────────
type TargetType = 'global' | 'service' | 'route'
const protectTarget    = ref<TargetType>('service')
const protectServiceId = ref('')
const protectRouteId   = ref('')
const targetPlugins    = ref<Plugin[]>([])
const loadingPlugins   = ref(false)

const jwtCfg = ref({
  key_claim_name: 'iss',
  header_names: 'authorization',
  uri_param_names: 'jwt',
  exp: true,
  nbf: false,
  maximum_expiration: 0,
  secret_is_base64: false,
  run_on_preflight: true,
})
const applyingJwt = ref(false)

// ── Request Transformer state ─────────────────────────────────────────────────
interface HeaderRow { key: string; value: string }
const reqTransCfg = ref({
  addHeaders: [
    { key: 'X-Consumer-Username', value: '$(consumer.username)' },
    { key: 'X-Consumer-ID',       value: '$(consumer.id)' },
  ] as HeaderRow[],
  removeHeaders: '',
})
const applyingReqTrans = ref(false)

const PRESETS: Record<string, HeaderRow[]> = {
  'Consumer Info': [
    { key: 'X-Consumer-Username',  value: '$(consumer.username)' },
    { key: 'X-Consumer-ID',        value: '$(consumer.id)' },
    { key: 'X-Consumer-Custom-ID', value: '$(consumer.custom_id)' },
  ],
}

function applyPreset(name: string) {
  const rows = PRESETS[name]
  rows.forEach(row => {
    if (!reqTransCfg.value.addHeaders.find(h => h.key === row.key))
      reqTransCfg.value.addHeaders.push({ ...row })
  })
}
function addHeaderRow() {
  reqTransCfg.value.addHeaders.push({ key: '', value: '' })
}
function removeHeaderRow(i: number) {
  reqTransCfg.value.addHeaders.splice(i, 1)
}

const existingJwt      = computed(() => targetPlugins.value.filter(p => p.name === 'jwt'))
const existingReqTrans = computed(() => targetPlugins.value.filter(p => p.name === 'request-transformer'))

async function loadTargetPlugins() {
  loadingPlugins.value = true
  try {
    let path = '/plugins?size=1000'
    if (protectTarget.value === 'service' && protectServiceId.value)
      path = `/services/${protectServiceId.value}/plugins`
    else if (protectTarget.value === 'route' && protectRouteId.value)
      path = `/routes/${protectRouteId.value}/plugins`
    const res = await api.get<KongListResponse<Plugin>>(path)
    targetPlugins.value = protectTarget.value === 'global'
      ? res.data.filter(p => !p.service && !p.route)
      : res.data
  } catch (e: any) { error(e.message) }
  finally { loadingPlugins.value = false }
}

async function applyJwtPlugin() {
  applyingJwt.value = true
  try {
    const config: any = {
      key_claim_name: jwtCfg.value.key_claim_name,
      header_names: jwtCfg.value.header_names.split(',').map(s => s.trim()).filter(Boolean),
      uri_param_names: jwtCfg.value.uri_param_names.split(',').map(s => s.trim()).filter(Boolean),
      claims_to_verify: [jwtCfg.value.exp && 'exp', jwtCfg.value.nbf && 'nbf'].filter(Boolean),
      maximum_expiration: Number(jwtCfg.value.maximum_expiration),
      secret_is_base64: jwtCfg.value.secret_is_base64,
      run_on_preflight: jwtCfg.value.run_on_preflight,
    }
    const body: any = { name: 'jwt', enabled: true, config }
    if (protectTarget.value === 'service' && protectServiceId.value)
      body.service = { id: protectServiceId.value }
    else if (protectTarget.value === 'route' && protectRouteId.value)
      body.route = { id: protectRouteId.value }
    await api.post('/plugins', body)
    success('JWT plugin applied')
    await loadTargetPlugins()
  } catch (e: any) { error(e.message) }
  finally { applyingJwt.value = false }
}

async function deletePlugin(p: Plugin) {
  if (!confirm(`Delete plugin "${p.name}"?`)) return
  try {
    await api.delete(`/plugins/${p.id}`)
    success('Plugin deleted')
    await loadTargetPlugins()
  } catch (e: any) { error(e.message) }
}

async function applyReqTransPlugin() {
  const addHeaders = reqTransCfg.value.addHeaders
    .filter(h => h.key.trim() && h.value.trim())
    .map(h => `${h.key.trim()}:${h.value.trim()}`)
  const removeHeaders = reqTransCfg.value.removeHeaders
    .split(',').map(s => s.trim()).filter(Boolean)
  if (!addHeaders.length && !removeHeaders.length)
    return error('Add at least one header to add or remove')
  applyingReqTrans.value = true
  try {
    const config: any = {}
    if (addHeaders.length)    config.add    = { headers: addHeaders }
    if (removeHeaders.length) config.remove = { headers: removeHeaders }
    const body: any = { name: 'request-transformer', enabled: true, config }
    if (protectTarget.value === 'service' && protectServiceId.value)
      body.service = { id: protectServiceId.value }
    else if (protectTarget.value === 'route' && protectRouteId.value)
      body.route = { id: protectRouteId.value }
    await api.post('/plugins', body)
    success('Request Transformer plugin applied')
    await loadTargetPlugins()
  } catch (e: any) { error(e.message) }
  finally { applyingReqTrans.value = false }
}

// ── Watchers ──────────────────────────────────────────────────────────────────
watch(selectedConsumer, () => {
  if (activeTab.value === 'jwt') loadJwtCreds()
})
watch(activeTab, (tab) => {
  if (tab === 'jwt')     loadJwtCreds()
  if (tab === 'protect') loadTargetPlugins()
})
watch([protectTarget, protectServiceId, protectRouteId], () => {
  if (activeTab.value === 'protect') loadTargetPlugins()
})

// ── Init ──────────────────────────────────────────────────────────────────────
async function loadConsumers() {
  loading.value = true
  try {
    const res = await api.get<KongListResponse<Consumer>>('/consumers?size=1000')
    consumers.value = res.data
  } catch (e: any) { error(e.message) }
  finally { loading.value = false }
}
async function loadAll() {
  loading.value = true
  try {
    const [cd, sd, rd] = await Promise.all([
      api.get<KongListResponse<Consumer>>('/consumers?size=1000'),
      api.get<KongListResponse<Service>>('/services?size=1000'),
      api.get<KongListResponse<Route>>('/routes?size=1000'),
    ])
    consumers.value = cd.data
    services.value  = sd.data
    routes.value    = rd.data
  } catch (e: any) { error(e.message) }
  finally { loading.value = false }
}
onMounted(loadAll)
</script>

<template>
  <div class="view-page">

    <!-- ── Header ── -->
    <div class="page-hd">
      <div>
        <div class="page-title">Token Auth</div>
        <div class="page-sub">JWT token verification · Inject consumer context to upstream</div>
      </div>
      <button class="btn" @click="loadAll" :disabled="loading">🔄 Refresh</button>
    </div>

    <!-- ── Tab bar ── -->
    <div class="tab-bar">
      <button :class="['tab-btn', activeTab==='consumers' ? 'active' : '']" @click="activeTab='consumers'">
        👤 Consumers <span class="tab-cnt">{{ consumers.length }}</span>
      </button>
      <button :class="['tab-btn', activeTab==='jwt' ? 'active' : '']" @click="activeTab='jwt'; loadJwtCreds()">
        🔑 JWT Credentials
      </button>
      <button :class="['tab-btn', activeTab==='protect' ? 'active' : '']" @click="activeTab='protect'; loadTargetPlugins()">
        🔒 Protect Resource
      </button>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════════
         TAB: Consumers
         ════════════════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab==='consumers'">
      <div class="tab-act-row">
        <span class="tab-hint">Manage Kong consumers. Each consumer can have JWT credentials and ACL group memberships.</span>
        <button class="btn btn-primary" @click="openAddConsumer">+ Add Consumer</button>
      </div>

      <div v-if="loading" class="loading"><div class="spinner"></div> Loading...</div>
      <div v-else class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Custom ID</th>
              <th>ID</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!consumers.length" class="empty-row"><td colspan="5">No consumers found</td></tr>
            <tr v-for="c in consumers" :key="c.id">
              <td style="font-weight:600">{{ c.username || '—' }}</td>
              <td class="mono" style="color:var(--text3)">{{ c.custom_id || '—' }}</td>
              <td class="mono" style="color:var(--text3);font-size:11px">{{ c.id }}</td>
              <td style="color:var(--text3);font-size:12px">{{ new Date(c.created_at * 1000).toLocaleDateString() }}</td>
              <td>
                <div class="actions">
                  <button class="btn btn-sm" @click="openEditConsumer(c)">Edit</button>
                  <button class="btn btn-sm btn-teal" @click="goToJwt(c)" title="Manage JWT credentials">🔑 JWT</button>
                  <button class="btn btn-sm btn-danger" @click="deleteConsumer(c)">Delete</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════════
         TAB: JWT Credentials
         ════════════════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab==='jwt'">
      <div class="tab-act-row">
        <div class="consumer-sel-wrap">
          <label class="sel-label">Consumer</label>
          <select v-model="selectedConsumer" class="consumer-sel">
            <option value="">— select consumer —</option>
            <option v-for="c in consumers" :key="c.id" :value="c.id">
              {{ c.username || c.custom_id || c.id }}
            </option>
          </select>
        </div>
        <button v-if="selectedConsumer" class="btn btn-primary" @click="openAddJwt">+ Add Credential</button>
      </div>

      <!-- Info box -->
      <div class="info-box">
        <strong>How JWT verification works:</strong>
        The <code>jwt</code> plugin checks the <code>Authorization: Bearer &lt;token&gt;</code> header.
        The token's <code>iss</code> claim must match the <strong>Key</strong> stored here.
        Kong uses the <strong>Secret</strong> (HMAC) or <strong>RSA Public Key</strong> to verify the signature.
      </div>

      <!-- Copied credential panel -->
      <div v-if="copiedCred" class="cred-card">
        <div class="cred-card-hd">
          <span>✅ Credential created — save these details now</span>
          <button class="btn btn-sm" @click="copiedCred=null">✕</button>
        </div>
        <div class="cred-grid">
          <div class="cred-field">
            <span class="cred-lbl">Key (iss claim)</span>
            <div class="cred-val mono">
              {{ copiedCred.key }}
              <button class="copy-btn" @click="copyText(copiedCred!.key)" title="Copy">⎘</button>
            </div>
          </div>
          <div class="cred-field">
            <span class="cred-lbl">Algorithm</span>
            <div class="cred-val">
              <span class="badge badge-teal">{{ copiedCred.algorithm }}</span>
            </div>
          </div>
          <div v-if="copiedCred.secret" class="cred-field full">
            <span class="cred-lbl">Secret</span>
            <div class="cred-val mono">
              {{ copiedCred.secret }}
              <button class="copy-btn" @click="copyText(copiedCred!.secret!)" title="Copy">⎘</button>
            </div>
          </div>
          <div class="cred-field full">
            <span class="cred-lbl">Sample curl (generate token externally, then call Kong)</span>
            <div class="cred-val mono" style="font-size:11px;color:var(--text3)">
              Authorization: Bearer &lt;signed-JWT-with-iss={{ copiedCred.key }}&gt;
              <button class="copy-btn" @click="copyText(`Authorization: Bearer <JWT iss=${copiedCred!.key}>`)" title="Copy">⎘</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!selectedConsumer" class="empty-hint">← Select a consumer to manage JWT credentials</div>
      <div v-else-if="loadingJwt" class="loading"><div class="spinner"></div> Loading credentials...</div>
      <div v-else class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Key <small style="opacity:.6">(iss claim)</small></th>
              <th>Algorithm</th>
              <th>Secret</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!jwtCreds.length" class="empty-row">
              <td colspan="5">No JWT credentials — add one above</td>
            </tr>
            <tr v-for="cred in jwtCreds" :key="cred.id">
              <td>
                <div class="mono" style="font-size:13px">{{ cred.key }}</div>
                <div class="mono" style="font-size:11px;color:var(--text3)">{{ cred.id }}</div>
              </td>
              <td><span class="badge badge-teal">{{ cred.algorithm }}</span></td>
              <td>
                <div v-if="cred.secret" style="display:flex;align-items:center;gap:6px">
                  <span class="mono" style="font-size:12px">
                    {{ showSecret[cred.id] ? cred.secret : '••••••••••••' }}
                  </span>
                  <button class="icon-btn" @click="showSecret[cred.id] = !showSecret[cred.id]"
                    :title="showSecret[cred.id] ? 'Hide' : 'Show'">
                    {{ showSecret[cred.id] ? '🙈' : '👁️' }}
                  </button>
                  <button class="icon-btn" @click="copyText(cred.secret!)" title="Copy secret">⎘</button>
                </div>
                <span v-else style="color:var(--text3)">RSA key</span>
              </td>
              <td style="color:var(--text3);font-size:12px">{{ new Date(cred.created_at * 1000).toLocaleDateString() }}</td>
              <td>
                <div class="actions">
                  <button class="btn btn-sm" @click="copyText(cred.key)" title="Copy key">⎘ Key</button>
                  <button class="btn btn-sm btn-danger" @click="deleteJwtCred(cred)">Delete</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════════
         TAB: Protect Resource
         ════════════════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab==='protect'" class="protect-grid">

      <!-- ── Left: target selector + existing plugins ── -->
      <div class="protect-col">
        <div class="section-hd">🎯 Target</div>
        <div class="target-radio-group">
          <label :class="['radio-card', protectTarget==='global' ? 'selected' : '']">
            <input type="radio" v-model="protectTarget" value="global" />
            <span class="radio-title">🌐 Global</span>
            <span class="radio-sub">Applies to all traffic</span>
          </label>
          <label :class="['radio-card', protectTarget==='service' ? 'selected' : '']">
            <input type="radio" v-model="protectTarget" value="service" />
            <span class="radio-title">📦 Service</span>
            <span class="radio-sub">Select a specific service</span>
          </label>
          <label :class="['radio-card', protectTarget==='route' ? 'selected' : '']">
            <input type="radio" v-model="protectTarget" value="route" />
            <span class="radio-title">🛤️ Route</span>
            <span class="radio-sub">Select a specific route</span>
          </label>
        </div>

        <div v-if="protectTarget==='service'" class="field mt8">
          <label>Service</label>
          <select v-model="protectServiceId">
            <option value="">— select service —</option>
            <option v-for="s in services" :key="s.id" :value="s.id">{{ s.name || s.id }}</option>
          </select>
        </div>
        <div v-if="protectTarget==='route'" class="field mt8">
          <label>Route</label>
          <select v-model="protectRouteId">
            <option value="">— select route —</option>
            <option v-for="r in routes" :key="r.id" :value="r.id">
              {{ r.name || (r.paths?.[0] ?? r.id) }}
            </option>
          </select>
        </div>

        <!-- Existing plugins on target -->
        <div class="section-hd" style="margin-top:20px">
          📋 Applied Plugins
          <button class="btn btn-sm" style="margin-left:auto" @click="loadTargetPlugins" :disabled="loadingPlugins">🔄</button>
        </div>
        <div v-if="loadingPlugins" class="loading"><div class="spinner"></div></div>
        <div v-else-if="!targetPlugins.length" class="empty-hint small">No plugins on this target yet</div>
        <div v-else class="plugin-list">
          <div v-for="p in targetPlugins" :key="p.id" :class="['plugin-chip', p.name==='jwt' ? 'chip-teal' : 'chip-grey']">
            <div class="chip-left">
              <span class="chip-name">{{ p.name }}</span>
              <span :class="['badge', p.enabled ? 'badge-green' : 'badge-red']" style="font-size:10px">
                {{ p.enabled ? 'on' : 'off' }}
              </span>
            </div>
            <div class="chip-cfg">
              <template v-if="p.name==='jwt'">
                claim: <code>{{ (p.config as any).key_claim_name }}</code>
                · verify: <code>{{ ((p.config as any).claims_to_verify || []).join(', ') || 'none' }}</code>
              </template>
              <span class="mono" style="font-size:10px;color:var(--text3)">{{ p.id.substring(0,8) }}…</span>
            </div>
            <button class="chip-del" @click="deletePlugin(p)" title="Delete plugin">✕</button>
          </div>
        </div>
      </div>

      <!-- ── Right: JWT form ── -->
      <div class="protect-col">

        <!-- JWT Plugin Form -->
        <div class="section-hd">🔑 JWT Plugin</div>
        <div v-if="existingJwt.length" class="warn-box">
          ⚠️ JWT plugin already applied ({{ existingJwt.length }}). Adding another may cause conflicts.
        </div>
        <div class="cfg-card">
          <div class="form-row">
            <div class="field">
              <label>Key Claim Name</label>
              <input v-model="jwtCfg.key_claim_name" placeholder="iss" />
              <small>JWT field used to look up the consumer credential (usually <code>iss</code>)</small>
            </div>
            <div class="field">
              <label>Max Expiration (sec)</label>
              <input v-model.number="jwtCfg.maximum_expiration" type="number" min="0" placeholder="0 = disabled" />
              <small>Max allowed token lifetime. 0 = no limit</small>
            </div>
          </div>
          <div class="form-row">
            <div class="field">
              <label>Header Names <small>(comma-separated)</small></label>
              <input v-model="jwtCfg.header_names" placeholder="authorization" />
            </div>
            <div class="field">
              <label>URI Param Names <small>(comma-separated)</small></label>
              <input v-model="jwtCfg.uri_param_names" placeholder="jwt" />
            </div>
          </div>
          <div class="form-row">
            <div class="field">
              <label>Verify Claims</label>
              <div class="check-row">
                <label class="chk-label">
                  <input type="checkbox" v-model="jwtCfg.exp" />
                  <span><code>exp</code> — expiry</span>
                </label>
                <label class="chk-label">
                  <input type="checkbox" v-model="jwtCfg.nbf" />
                  <span><code>nbf</code> — not-before</span>
                </label>
              </div>
            </div>
            <div class="field">
              <label>Options</label>
              <div class="check-row">
                <label class="chk-label">
                  <input type="checkbox" v-model="jwtCfg.secret_is_base64" />
                  <span>Secret is Base64</span>
                </label>
                <label class="chk-label">
                  <input type="checkbox" v-model="jwtCfg.run_on_preflight" />
                  <span>Run on preflight</span>
                </label>
              </div>
            </div>
          </div>
          <button class="btn btn-primary apply-btn" @click="applyJwtPlugin" :disabled="applyingJwt">
            {{ applyingJwt ? 'Applying…' : '▶ Apply JWT Plugin' }}
          </button>
        </div>


        <!-- Request Transformer Plugin Form -->
        <div class="section-hd" style="margin-top:20px">🔀 Request Transformer Plugin</div>
        <div v-if="existingReqTrans.length" class="warn-box">
          ⚠️ Request Transformer already applied ({{ existingReqTrans.length }}). Adding another may duplicate headers.
        </div>
        <div class="cfg-card">
          <div class="info-box" style="margin-top:0;margin-bottom:12px">
            Inject consumer context เป็น HTTP headers ไปยัง upstream service
            เพื่อให้ upstream ทำ <strong>fine-grained authorization</strong> ตาม role/scope เองได้
            <br/>
            <strong>Available variables:</strong>
            <code>$(consumer.id)</code> · <code>$(consumer.username)</code> ·
            <code>$(consumer.custom_id)</code> · <code>$(authenticated_groups)</code>
          </div>

          <!-- Preset buttons -->
          <div class="preset-row">
            <span class="preset-label">Presets:</span>
            <button
              v-for="(_, name) in PRESETS" :key="name"
              class="btn btn-sm btn-teal"
              @click="applyPreset(name)"
              :title="`Add ${name} headers`"
            >+ {{ name }}</button>
          </div>

          <!-- Add Headers table -->
          <div class="hdr-table-label">Add Headers to Upstream</div>
          <div class="hdr-table">
            <div class="hdr-row hdr-head">
              <span>Header Name</span>
              <span>Value / Variable</span>
              <span></span>
            </div>
            <div v-for="(row, i) in reqTransCfg.addHeaders" :key="i" class="hdr-row">
              <input v-model="row.key"   placeholder="X-Header-Name" class="hdr-input" />
              <input v-model="row.value" placeholder="$(consumer.username) or static" class="hdr-input" />
              <button class="chip-del" @click="removeHeaderRow(i)" title="Remove">✕</button>
            </div>
            <div v-if="!reqTransCfg.addHeaders.length" class="hdr-empty">No headers — add preset or add manually</div>
            <button class="btn btn-sm" style="margin-top:8px" @click="addHeaderRow">+ Add Row</button>
          </div>

          <!-- Remove Headers -->
          <div class="field" style="margin-top:12px">
            <label>Remove Headers from Upstream <small>(comma-separated)</small></label>
            <input v-model="reqTransCfg.removeHeaders" placeholder="Authorization, X-Internal-Token" />
            <small>Strip these headers before forwarding to upstream (e.g. remove Authorization after JWT validation)</small>
          </div>

          <button class="btn btn-primary apply-btn" @click="applyReqTransPlugin" :disabled="applyingReqTrans">
            {{ applyingReqTrans ? 'Applying…' : '▶ Apply Request Transformer' }}
          </button>
        </div>

        <!-- Flow diagram -->
        <div class="flow-box">
          <div class="flow-title">🔄 Request flow</div>
          <div class="flow-steps">
            <div class="flow-step">Client<br/><code>Authorization:<br/>Bearer &lt;JWT&gt;</code></div>
            <div class="flow-arrow">→</div>
            <div class="flow-step chip-teal2">JWT Plugin<br/><small>Verify signature<br/>Set consumer context</small></div>
            <div class="flow-arrow">→</div>
            <div class="flow-step chip-purple2">Request Transformer<br/><small>Inject<br/>X-Consumer-Username<br/>X-Consumer-ID</small></div>
            <div class="flow-arrow">→</div>
            <div class="flow-step">Upstream<br/><small>Authorization logic<br/>via injected headers</small></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════════
         Modals
         ════════════════════════════════════════════════════════════════════════ -->

    <!-- Add/Edit Consumer -->
    <div v-if="showConsumerModal" class="modal-overlay" @click.self="showConsumerModal=false">
      <div class="modal">
        <div class="modal-hd">
          <span class="modal-title">{{ editConsumerId ? 'Edit' : 'Add' }} Consumer</span>
          <button class="modal-close" @click="showConsumerModal=false">✕</button>
        </div>
        <div class="modal-body">
          <div class="info-box" style="margin-top:0">
            Provide at least one of <code>username</code> or <code>custom_id</code>.
          </div>
          <div class="form-row">
            <div class="field">
              <label>Username</label>
              <input v-model="consumerForm.username" placeholder="alice" @keyup.enter="saveConsumer" />
            </div>
            <div class="field">
              <label>Custom ID</label>
              <input v-model="consumerForm.custom_id" placeholder="uuid or external ID" @keyup.enter="saveConsumer" />
            </div>
          </div>
        </div>
        <div class="modal-ft">
          <button class="btn" @click="showConsumerModal=false">Cancel</button>
          <button class="btn btn-primary" @click="saveConsumer" :disabled="savingConsumer">
            {{ savingConsumer ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Add JWT Credential -->
    <div v-if="showJwtModal" class="modal-overlay" @click.self="showJwtModal=false">
      <div class="modal modal-lg">
        <div class="modal-hd">
          <span class="modal-title">Add JWT Credential — {{ selectedConsumerLabel }}</span>
          <button class="modal-close" @click="showJwtModal=false">✕</button>
        </div>
        <div class="modal-body">
          <div class="info-box" style="margin-top:0">
            The <strong>Key</strong> value must match the <code>iss</code> (issuer) claim in the JWT token.
            The <strong>Secret</strong> is used to verify HMAC signatures (HS256/384/512).
          </div>
          <div class="field full">
            <label>Algorithm</label>
            <select v-model="jwtForm.algorithm">
              <option v-for="a in JWT_ALGOS" :key="a" :value="a">{{ a }}</option>
            </select>
          </div>
          <div class="field full">
            <label>Key <small style="opacity:.7">(iss claim value)</small></label>
            <div class="input-with-btn">
              <input v-model="jwtForm.key" placeholder="UUID or issuer URL" />
              <button class="btn btn-sm" @click="jwtForm.key = genUUID()" title="Generate UUID">⟳ UUID</button>
            </div>
          </div>
          <div v-if="isHmac(jwtForm.algorithm)" class="field full">
            <label>Secret</label>
            <div class="input-with-btn">
              <input v-model="jwtForm.secret" placeholder="HMAC signing secret" />
              <button class="btn btn-sm" @click="jwtForm.secret = genSecret()" title="Generate random secret">⟳ Gen</button>
            </div>
            <small>Leave blank to let Kong auto-generate the secret</small>
          </div>
          <div v-else class="info-box">
            For RS256/ES256 algorithms, create the credential first, then update the RSA public key via the Kong Admin API.
          </div>
        </div>
        <div class="modal-ft">
          <button class="btn" @click="showJwtModal=false">Cancel</button>
          <button class="btn btn-primary" @click="saveJwt" :disabled="savingJwt">
            {{ savingJwt ? 'Creating…' : 'Create Credential' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Toast notifications ── -->
    <div class="toast-container">
      <div v-for="t in toasts" :key="t.id" :class="['toast', `toast-${t.type}`]">{{ t.message }}</div>
    </div>

  </div>
</template>

<style scoped>
/* ── Tab bar ── */
.tab-bar {
  display: flex;
  gap: 4px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px;
  margin-bottom: 20px;
}
.tab-btn {
  flex: 1;
  padding: 8px 14px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text2);
  font-size: 13px;
  cursor: pointer;
  transition: background .15s, color .15s;
  white-space: nowrap;
}
.tab-btn:hover { background: var(--bg-hover); color: var(--text1); }
.tab-btn.active { background: var(--primary); color: #fff; font-weight: 600; }
.tab-cnt {
  display: inline-block;
  background: rgba(255,255,255,.15);
  border-radius: 10px;
  padding: 1px 6px;
  font-size: 11px;
  margin-left: 4px;
}
.tab-btn:not(.active) .tab-cnt { background: var(--bg-hover); }

/* ── Tab action row ── */
.tab-act-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
}
.tab-hint { font-size: 13px; color: var(--text3); }

/* ── Consumer selector ── */
.consumer-sel-wrap { display: flex; align-items: center; gap: 10px; }
.sel-label { font-size: 13px; color: var(--text2); white-space: nowrap; }
.consumer-sel { min-width: 220px; }

/* ── Info box ── */
.info-box {
  background: rgba(0,181,173,.08);
  border: 1px solid rgba(0,181,173,.25);
  border-radius: 6px;
  padding: 10px 14px;
  font-size: 13px;
  color: var(--text2);
  margin-bottom: 16px;
  line-height: 1.6;
}
.info-box code { color: var(--primary); background: rgba(0,181,173,.12); padding: 1px 4px; border-radius: 3px; }

/* ── Warning box ── */
.warn-box {
  background: rgba(255,165,0,.08);
  border: 1px solid rgba(255,165,0,.3);
  border-radius: 6px;
  padding: 8px 14px;
  font-size: 12px;
  color: #e6a817;
  margin-bottom: 10px;
}

/* ── Credential card ── */
.cred-card {
  background: var(--bg-card);
  border: 1px solid var(--primary);
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 16px;
}
.cred-card-hd {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  margin-bottom: 12px;
}
.cred-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.cred-field { display: flex; flex-direction: column; gap: 4px; }
.cred-field.full { grid-column: 1 / -1; }
.cred-lbl { font-size: 11px; color: var(--text3); text-transform: uppercase; letter-spacing: .5px; }
.cred-val {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  word-break: break-all;
}

/* ── Buttons ── */
.copy-btn, .icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text3);
  font-size: 14px;
  padding: 2px 4px;
  border-radius: 3px;
  flex-shrink: 0;
}
.copy-btn:hover, .icon-btn:hover { color: var(--primary); background: rgba(0,181,173,.12); }
.btn-teal {
  background: rgba(0,181,173,.15);
  color: var(--primary);
  border-color: rgba(0,181,173,.3);
}
.btn-teal:hover { background: rgba(0,181,173,.25); }

/* ── Empty hint ── */
.empty-hint {
  text-align: center;
  color: var(--text3);
  padding: 32px;
  font-size: 14px;
}
.empty-hint.small { padding: 12px; font-size: 12px; }

/* ── Protect tab layout ── */
.protect-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 20px;
  align-items: start;
}
.protect-col { display: flex; flex-direction: column; gap: 0; }
.section-hd {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: .6px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 12px;
}
.mt8 { margin-top: 8px; }

/* ── Target radio cards ── */
.target-radio-group { display: flex; flex-direction: column; gap: 6px; }
.radio-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color .15s, background .15s;
}
.radio-card input[type=radio] { display: none; }
.radio-card.selected { border-color: var(--primary); background: rgba(0,181,173,.08); }
.radio-card:hover:not(.selected) { background: var(--bg-hover); }
.radio-title { font-size: 13px; font-weight: 600; color: var(--text1); }
.radio-sub  { font-size: 11px; color: var(--text3); }

/* ── Plugin chips (applied plugins list) ── */
.plugin-list { display: flex; flex-direction: column; gap: 6px; }
.plugin-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-card);
}
.chip-teal   { border-color: rgba(0,181,173,.4); background: rgba(0,181,173,.06); }
.chip-orange { border-color: rgba(255,140,0,.4); background: rgba(255,140,0,.06); }
.chip-grey   { opacity: .7; }
.chip-left { display: flex; align-items: center; gap: 6px; min-width: 90px; }
.chip-name { font-size: 13px; font-weight: 600; color: var(--text1); }
.chip-cfg  { flex: 1; font-size: 11px; color: var(--text3); }
.chip-cfg code { color: var(--primary); }
.chip-del {
  background: none; border: none; cursor: pointer;
  color: var(--text3); font-size: 13px; padding: 2px 6px;
  border-radius: 3px;
}
.chip-del:hover { color: var(--danger); background: rgba(220,38,38,.1); }

/* ── Config card ── */
.cfg-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 4px;
}
.apply-btn { margin-top: 12px; width: 100%; }

/* ── Checkbox row ── */
.check-row { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
.chk-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text2);
  cursor: pointer;
}
.chk-label input[type=checkbox] { accent-color: var(--primary); width: 14px; height: 14px; }
.chk-label code { color: var(--primary); font-size: 12px; }

/* ── Input with button ── */
.input-with-btn { display: flex; gap: 6px; }
.input-with-btn input { flex: 1; }

/* ── Flow diagram ── */
.flow-box {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px 16px;
  margin-top: 16px;
}
.flow-title { font-size: 12px; font-weight: 700; color: var(--text3); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 12px; }
.flow-steps { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.flow-step {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
  text-align: center;
  color: var(--text2);
  line-height: 1.4;
  min-width: 80px;
}
.flow-step code { color: var(--primary); font-size: 11px; }
.chip-teal2   { border-color: rgba(0,181,173,.5) !important; background: rgba(0,181,173,.1) !important; color: var(--text1) !important; }
.chip-orange2 { border-color: rgba(255,140,0,.5) !important; background: rgba(255,140,0,.1) !important; color: var(--text1) !important; }
.flow-arrow { color: var(--text3); font-size: 16px; }

/* ── Large modal ── */
.modal-lg { max-width: 520px; }

/* ── Request Transformer extras ── */
.preset-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.preset-label { font-size: 12px; color: var(--text3); }

.hdr-table-label { font-size: 12px; font-weight: 600; color: var(--text2); margin-bottom: 6px; }
.hdr-table {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
}
.hdr-row {
  display: grid;
  grid-template-columns: 1fr 1fr 28px;
  gap: 6px;
  align-items: center;
  margin-bottom: 6px;
}
.hdr-head { font-size: 11px; color: var(--text3); font-weight: 600; padding: 0 2px; margin-bottom: 4px; }
.hdr-head span { display: block; }
.hdr-input {
  padding: 5px 8px;
  font-size: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text1);
  font-family: var(--mono);
  width: 100%;
}
.hdr-input:focus { outline: none; border-color: var(--primary); }
.hdr-empty { font-size: 12px; color: var(--text3); padding: 8px 2px; }

.chip-purple2 { border-color: rgba(139,92,246,.5) !important; background: rgba(139,92,246,.1) !important; color: var(--text1) !important; }

/* ── Misc ── */
small { display: block; margin-top: 4px; font-size: 11px; color: var(--text3); }
small code { color: var(--primary); }
</style>
