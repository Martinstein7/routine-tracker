import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

// O servidor avisa o que mudou; aqui só pedimos para recarregar o que depende disso.
const dependents: Record<string, string[]> = {
  tasks: ['tasks', 'reports', 'onDemand'],
  onDemand: ['onDemand'],
  comments: ['comments'],
  incidents: ['incidents', 'reports'],
  history: ['history'],
  categories: ['categories', 'tasks'],
  users: ['users', 'invites'],
  permissions: ['me', 'permissions'],
}

export function useRealtime(): boolean {
  const qc = useQueryClient()
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let socket: WebSocket | null = null
    let retry = 0
    let timer: number | undefined
    let closed = false

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      socket = new WebSocket(`${proto}://${location.host}/api/ws`)
      socket.onopen = () => {
        retry = 0
        setConnected(true)
        // Ao reconectar, pode ter perdido eventos: recarrega tudo.
        qc.invalidateQueries()
      }
      socket.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as { type: string; topics: string[] }
          if (msg.type !== 'changed') return
          const keys = new Set(msg.topics.flatMap((t) => dependents[t] ?? []))
          for (const key of keys) qc.invalidateQueries({ queryKey: [key] })
        } catch {
          /* mensagem inválida: ignora */
        }
      }
      socket.onclose = () => {
        setConnected(false)
        if (closed) return
        retry = Math.min(retry + 1, 6)
        timer = window.setTimeout(connect, 500 * 2 ** retry)
      }
    }

    connect()
    return () => {
      closed = true
      window.clearTimeout(timer)
      socket?.close()
    }
  }, [qc])

  return connected
}
