import type { WebSocket } from 'ws'

// Cada evento diz só o que mudou; o navegador busca os dados de novo.
export type Topic = 'tasks' | 'onDemand' | 'comments' | 'incidents' | 'history' | 'categories' | 'users' | 'permissions' | 'demo'

const clients = new Set<WebSocket>()

export function addClient(socket: WebSocket) {
  clients.add(socket)
  socket.on('close', () => clients.delete(socket))
}

export function broadcast(topics: Topic[], actorId: string) {
  const message = JSON.stringify({ type: 'changed', topics, actorId })
  for (const socket of clients) {
    if (socket.readyState === socket.OPEN) socket.send(message)
  }
}
