import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { loginRequest, logoutRequest, meRequest, refreshRequest } from '../api'

const AuthContext = createContext(null)
const ACCESS_TOKEN_KEY = 'mef_access_token'

function normalizeRoles(roles) {
  if (!Array.isArray(roles)) return []
  return roles.map((r) => String(r).toUpperCase())
}

function setDevRefreshCookie(refreshToken) {
  if (!refreshToken) return
  document.cookie = `refreshToken=${encodeURIComponent(refreshToken)}; path=/; samesite=lax`
}

function clearDevRefreshCookie() {
  document.cookie = 'refreshToken=; path=/; Max-Age=0; samesite=lax'
}

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(localStorage.getItem(ACCESS_TOKEN_KEY) || '')
  const [user, setUser] = useState(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  const clearSession = () => {
    setAccessToken('')
    setUser(null)
    localStorage.removeItem(ACCESS_TOKEN_KEY)
  }

  const applyAccessToken = (token) => {
    setAccessToken(token)
    if (token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token)
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY)
    }
  }

  const fetchMe = async (token) => {
    const response = await meRequest(token)
    const profile = response?.data
    const normalizedUser = {
      ...profile,
      roles: normalizeRoles(profile?.roles),
    }
    setUser(normalizedUser)
    return normalizedUser
  }

  const tryRefresh = async () => {
    const response = await refreshRequest()
    const token = response?.data?.accessToken
    if (!token) throw new Error('No access token in refresh response')
    applyAccessToken(token)
    return token
  }

  const withAuthRetry = async (requestFn) => {
    if (!accessToken) {
      const token = await tryRefresh()
      return requestFn(token)
    }

    try {
      return await requestFn(accessToken)
    } catch (e) {
      if (e?.status !== 401) {
        throw e
      }

      const token = await tryRefresh()
      return requestFn(token)
    }
  }

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      try {
        await withAuthRetry((token) => fetchMe(token))
      } catch {
        if (!cancelled) {
          clearSession()
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false)
        }
      }
    }

    bootstrap()

    return () => {
      cancelled = true
    }
  }, [])

  const login = async ({ email, password }) => {
    const response = await loginRequest({ email, password })
    const token = response?.data?.accessToken
    const refreshToken = response?.data?.refreshToken

    if (!token) {
      throw new Error('No access token in login response')
    }

    setDevRefreshCookie(refreshToken)
    applyAccessToken(token)
    await fetchMe(token)
  }

  const logout = async () => {
    try {
      await logoutRequest(accessToken)
    } catch {
      // ignore
    } finally {
      clearDevRefreshCookie()
      clearSession()
    }
  }

  const hasAnyRole = (requiredRoles) => {
    if (!requiredRoles || requiredRoles.length === 0) return true
    const currentRoles = normalizeRoles(user?.roles)
    return requiredRoles.some((role) => currentRoles.includes(String(role).toUpperCase()))
  }

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isBootstrapping,
      isAuthenticated: Boolean(accessToken && user),
      login,
      logout,
      tryRefresh,
      hasAnyRole,
      withAuthRetry,
    }),
    [user, accessToken, isBootstrapping],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
