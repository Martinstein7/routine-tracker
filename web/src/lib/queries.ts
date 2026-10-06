import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { Category, Comment, Incident, Recurrence, Task, TaskStatus, User } from '../types'
import { api, qs } from './api'

export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/api/users') })

export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/api/categories') })

export const useTasks = (from: string, to: string, assigneeId?: string) =>
  useQuery({
    queryKey: ['tasks', from, to, assigneeId ?? 'all'],
    queryFn: () => api.get<Task[]>(`/api/tasks${qs({ from, to, assigneeId })}`),
    placeholderData: (prev) => prev,
  })

export const useComments = (taskId: string | undefined) =>
  useQuery({
    queryKey: ['comments', taskId],
    queryFn: () => api.get<Comment[]>(`/api/tasks/${taskId}/comments`),
    enabled: !!taskId,
  })

export const useIncidents = (from: string, to: string) =>
  useQuery({
    queryKey: ['incidents', from, to],
    queryFn: () => api.get<Incident[]>(`/api/incidents${qs({ from, to })}`),
  })

export type TaskInput = {
  title: string
  description: string
  date: string
  startTime: string
  endTime: string | null
  priority: Task['priority']
  categoryId: string | null
  assigneeId: string
  recurrence?: { pattern: Recurrence; endDate: string | null } | null
}

/** Após qualquer mudança: recarrega tudo o que depende das tarefas. */
function useRefreshTasks() {
  const qc = useQueryClient()
  return () => {
    for (const key of ['tasks', 'reports', 'history', 'comments', 'incidents']) qc.invalidateQueries({ queryKey: [key] })
  }
}

export function useTaskActions() {
  const refresh = useRefreshTasks()
  const opts = { onSuccess: refresh }
  return {
    create: useMutation({ mutationFn: (body: TaskInput) => api.post<Task>('/api/tasks', body), ...opts }),
    update: useMutation({
      mutationFn: ({ id, ...body }: Partial<TaskInput> & { id: string }) => api.patch<Task>(`/api/tasks/${id}`, body),
      ...opts,
    }),
    setStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => api.post<Task>(`/api/tasks/${id}/status`, { status }),
      ...opts,
    }),
    move: useMutation({
      mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) => api.post(`/api/tasks/${id}/move`, { direction }),
      ...opts,
    }),
    remove: useMutation({ mutationFn: (id: string) => api.del(`/api/tasks/${id}`), ...opts }),
    stopRule: useMutation({ mutationFn: (ruleId: string) => api.post(`/api/rules/${ruleId}/stop`), ...opts }),
    comment: useMutation({
      mutationFn: ({ taskId, body }: { taskId: string; body: string }) => api.post<Comment>(`/api/tasks/${taskId}/comments`, { body }),
      ...opts,
    }),
    deleteComment: useMutation({ mutationFn: (id: string) => api.del(`/api/comments/${id}`), ...opts }),
    createIncident: useMutation({
      mutationFn: (body: Omit<Incident, 'id' | 'task' | 'author' | 'createdAt'>) => api.post<Incident>('/api/incidents', body),
      ...opts,
    }),
    deleteIncident: useMutation({ mutationFn: (id: string) => api.del(`/api/incidents/${id}`), ...opts }),
  }
}

/** Relógio que atualiza a tela a cada intervalo (cronômetro, atrasos). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
