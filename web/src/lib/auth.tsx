import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import type { Me, PermissionKey, Permissions } from '../types'
import { api, ApiError, setUnauthorizedHandler } from './api'
import { ThemeProvider, type ThemePrefs } from './theme'

type Session = { user: Me; permissions: Permissions; theme: ThemePrefs | null }

type AuthValue = {
  me: Me | null
  loading: boolean
  can: (p: PermissionKey) => boolean
  login: (email: string, password: string) => Promise<void>
  acceptInvite: (token: string, body: { name: string; email: string; password: string }) => Promise<void>
  setupAdmin: (body: { name: string; email: string; password: string }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const session = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api.get<Session>('/api/auth/me')
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    staleTime: 60_000,
  })

  useEffect(() => {
    setUnauthorizedHandler(() => {
      queryClient.setQueryData(['me'], null)
    })
  }, [queryClient])

  const refresh = useCallback(async () => {
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
    await queryClient.invalidateQueries({ queryKey: ['me'] })
  }, [queryClient])

  const value = useMemo<AuthValue>(
    () => ({
      me: session.data?.user ?? null,
      loading: session.isPending,
      can: (p) => session.data?.permissions[p] ?? false,
      login: async (email, password) => {
        await api.post('/api/auth/login', { email, password })
        await refresh()
      },
      acceptInvite: async (token, body) => {
        await api.post(`/api/invites/${token}/accept`, body)
        await refresh()
      },
      setupAdmin: async (body) => {
        await api.post('/api/setup', body)
        await refresh()
      },
      logout: async () => {
        await api.post('/api/auth/logout')
        queryClient.clear()
        queryClient.setQueryData(['me'], null)
      },
    }),
    [session.data, session.isPending, refresh, queryClient],
  )

  return (
    <AuthContext.Provider value={value}>
      <ThemeProvider loggedIn={!!session.data} saved={session.data?.theme ?? null}>
        {children}
      </ThemeProvider>
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}

/** Usuário garantido: só use dentro de páginas que exigem login. */
export function useMe(): Me {
  const { me } = useAuth()
  if (!me) throw new Error('Sem sessão')
  return me
}
