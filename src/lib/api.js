const API_PREFIX = '/api'
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

function normalizePath(path) {
  if (!path) {
    return '/'
  }

  return path.startsWith('/') ? path : `/${path}`
}

function buildUrl(path, skipApiPrefix) {
  if (/^https?:\/\//.test(path)) {
    return path
  }

  const normalizedPath = normalizePath(path)
  const apiPath = skipApiPrefix
    ? normalizedPath
    : normalizedPath.startsWith(API_PREFIX)
      ? normalizedPath
      : `${API_PREFIX}${normalizedPath}`

  return API_BASE_URL ? `${API_BASE_URL}${apiPath}` : apiPath
}

export function resolveApiUrl(path, options = {}) {
  return buildUrl(path, options.skipApiPrefix)
}

export async function apiFetch(path, options = {}) {
  const { skipApiPrefix = false, headers, token, body, ...restOptions } = options

  const resolvedHeaders = {
    ...headers,
  }

  const resolvedBody =
    body && typeof body === 'object' && !(body instanceof FormData) ? JSON.stringify(body) : body

  if (!(body instanceof FormData) && !resolvedHeaders['Content-Type']) {
    resolvedHeaders['Content-Type'] = 'application/json'
  }

  if (token) {
    resolvedHeaders.Authorization = `Bearer ${token}`
  }

  const response = await fetch(buildUrl(path, skipApiPrefix), {
    credentials: 'include',
    headers: resolvedHeaders,
    body: resolvedBody,
    ...restOptions,
  })

  const contentType = response.headers.get('content-type') || ''
  const responseData = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const error = new Error(extractApiErrorMessage(responseData) || 'API request failed')
    error.status = response.status
    error.payload = responseData
    throw error
  }

  return responseData
}

export function extractApiPayload(responseData) {
  if (responseData && typeof responseData === 'object' && 'data' in responseData) {
    return responseData.data
  }

  return responseData
}

export function extractApiErrorMessage(error) {
  if (typeof error === 'string') {
    return error
  }

  if (error?.payload?.message) {
    return error.payload.message
  }

  if (error && typeof error === 'object' && 'message' in error && error.message) {
    return error.message
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return error.message
  }

  return '요청 처리 중 오류가 발생했습니다.'
}
