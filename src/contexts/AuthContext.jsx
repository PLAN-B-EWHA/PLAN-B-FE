import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'

const ACCESS_TOKEN_KEY = 'mef_access_token'
const USER_KEY = 'mef_user'

const AuthContext = createContext(null)

function parseJwtPayload(token) {
  try {
    const payload = token.split('.')[1]
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const binary = window.atob(padded)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const decoded = new TextDecoder('utf-8').decode(bytes)
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

function buildUserFromToken(token, fallbackUser = null) {
  const payload = parseJwtPayload(token)

  if (!payload) {
    return fallbackUser
  }

  return {
    userId: payload.userId || fallbackUser?.userId || null,
    email: payload.email || fallbackUser?.email || null,
    name: payload.name || fallbackUser?.name || null,
    roles: Array.isArray(payload.roles) ? payload.roles : fallbackUser?.roles || [],
    status: payload.status || payload.memberStatus || fallbackUser?.status || fallbackUser?.memberStatus || null,
  }
}

function isTokenExpired(token) {
  const payload = parseJwtPayload(token)
  const exp = payload?.exp

  if (!exp) {
    return false
  }

  return exp * 1000 <= Date.now()
}

function shouldRefreshToken(token) {
  const payload = parseJwtPayload(token)
  const exp = payload?.exp

  if (!exp) {
    return true
  }

  return exp * 1000 - Date.now() <= 60 * 1000
}

function readStoredUser() {
  try {
    const raw = window.localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function persistSession(token, user) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token)
  if (user) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user))
  }
}

function clearSession() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
  window.localStorage.removeItem(USER_KEY)
}

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => window.localStorage.getItem(ACCESS_TOKEN_KEY))
  const [user, setUser] = useState(() => {
    const storedToken = window.localStorage.getItem(ACCESS_TOKEN_KEY)
    return storedToken ? buildUserFromToken(storedToken, readStoredUser()) : readStoredUser()
  })
  const [isHydrating, setIsHydrating] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      const storedToken = window.localStorage.getItem(ACCESS_TOKEN_KEY)
      if (!storedToken) {
        if (!cancelled) {
          setIsHydrating(false)
        }
        return
      }

      const storedUser = buildUserFromToken(storedToken, readStoredUser())

      if (!cancelled) {
        setAccessToken(storedToken)
        setUser(storedUser)
      }

      if (!shouldRefreshToken(storedToken) && !isTokenExpired(storedToken)) {
        if (!cancelled) {
          persistSession(storedToken, storedUser)
          setIsHydrating(false)
        }
        return
      }

      try {
        const response = await apiFetch('/auth/refresh', {
          method: 'POST',
        })
        const payload = extractApiPayload(response)
        const nextToken = payload?.accessToken

        if (!nextToken) {
          throw new Error('Access token was not returned')
        }

        const nextUser = buildUserFromToken(nextToken, readStoredUser())

        if (!cancelled) {
          persistSession(nextToken, nextUser)
          setAccessToken(nextToken)
          setUser(nextUser)
        }
      } catch {
        if (isTokenExpired(storedToken)) {
          clearSession()
          if (!cancelled) {
            setAccessToken(null)
            setUser(null)
          }
        } else if (!cancelled) {
          persistSession(storedToken, storedUser)
          setAccessToken(storedToken)
          setUser(storedUser)
        }
      } finally {
        if (!cancelled) {
          setIsHydrating(false)
        }
      }
    }

    bootstrap()

    return () => {
      cancelled = true
    }
  }, [])

  async function login(values) {
    const response = await apiFetch('/auth/login', {
      method: 'POST',
      body: {
        email: values.email,
        password: values.password,
      },
    })
    const payload = extractApiPayload(response)
    const nextUser = buildUserFromToken(payload.accessToken, readStoredUser())

    persistSession(payload.accessToken, nextUser)
    setAccessToken(payload.accessToken)
    setUser(nextUser)

    return payload
  }

  async function register(values) {
    const response = await apiFetch('/auth/register', {
      method: 'POST',
      body: values,
    })
    const payload = extractApiPayload(response)

    setUser(payload)
    window.localStorage.setItem(USER_KEY, JSON.stringify(payload))
    return payload
  }

  async function refreshSession() {
    const response = await apiFetch('/auth/refresh', {
      method: 'POST',
    })
    const payload = extractApiPayload(response)
    const nextUser = buildUserFromToken(payload.accessToken, readStoredUser())

    persistSession(payload.accessToken, nextUser)
    setAccessToken(payload.accessToken)
    setUser(nextUser)

    return payload
  }

  async function logout() {
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
        token: accessToken,
      })
    } catch (error) {
      const message = extractApiErrorMessage(error)
      if (!/token|required|expired/i.test(message)) {
        throw error
      }
    } finally {
      clearSession()
      setAccessToken(null)
      setUser(null)
    }
  }

  const jwtPayload = useMemo(() => (accessToken ? parseJwtPayload(accessToken) : null), [accessToken])

  const value = {
    accessToken,
    isAuthenticated: Boolean(accessToken),
    isHydrating,
    jwtPayload,
    user,
    login,
    logout,
    refreshSession,
    register,
    setUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
