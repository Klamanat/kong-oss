<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/api/kong'
import { useToast } from '@/composables/useToast'
import type { Service, KongListResponse } from '@/types/kong'

const { success, error, toasts } = useToast()

const services = ref<Service[]>([])
const loading = ref(false)
const showModal = ref(false)
const editId = ref<string | null>(null)
const saving = ref(false)

const defaultForm = () => ({
  name: '',
  protocol: 'http',
  host: '',
  port: 80,
  path: '',
  retries: 5,
  connect_timeout: 60000,
  write_timeout: 60000,
  read_timeout: 60000,
  enabled: true,
})
const form = ref(defaultForm())

async function load() {
  loading.value = true
  try {
    const res = await api.get<KongListResponse<Service>>('/services?size=1000')
    services.value = res.data
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

function openEdit(svc: Service) {
  editId.value = svc.id
  form.value = {
    name: svc.name,
    protocol: svc.protocol,
    host: svc.host,
    port: svc.port,
    path: svc.path || '',
    retries: svc.retries,
    connect_timeout: svc.connect_timeout,
    write_timeout: svc.write_timeout,
    read_timeout: svc.read_timeout,
    enabled: svc.enabled,
  }
  showModal.value = true
}

async function save() {
  if (!form.value.host.trim()) return error('Host is required')
  saving.value = true
  try {
    const body: any = {
      name: form.value.name || undefined,
      protocol: form.value.protocol,
      host: form.value.host.trim(),
      port: Number(form.value.port),
      path: form.value.path || undefined,
      retries: Number(form.value.retries),
      connect_timeout: Number(form.value.connect_timeout),
      write_timeout: Number(form.value.write_timeout),
      read_timeout: Number(form.value.read_timeout),
      enabled: form.value.enabled,
    }
    if (editId.value) {
      await api.patch(`/services/${editId.value}`, body)
      success('Service updated')
    } else {
      await api.post('/services', body)
      success('Service created')
    }
    showModal.value = false
    await load()
  } catch (e: any) {
    error(e.message)
  } finally {
    saving.value = false
  }
}

async function remove(svc: Service) {
  if (!confirm(`Delete service "${svc.name || svc.id}"?`)) return
  try {
    await api.delete(`/services/${svc.id}`)
    success('Service deleted')
    await load()
  } catch (e: any) {
    error(e.message)
  }
}

onMounted(load)
</script>

<template>
  <div class="view-page">
    <div class="page-hd">
      <div>
        <div class="page-title">Services</div>
        <div class="page-sub">{{ services.length }} service(s)</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn" @click="load" :disabled="loading">🔄 Refresh</button>
        <button class="btn btn-primary" @click="openAdd">+ Add Service</button>
      </div>
    </div>

    <div v-if="loading" class="loading"><div class="spinner"></div> Loading...</div>
    <div v-else class="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>Name / ID</th>
            <th>Protocol</th>
            <th>Host:Port</th>
            <th>Path</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="services.length === 0" class="empty-row"><td colspan="6">No services found</td></tr>
          <tr v-for="svc in services" :key="svc.id">
            <td>
              <div style="font-weight:600">{{ svc.name || '—' }}</div>
              <div class="mono" style="color:var(--text3)">{{ svc.id }}</div>
            </td>
            <td><span class="badge badge-teal">{{ svc.protocol }}</span></td>
            <td class="mono">{{ svc.host }}:{{ svc.port }}</td>
            <td class="mono">{{ svc.path || '/' }}</td>
            <td>
              <span :class="['badge', svc.enabled ? 'badge-green' : 'badge-red']">
                {{ svc.enabled ? 'Enabled' : 'Disabled' }}
              </span>
            </td>
            <td>
              <div class="actions">
                <button class="btn btn-sm" @click="openEdit(svc)">Edit</button>
                <button class="btn btn-sm btn-danger" @click="remove(svc)">Delete</button>
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
          <span class="modal-title">{{ editId ? 'Edit' : 'Add' }} Service</span>
          <button class="modal-close" @click="showModal=false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="field">
              <label>Name</label>
              <input v-model="form.name" placeholder="my-service" />
            </div>
            <div class="field">
              <label>Protocol</label>
              <select v-model="form.protocol">
                <option v-for="p in ['http','https','grpc','grpcs','tcp','tls']" :key="p" :value="p">{{ p }}</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="field">
              <label>Host *</label>
              <input v-model="form.host" placeholder="example.com" />
            </div>
            <div class="field">
              <label>Port</label>
              <input v-model.number="form.port" type="number" min="1" max="65535" />
            </div>
          </div>
          <div class="field full">
            <label>Path</label>
            <input v-model="form.path" placeholder="/api/v1" />
          </div>
          <div class="form-row">
            <div class="field">
              <label>Retries</label>
              <input v-model.number="form.retries" type="number" min="0" />
            </div>
            <div class="field">
              <label>Connect Timeout (ms)</label>
              <input v-model.number="form.connect_timeout" type="number" />
            </div>
          </div>
          <div class="field full toggle-row">
            <label>Enabled</label>
            <label class="toggle">
              <input type="checkbox" v-model="form.enabled" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
        <div class="modal-ft">
          <button class="btn" @click="showModal=false">Cancel</button>
          <button class="btn btn-primary" @click="save" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Toasts -->
    <div class="toast-area">
      <div v-for="t in toasts" :key="t.id" :class="['toast', t.type]">{{ t.message }}</div>
    </div>
  </div>
</template>
