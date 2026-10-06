import { useState, type FormEvent } from 'react'
import { useAuth, useMe } from '../lib/auth'
import { formatClock, formatDayMonth, todayISO, toISO } from '../lib/format'
import { useComments, useTaskActions } from '../lib/queries'
import type { Task } from '../types'
import { Avatar, Card, ErrorText, Icon } from './ui'

export function Comments({ task }: { task: Task | undefined }) {
  const me = useMe()
  const { can } = useAuth()
  const comments = useComments(task?.id)
  const { comment, deleteComment } = useTaskActions()
  const [body, setBody] = useState('')
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!task || !body.trim()) return
    setError('')
    try {
      await comment.mutateAsync({ taskId: task.id, body })
      setBody('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível comentar.')
    }
  }

  return (
    <Card title="Comentários" action={task && <span className="max-w-[60%] truncate text-xs text-muted">{task.title}</span>}>
      {!task ? (
        <p className="px-4 py-6 text-sm text-muted">Selecione uma atividade para ver os comentários.</p>
      ) : (
        <>
          <ul className="flex max-h-72 flex-col gap-4 overflow-y-auto px-4 py-4">
            {comments.data?.length === 0 && <li className="text-sm text-muted">Nenhum comentário ainda.</li>}
            {comments.data?.map((c) => {
              const day = toISO(new Date(c.createdAt))
              return (
                <li key={c.id} className="group flex gap-2.5">
                  <Avatar name={c.author.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-xs">
                      <span className="font-semibold">{c.author.name}</span>
                      <span className="text-faint tabular">
                        {day === todayISO() ? '' : `${formatDayMonth(day)}, `}
                        {formatClock(c.createdAt)}
                      </span>
                      {(c.author.id === me.id || can('admin')) && (
                        <button
                          type="button"
                          onClick={() => deleteComment.mutate(c.id)}
                          className="ml-auto rounded p-0.5 text-faint opacity-0 group-hover:opacity-100 hover:text-bad focus:opacity-100"
                          aria-label="Apagar comentário"
                        >
                          <Icon name="x" className="size-3" />
                        </button>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm break-words whitespace-pre-line">{c.body}</p>
                  </div>
                </li>
              )
            })}
          </ul>
          <form onSubmit={submit} className="flex flex-col gap-2 border-t border-line p-3">
            <div className="flex gap-2">
              <input
                aria-label="Novo comentário"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Escreva um comentário"
                maxLength={2000}
                className="h-9 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-3 text-sm placeholder:text-faint focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                disabled={!body.trim() || comment.isPending}
                className="inline-flex size-9 items-center justify-center rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-40"
                aria-label="Enviar comentário"
              >
                <Icon name="right" />
              </button>
            </div>
            <ErrorText>{error}</ErrorText>
          </form>
        </>
      )}
    </Card>
  )
}
