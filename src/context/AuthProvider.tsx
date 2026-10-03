import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { SESSION_ABSOLUTE_MAX_HOURS, SESSION_IDLE_TIMEOUT_MIN } from '../config/businessConfig'
import type { UserRole } from '../domain/types'

export type AuthRole = 'GUEST' | 'CUSTOMER' | 'ADMIN'
export interface AuthState {
  role: AuthRole
  emailVerified: boolean
  loading: boolean
  userEmail: string | null
  authError: string | null
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

function isAuthError(error: { message?: string } | null): string | null {
  if (!error) return null
  if (/rate limit|too many/i.test(error.message ?? '')) return 'AUTH_LOCKED'
  if (/expired|jwt/i.test(error.message ?? '')) return 'AUTH_SESSION_EXPIRED'
  return error.message ?? 'PAGE_500'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<AuthRole>('GUEST')
  const [emailVerified, setEmailVerified] = useState(false)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  const loadProfile = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession)
    if (!nextSession) {
      setRole('GUEST')
      setEmailVerified(false)
      return
    }
    setEmailVerified(nextSession.user.email_confirmed_at !== null)
    const { data, error } = await supabase.from('profiles').select('role, enabled').eq('id', nextSession.user.id).maybeSingle()
    if (error) {
      setAuthError(isAuthError(error))
      return
    }
    if (!data?.enabled) {
      await supabase.auth.signOut()
      setAuthError('AUTH_DISABLED')
      return
    }
    const profileRole = data.role as UserRole
    setRole(profileRole === 'ADMIN' ? 'ADMIN' : 'CUSTOMER')
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.auth.getSession()
    if (error) setAuthError(isAuthError(error))
    await loadProfile(data.session)
    setLoading(false)
  }, [loadProfile])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) setAuthError(isAuthError(error))
    await loadProfile(null)
  }, [loadProfile])

  useEffect(() => {
    void refresh()
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void loadProfile(nextSession).finally(() => setLoading(false))
    })
    return () => data.subscription.unsubscribe()
  }, [loadProfile, refresh])

  useEffect(() => {
    if (!session) return
    const idleMs = (role === 'ADMIN' ? SESSION_IDLE_TIMEOUT_MIN.admin : SESSION_IDLE_TIMEOUT_MIN.customer) * 60_000
    const absoluteMs = (role === 'ADMIN' ? SESSION_ABSOLUTE_MAX_HOURS.admin : SESSION_ABSOLUTE_MAX_HOURS.customer) * 3_600_000
    let lastActivity = Date.now()
    const update = () => { lastActivity = Date.now() }
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity >= idleMs || Date.now() - new Date(session.user.last_sign_in_at ?? Date.now()).getTime() >= absoluteMs) void signOut()
    }, 30_000)
    window.addEventListener('pointerdown', update)
    window.addEventListener('keydown', update)
    // TODO(task4): true server-side inactivity enforcement remains OPEN_DECISIONS #21.
    return () => { window.clearInterval(timer); window.removeEventListener('pointerdown', update); window.removeEventListener('keydown', update) }
  }, [role, session, signOut])

  const value = useMemo(() => ({ role, emailVerified, loading, userEmail: session?.user.email ?? null, authError, signOut, refresh }), [authError, emailVerified, loading, refresh, role, session?.user.email, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthState(): AuthState {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuthState must be used within AuthProvider')
  return value
}
