import { useState, type FormEvent } from 'react'
import { useAuth, useMe } from '../lib/auth'
import { formatDate, nowHM, recurrenceLabel, todayISO } from '../lib/format'
import { useBlockedDays, useCategories, useTaskActions, useUsers, type TaskInput } from '../lib/queries'
import type { Priority, Recurrence, Task } from '../types'
import { Button, ConfirmButton, ErrorText, Field, inputCls, Modal, Segmented } from './ui'

type Props = {
  task?: Task
  defaults?: { date?: string; startTime?: string; assigneeId?: string }
  onClose: () => void
}

const nextHalfHour = () => {
  const [h, m] = nowHM().split(':').map(Number)
  const total = Math.min(h * 60 + (m < 30 ? 30 : 60), 23 * 60 + 30)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function TaskForm({ task, defaults, onClose }: Props) {
  const me = useMe()
  const { can } = useAuth()
  const users = useUsers()
  const categories = useCategories()
  const actions = useTaskActions()
  const editing = !!task

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [date, setDate] = useState(task?.date ?? defaults?.date ?? todayISO())
  const [startTime, setStartTime] = useState(task?.startTime ?? defaults?.startTime ?? nextHalfHour())
  const [endTime, setEndTime] = useState(task?.endTime ?? '')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'MEDIUM')
  const [categoryId, setCategoryId] = useState(task?.categoryId ?? '')
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? defaults?.assigneeId ?? '')
  const [recurring, setRecurring] = useState(false)
  const [pattern, setPattern] = useState<Recurrence>('WEEKDAYS')
  const [recurrenceEnd, setRecurrenceEnd] = useState('')
  const [error, setError] = useState('')

  // A gestora cria para o admin e, se liberado, para si mesma.
  const assignees = (users.data ?? []).filter(
    (u) => u.active && (me.role === 'ADMIN' || u.role === 'ADMIN' || (u.id === me.id && can('tasks.createOwn'))),
  )
  const effectiveAssignee = assignees.some((u) => u.id === assigneeId) ? assigneeId : (assignees[0]?.id ?? '')
  const categoryLocked = editing && !can('tasks.changeCategory')
  const busy = actions.create.isPending || actions.update.isPending
  // Dia bloqueado: não aceita tarefa nova nem mudança para essa data.
  const blockedReason = useBlockedDays().reasonOf(date)
  const dateBlocked = !!blockedReason && (!task || task.date !== date)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const body: TaskInput = {
      title,
      description,
      date,
      startTime,
      endTime: endTime || null,
      priority,
      categoryId: categoryId || null,
      assigneeId: effectiveAssignee,
    }
    try {
      if (task) {
        const { assigneeId: _, ...changes } = body
        if (categoryLocked) delete (changes as Partial<TaskInput>).categoryId
        await actions.update.mutateAsync({ id: task.id, ...changes })
      } else {
        await actions.create.mutateAsync({ ...body, recurrence: recurring ? { pattern, endDate: recurrenceEnd || null } : null })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
    }
  }

  async function run(fn: () => Promise<unknown>) {
    setError('')
    try {
      await fn()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir.')
    }
  }

  return (
    <Modal
      title={editing ? 'Editar tarefa' : 'Nova tarefa'}
      onClose={onClose}
      footer={
        <>
          {task && can('tasks.delete') && (
            <span className="mr-auto">
              <ConfirmButton label="Excluir" confirmLabel="Excluir mesmo" onConfirm={() => run(() => actions.remove.mutateAsync(task.id))} />
            </span>
          )}
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="task-form" variant="primary" disabled={busy || dateBlocked}>
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Título" htmlFor="tf-title">
          <input id="tf-title" required autoFocus maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Ex.: Verificar chamados" />
        </Field>
        <Field label="Descrição" htmlFor="tf-desc">
          <textarea id="tf-desc" rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} h-auto py-2`} />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Data" htmlFor="tf-date">
            <input id="tf-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Início" htmlFor="tf-start">
            <input id="tf-start" type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Término" htmlFor="tf-end">
            <input id="tf-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
          </Field>
        </div>

        {dateBlocked && (
          <p role="alert" className="-mt-1 rounded-md bg-warn-soft px-3 py-2 text-[13px]">
            {formatDate(date)} está bloqueado ({blockedReason}). Escolha outra data
            {me.role === 'ADMIN' ? ' ou desbloqueie em Configurações → Dias bloqueados.' : '.'}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Categoria" htmlFor="tf-cat" hint={categoryLocked ? 'Só o admin altera a categoria.' : undefined}>
            <select id="tf-cat" value={categoryId} disabled={categoryLocked} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
              <option value="">Sem categoria</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          {!editing && assignees.length > 1 && (
            <Field label="Responsável" htmlFor="tf-owner">
              <select id="tf-owner" value={effectiveAssignee} onChange={(e) => setAssigneeId(e.target.value)} className={inputCls}>
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.id === me.id ? `${u.name} (você)` : u.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Prioridade</span>
          <Segmented<Priority>
            label="Prioridade"
            value={priority}
            onChange={setPriority}
            options={[
              { value: 'LOW', label: 'Baixa' },
              { value: 'MEDIUM', label: 'Média' },
              { value: 'HIGH', label: 'Alta' },
            ]}
          />
        </div>

        {!editing && can('tasks.recurring') && (
          <div className="flex flex-col gap-3 rounded-md border border-line p-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="size-4 accent-accent" />
              Tarefa recorrente
            </label>
            {recurring && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Repetir" htmlFor="tf-pattern">
                  <select id="tf-pattern" value={pattern} onChange={(e) => setPattern(e.target.value as Recurrence)} className={inputCls}>
                    {(Object.keys(recurrenceLabel) as Recurrence[]).map((p) => (
                      <option key={p} value={p}>
                        {recurrenceLabel[p]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Até" htmlFor="tf-until" hint="Vazio = sem data para acabar.">
                  <input id="tf-until" type="date" min={date} value={recurrenceEnd} onChange={(e) => setRecurrenceEnd(e.target.value)} className={inputCls} />
                </Field>
              </div>
            )}
          </div>
        )}

        {task?.rule?.active && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-canvas px-3 py-2 text-[13px] text-muted">
            <span>Ocorrência de uma tarefa recorrente ({recurrenceLabel[task.rule.pattern].toLowerCase()}). As alterações valem só para {formatDate(task.date)}.</span>
            {can('tasks.recurring') && (
              <ConfirmButton size="sm" label="Encerrar recorrência" confirmLabel="Encerrar" onConfirm={() => run(() => actions.stopRule.mutateAsync(task.rule!.id))} />
            )}
          </div>
        )}

        <ErrorText>{error}</ErrorText>
      </form>
    </Modal>
  )
}
