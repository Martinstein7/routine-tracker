import { useState, type FormEvent } from 'react'
import { nowHM, todayISO } from '../lib/format'
import { useTaskActions } from '../lib/queries'
import type { Task } from '../types'
import { Button, ErrorText, Field, inputCls, Modal } from './ui'

export function IncidentForm({ tasks, onClose }: { tasks: Task[]; onClose: () => void }) {
  const { createIncident } = useTaskActions()
  const running = tasks.find((t) => t.status === 'IN_PROGRESS')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(todayISO())
  const [startTime, setStartTime] = useState(nowHM())
  const [duration, setDuration] = useState('15')
  const [taskId, setTaskId] = useState(running?.id ?? '')
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await createIncident.mutateAsync({
        title,
        description,
        date,
        startTime,
        durationMinutes: Number(duration),
        taskId: taskId || null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar.')
    }
  }

  return (
    <Modal
      title="Registrar imprevisto"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="incident-form" variant="primary" disabled={createIncident.isPending}>
            Registrar
          </Button>
        </>
      }
    >
      <form id="incident-form" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="O que aconteceu" htmlFor="if-title">
          <input id="if-title" required autoFocus maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Ex.: Atendimento emergencial" />
        </Field>
        <Field label="Detalhes" htmlFor="if-desc">
          <textarea id="if-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} h-auto py-2`} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Data" htmlFor="if-date">
            <input id="if-date" type="date" required max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Início" htmlFor="if-start">
            <input id="if-start" type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Duração (min)" htmlFor="if-dur">
            <input id="if-dur" type="number" min={1} max={1440} required value={duration} onChange={(e) => setDuration(e.target.value)} className={inputCls} />
          </Field>
        </div>
        {tasks.length > 0 && (
          <Field label="Atividade interrompida" htmlFor="if-task">
            <select id="if-task" value={taskId} onChange={(e) => setTaskId(e.target.value)} className={inputCls}>
              <option value="">Nenhuma</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.startTime} · {t.title}
                </option>
              ))}
            </select>
          </Field>
        )}
        <ErrorText>{error}</ErrorText>
      </form>
    </Modal>
  )
}
