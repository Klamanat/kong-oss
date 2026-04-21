<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/api/kong'
import { useToast } from '@/composables/useToast'
import type { Route, Service, KongListResponse } from '@/types/kong'

const { success, error, toasts } = useToast()

const routes = ref<Route[]>([])
const services = ref<Service[]>([])
const loading = ref(false)
const showModal = ref(false)
const editId = ref<string | null>(null)
const saving = ref(false)

const defaultForm = () => ({
  name: '',
  protocols: ['http', 'https'],
  methods: [] as string[],
  paths: '',
  hosts: '',
  service_id: '',
  strip_path: true,
  preserve_host: false,
})
const form = ref(defaultForm())

const METHODS = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']
const PROTOCOLS = ['http','https','grpc','grpcs','tcp','tls','udp']

function toggleMethod(m: string) {
  const idx = form.value.methods.indexOf(m)
  if (idx >= 0) form.value.methods.splice(idx, 1)
  else form.value.methods.push(m)
}
function toggleProtocol(p: string) {
  const idx = form.value.protocols.indexOf(p)
  if (idx >= 0) { if (form.value.protocols.length > 1) form.value.protocols.splice(idx, 1) }
  else form.value.protocols.push(p)
}

async function load() {
  loading.value = true
  try {
    const [rd, sd] = await Promise.all([
      api.get<KongListResponse<Route>>('/routes?size=1000'),
      api.get<KongListResponse<Service>>('/services?size=1000'),
    ])
    routes.value = rd.data
    services.value = sd.data
  } catch (e: any) {
    error(e.message)
  } finally {
    loading.value = false
  }
}

function openAdd() {
  editId.value = null
  form.value = defaultForm()
  showModal.value = true
}

function openEdit(rt: Route) {
  editId.value = rt.id
  form.value = {
    name: rt.name || '',
    protocols: [...rt.protocols],
    methods: rt.methods ? [...rt.methods] : [],
    paths: rt.paths?.join(', ') || '',
    hosts: rt.hosts?.join(', ') || '',
    service_id: rt.service?.id || '',
    strip_path: rt.strip_path,
    preserve_host: rt.preserve_host,
  }
  showModal.value = true
}

async function save() {
  saving.value = true
  try {
    const paths = form.value.paths.split(',').map(s => s.trim()).filter(Boolean)
    const hosts = form.value.hosts.split(',').map(s => s.trim()).filter(Boolean)
    const body: any = {
      name: form.value.name || undefined,
      protocols: form.value.protocols,
      methods: form.value.methods.length ? form.value.methods : undefined,
      paths: paths.length ? paths : undefined,
      hosts: hosts.length ? hosts : undefined,
      service: form.value.service_id ? { id: form.value.service_id } : undefined,
      strip_path: form.value.strip_path,
      preserve_host: form.value.preserve_host,
    }
    if (editId.value) {
      await api.patch(`/routes/${editId.value}`, body)
      success('Route updated')
    } else {
      await api.post('/routes', body)
      success('Route created')
    }
    showModal.value = false
    await load()
  } catch (e: any) {
    error(e.message)
  } finally {
    saving.value = false
  }
}

async function remove(rt: Route) {
  if (!confirm(`Delete route "${rt.name || rt.id}"?`)) return
  try {
    await api.delete(`/routes/${rt.id}`)
    success('Route deleted')
    await load()
  } catch (e: any) {
    error(e.message)
  }
}

function svcName(id?: string) {
  return services.value.find(s => s.id === id)?.name || id || '—'
}

onMounted(load)
</script>

<template>
  <div class="view-page">
    <div class="page-hd">
      <div>
        <div class="page-title">Routes</div>
        <div class="page-sub">{{ routes.length }} route(s)</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn" @click="load" :disabled="loading">🔄 Refresh</button>
        <button class="btn btn-primary" @click="openAdd">+ Add Route</button>
      </div>
    </div>

    <div v-if="loading" class="loading"><div class="spinner"></div> Loading...</div>
    <div v-else class="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>Name / ID</th>
            <th>Protocols</th>
            <th>Methods</th>
            <th>Paths / Hosts</th>
            <th>Service</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="routes.length === 0" class="empty-row"><td colspan="6">No routes found</td></tr>
          <tr v-for="rt in routes" :key="rt.id">
            <td>
              <div style="font-weight:600">{{ rt.name || '—' }}</div>
              <div class="mono" style="color:var(--text3)">{{ rt.id }}</div>
            </td>
            <td>
              <div class="tag-list">
                <span class="badge badge-teal" v-for="p in rt.protocols" :key="p">{{ p }}</span>
              </div>
            </td>
            <td>
              <div class="tag-list">
                <span class="tag" v-for="m in (rt.methods || [])" :key="m">{{ m }}</span>
                <span v-if="!rt.methods?.length" style="color:var(--text3)">Any</span>
              </div>
            </td>
            <td>
              <div class="tag-list">
                <span class="tag" v-for="p in (rt.paths || [])" :key="p">{{ p }}</span>
                <span class="tag" v-for="h in (rt.hosts || [])" :key="h">{{ h }}</span>
              </div>
            </td>
            <td class="mono">{{ rt.service ? svcName(rt.service.id) : '—' }}</td>
            <td>
              <div class="actions">
                <button class="btn btn-sm" @click="openEdit(rt)">Edit</button>
                <button class="btn btn-sm btn-danger" @click="remove(rt)">Delete</button>
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
          <span class="modal-title">{{ editId ? 'Edit' : 'Add' }} Route</span>
          <button class="modal-close" @click="showModal=false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="field full">
              <label>Name</label>
              <input v-model="form.name" placeholder="my-route" />
            </div>
          </div>
          <div class="field full">
            <label>Protocols</label>
            <div class="tag-list" style="flex-wrap:wrap;gap:6px;margin-top:4px">
              <button
                v-for="p in PROTOCOLS" :key="p"
                :class="['btn btn-sm', form.protocols.includes(p) ? 'btn-primary' : '']"
                @click="toggleProtocol(p)" type="button"
              >{{ p }}</button>
            </div>
          </div>
          <div class="field full">
            <label>Methods</label>
            <div class="tag-list" style="flex-wrap:wrap;gap:6px;margin-top:4px">
              <button
                v-for="m in METHODS" :key="m"
                :class="['btn btn-sm', form.methods.includes(m) ? 'btn-primary' : '']"
                @click="toggleMethod(m)" type="button"
              >{{ m }}</button>
            </div>
            <span class="field-hint">Leave empty = all methods</span>
          </div>
          <div class="field full">
            <label>Paths (comma separated)</label>
            <input v-model="form.paths" placeholder="/api/v1, /v2" />
          </div>
          <div class="field full">
            <label>Hosts (comma separated)</label>
            <input v-model="form.hosts" placeholder="example.com, api.example.com" />
          </div>
          <div class="field full">
            <label>Service</label>
            <select v-model="form.service_id">
              <option value="">— None —</option>
              <option v-for="s in services" :key="s.id" :value="s.id">{{ s.name || s.id }}</option>
            </select>
          </div>
          <div class="form-row">
            <div class="field toggle-row">
              <label>Strip Path</label>
              <label class="toggle"><input type="checkbox" v-model="form.strip_path" /><span class="toggle-slider"></span></label>
            </div>
            <div class="field toggle-row">
              <label>Preserve Host</label>
              <label class="toggle"><input type="checkbox" v-model="form.preserve_host" /><span class="toggle-slider"></span></label>
            </div>
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
