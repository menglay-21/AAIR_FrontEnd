const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'

async function request(path, options = {}) {
  const token = sessionStorage.getItem('aair_access_token') || localStorage.getItem('aair_access_token')
  if (token && !sessionStorage.getItem('aair_access_token')) sessionStorage.setItem('aair_access_token', token)
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    const error = new Error(body?.message || 'Không thể kết nối tới máy chủ.')
    error.status = response.status
    error.code = body?.code
    error.details = body?.details
    throw error
  }

  return body
}

export function loginApi(credentials) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}

export function getCurrentUserApi() {
  return request('/auth/me')
}

export function api(path, options) {
  return request(path, options)
}

export async function pdfBlob(path) {
  const token = sessionStorage.getItem('aair_access_token') || localStorage.getItem('aair_access_token')
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) throw new Error('Không thể tải tài liệu PDF.')
  return response.blob()
}
