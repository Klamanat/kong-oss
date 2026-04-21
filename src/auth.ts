// Auth state — singleton, persisted to localStorage
import { ref, computed } from 'vue'

const STORAGE_KEY = 'kong_auth'

interface AuthData {
  apiUrl: string
  username: string
  password: string
}

const _apiUrl   = ref('http://localhost:8001')
const _username = ref('')
const _password = ref('')
const _loggedIn = ref(false)

export function loadAuth(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const data: AuthData = JSON.parse(raw)
    _apiUrl.value   = data.apiUrl   || 'http://localhost:8001'
    _username.value = data.username || ''
    _password.value = data.password || ''
    _loggedIn.value = true
    return true
  } catch {
    return false
  }
}

export function saveAuth(url: string, user: string, pass: string) {
  _apiUrl.value   = url.replace(/\/$/, '')
  _username.value = user
  _password.value = pass
  _loggedIn.value = true
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    apiUrl: _apiUrl.value,
    username: user,
    password: pass,
  }))
}

export function clearAuth() {
  _loggedIn.value = false
  localStorage.removeItem(STORAGE_KEY)
}

export const auth = {
  apiUrl:   computed(() => _apiUrl.value),
  username: computed(() => _username.value),
  loggedIn: computed(() => _loggedIn.value),
  getHeaders(): Record<string, string> {
    const h: Record<string, string> = {}
    if (_username.value) {
      h['Authorization'] = 'Basic ' + btoa(`${_username.value}:${_password.value}`)
    }
    return h
  },
}
