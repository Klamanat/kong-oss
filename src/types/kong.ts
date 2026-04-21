export interface KongListResponse<T> {
  data: T[]
  next?: string | null
  offset?: string
}

export interface Service {
  id: string
  name: string
  protocol: string
  host: string
  port: number
  path?: string
  retries: number
  connect_timeout: number
  write_timeout: number
  read_timeout: number
  enabled: boolean
  tags?: string[]
  created_at: number
  updated_at: number
}

export interface Route {
  id: string
  name?: string
  protocols: string[]
  methods?: string[]
  hosts?: string[]
  paths?: string[]
  service?: { id: string; name?: string }
  strip_path: boolean
  preserve_host: boolean
  tags?: string[]
  created_at: number
  updated_at: number
}

export interface Upstream {
  id: string
  name: string
  algorithm: string
  hash_on: string
  slots: number
  tags?: string[]
  created_at: number
}

export interface Target {
  id: string
  target: string
  weight: number
  upstream: { id: string }
  created_at: number
}

export interface Plugin {
  id: string
  name: string
  enabled: boolean
  protocols: string[]
  config: Record<string, unknown>
  service?: { id: string } | null
  route?: { id: string } | null
  consumer?: { id: string } | null
  tags?: string[]
  created_at: number
}

export interface KongInfo {
  version: string
  hostname: string
  node_id: string
  tagline: string
  configuration?: {
    database?: string
    admin_listen?: string[]
    proxy_listen?: string[]
    prefix?: string
    lua_package_path?: string
  }
}

export interface KongStatus {
  database: { reachable: boolean }
  server: {
    connections_active: number
    connections_accepted: number
    connections_handled: number
    total_requests: number
    connections_reading: number
    connections_writing: number
    connections_waiting: number
  }
}
