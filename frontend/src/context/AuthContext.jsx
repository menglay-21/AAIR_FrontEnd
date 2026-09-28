import { createContext, useContext, useMemo, useState } from 'react'
import { loginApi } from '../services/api'

const AuthContext = createContext(null)

function readStoredUser() {
  try {
    const raw = sessionStorage.getItem('aair_user') || localStorage.getItem('aair_user')
    const token = sessionStorage.getItem('aair_access_token') || localStorage.getItem('aair_access_token')
    if (token && !sessionStorage.getItem('aair_access_token')) sessionStorage.setItem('aair_access_token', token)
    if (raw && !sessionStorage.getItem('aair_user')) sessionStorage.setItem('aair_user', raw)
    return token && raw ? JSON.parse(raw) : null
  } catch {
    sessionStorage.removeItem('aair_user')
    sessionStorage.removeItem('aair_access_token')
    localStorage.removeItem('aair_user')
    localStorage.removeItem('aair_access_token')
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser)

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      async login(credentials) {
        const response = await loginApi(credentials)
        const session = response.data

        sessionStorage.setItem('aair_access_token', session.accessToken)
        sessionStorage.setItem('aair_user', JSON.stringify(session.user))
        localStorage.setItem('aair_access_token', session.accessToken)
        localStorage.setItem('aair_user', JSON.stringify(session.user))
        setUser(session.user)

        return session.user
      },
      logout() {
        sessionStorage.removeItem('aair_access_token')
        sessionStorage.removeItem('aair_user')
        localStorage.removeItem('aair_access_token')
        localStorage.removeItem('aair_user')
        setUser(null)
      },
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider')
  }

  return context
}
