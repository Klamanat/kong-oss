import { auth } from '@/auth'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const base = auth.apiUrl.value
  const headers: Record<string, string> = { ...auth.getHeaders() }
  if (body) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || res.statusText)
  }
  if (res.status === 204) return {} as T
  return res.json()
}

export const api = {
  get:    <T>(path: string) => request<T>('GET', path),
  post:   <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch:  <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put:    <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: (path: string) => request<void>('DELETE', path),
}
