import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '../types'
import { useUsers } from './queries'

// De quem é a rotina na tela. Normalmente a do admin; a gestora só tem rotina própria se o admin liberar.
type OwnerValue = {
  ownerId: string | undefined
  owner: User | undefined
  setOwnerId: (id: string) => void
  options: User[]
}

const OwnerContext = createContext<OwnerValue | null>(null)
const STORAGE_KEY = 'rt.owner'

function readStored(): string | undefined {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? undefined
  } catch {
    return undefined
  }
}

export function OwnerProvider({ children }: { children: ReactNode }) {
  const users = useUsers()
  const [selected, setSelected] = useState<string | undefined>(readStored)

  const options = useMemo(
    () => (users.data ?? []).filter((u) => u.active).sort((a, b) => (a.role === b.role ? 0 : a.role === 'ADMIN' ? -1 : 1)),
    [users.data],
  )

  const fallback = options.find((u) => u.role === 'ADMIN')?.id ?? options[0]?.id
  const ownerId = options.some((u) => u.id === selected) ? selected : fallback

  useEffect(() => {
    if (!ownerId) return
    try {
      localStorage.setItem(STORAGE_KEY, ownerId)
    } catch {
      /* sem armazenamento: só não lembra a escolha */
    }
  }, [ownerId])

  const value = useMemo(
    () => ({ ownerId, owner: options.find((u) => u.id === ownerId), setOwnerId: setSelected, options }),
    [ownerId, options],
  )
  return <OwnerContext.Provider value={value}>{children}</OwnerContext.Provider>
}

export function useOwner() {
  const ctx = useContext(OwnerContext)
  if (!ctx) throw new Error('useOwner fora do OwnerProvider')
  return ctx
}
