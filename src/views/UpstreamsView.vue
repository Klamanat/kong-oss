<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/api/kong'
import { useToast } from '@/composables/useToast'
import type { Upstream, Target, KongListResponse } from '@/types/kong'

const { success, error, toasts } = useToast()

const upstreams = ref<Upstream[]>([])
const loading = ref(false)
const showModal = ref(false)
const editId = ref<string | null>(null)
const saving = ref(false)

// Targets panel
const showTargets = ref(false)
const currentUps = ref<Upstream | null>(null)
const targets = ref<Target[]>([])
const targetForm = ref({ target: '', weight: 100 })
const addingTarget = ref(false)

const ALGOS = ['round-robin', 'consistent-hashing', 'least-connections', 'latency']
const HASH_ON = ['none', 'consumer', 'ip', 'header', 'cookie', 'path']

const defaultForm = () => ({ name: '', algorithm: 'round-robin', hash_on: 'none', slots: 10000 })
const form = ref(defaultForm())

async function load() {
  loading.value = true
  try {
    const res = await api.get<KongListResponse<Upstream>>('/upstreams?size=1000')
    upstreams.value = res.data
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
function openEdit(u: Upstream) {
  editId.value = u.id
  form.value = { name: u.name, algorithm: u.algorithm, hash_on: u.hash_on, slots: u.slots }
  showModal.value = true
}

async function save() {
  if (!form.value.name.trim()) return error('Name is required')
  saving.value = true
  try {
    const body = { name: form.value.name, algorithm: form.value.algorithm, hash_on: form.value.hash_on, slots: Number(form.value.slots) }
    if (editId.value) {
      await api.patch(`/upstreams/${editId.value}`, body)
      success('Upstream updated')
    } else {
      await api.post('/upstreams', body)
      success('Upstream created')
    }
    showModal.value = false
    await load()
  } catch (e: any) {
    error(e.message)
  } finally {
    saving.value = false
  }
}

async function remove(u: Upstream) {
  if (!confirm(`Delete upstream "${u.name}"?`)) return
  try {
    await api.delete(`/upstreams/${u.id}`)
    success('Upstream deleted')
    await load()
  } catch (e: any) {
    error(e.message)
  }
}

async function openTargets(u: Upstream) {
  currentUps.value = u
  showTargets.value = true
  await loadTargets(u.id)
}
async function loadTargets(id: string) {
  const res = await api.get<KongListResponse<Target>>(`/upstreams/${id}/targets?size=1000`)
  targets.value = res.data
}
async function addTarget() {
  if (!targetForm.value.target.trim()) return error('Target is required')
  addingTarget.value = true
  try {
    await api.post(`/upstreams/${currentUps.value!.id}/targets`, {
      target: targetForm.value.target.trim(),
      weight: Number(targetForm.value.weight),
    })
    success('Target added')
    targetForm.value = { target: '', weight: 100 }
    await loadTargets(currentUps.value!.id)
  } catch (e: any) {
    error(e.message)
  } finally {
    addingTarget.value = false
  }
}
async function removeTarget(t: Target) {
  if (!confirm(`Delete target "${t.target}"?`)) return
  try {
    await api.delete(`/upstreams/${currentUps.value!.id}/targets/${t.id}`)
    success('Target deleted')
    await loadTargets(currentUps.value!.id)
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
        <div class="page-title">Upstreams</div>
        <div class="page-sub">{{ upstreams.length }} upstream(s)</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn" @click="load" :disabled="loading">🔄 Refresh</button>
        <button class="btn btn-primary" @click="openAdd">+ Add Upstream</button>
      </div>
    </div>

    <div v-if="loading" class="loading"><div class="spinner"></div> Loading...</div>
    <div v-else class="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>Name / ID</th>
            <th>Algorithm</th>
            <th>Hash On</th>
            <th>Slots</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="upstreams.length === 0" class="empty-row"><td colspan="5">No upstreams found</td></tr>
          <tr v-for="u in upstreams" :key="u.id">
            <td>
              <div style="font-weight:600">{{ u.name }}</div>
              <div class="mono" style="color:var(--text3)">{{ u.id }}</div>
            </td>
            <td><span class="badge badge-blue">{{ u.algorithm }}</span></td>
            <td class="mono">{{ u.hash_on }}</td>
            <td class="mono">{{ u.slots }}</td>
            <td>
              <div class="actions">
                <button class="btn btn-sm" @click="openTargets(u)">Targets</button>
                <button class="btn btn-sm" @click="openEdit(u)">Edit</button>
                <button class="btn btn-sm btn-danger" @click="remove(u)">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Upstream Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal=false">
      <div class="modal">
        <div class="modal-hd">
          <span class="modal-title">{{ editId ? 'Edit' : 'Add' }} Upstream</span>
          <button class="modal-close" @click="showModal=false">✕</button>
        </div>
        <div class="modal-body">
          <div class="field full">
            <label>Name *</label>
            <input v-model="form.name" placeholder="my-upstream" />
          </div>
          <div class="form-row">
            <div class="field">
              <label>Algorithm</label>
              <select v-model="form.algorithm">
                <option v-for="a in ALGOS" :key="a" :value="a">{{ a }}</option>
              </select>
            </div>
            <div class="field">
              <label>Hash On</label>
              <select v-model="form.hash_on">
                <option v-for="h in HASH_ON" :key="h" :value="h">{{ h }}</option>
              </select>
            </div>
          </div>
          <div class="field full">
            <label>Slots</label>
            <input v-model.number="form.slots" type="number" min="10" max="65536" />
          </div>
        </div>
        <div class="modal-ft">
          <button class="btn" @click="showModal=false">Cancel</button>
          <button class="btn btn-primary" @click="save" :disabled="saving">{{ saving ? 'Saving...' : 'Save' }}</button>
        </div>
      </div>
    </div>

    <!-- Targets Panel -->
    <div v-if="showTargets" class="modal-overlay" @click.self="showTargets=false">
      <div class="modal" style="max-width:600px">
        <div class="modal-hd">
          <span class="modal-title">Targets — {{ currentUps?.name }}</span>
          <button class="modal-close" @click="showTargets=false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row" style="align-items:flex-end">
            <div class="field">
              <label>Target (host:port)</label>
              <input v-model="targetForm.target" placeholder="10.0.0.1:8080" />
            </div>
            <div class="field" style="max-width:120px">
              <label>Weight</label>
              <input v-model.number="targetForm.weight" type="number" min="0" max="65535" />
            </div>
            <button class="btn btn-primary" @click="addTarget" :disabled="addingTarget">Add</button>
          </div>
          <div class="tbl-wrap" style="margin-top:8px">
            <table>
              <thead><tr><th>Target</th><th>Weight</th><th>Action</th></tr></thead>
              <tbody>
                <tr v-if="targets.length === 0" class="empty-row"><td colspan="3">No targets</td></tr>
                <tr v-for="t in targets" :key="t.id">
                  <td class="mono">{{ t.target }}</td>
                  <td class="mono">{{ t.weight }}</td>
                  <td><button class="btn btn-sm btn-danger" @click="removeTarget(t)">Delete</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-ft">
          <button class="btn btn-primary" @click="showTargets=false">Done</button>
        </div>
      </div>
    </div>

    <div class="toast-area">
      <div v-for="t in toasts" :key="t.id" :class="['toast', t.type]">{{ t.message }}</div>
    </div>
  </div>
</template>
