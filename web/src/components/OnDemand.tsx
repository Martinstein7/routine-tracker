import { useState, type FormEvent } from 'react'
import { useAuth, useMe } from '../lib/auth'
import { useCategories, useOnDemand, useTaskActions } from '../lib/queries'
import type { OnDemandActivity, Priority } from '../types'
import { Button, Card, ConfirmButton, Empty, ErrorText, Field, Icon, inputCls, Modal, Segmented } from './ui'

/**
 * Atividades que acontecem com frequência, mas sem horário fixo. Quando uma surge,
 * um clique registra a ocorrência na rotina de hoje, no horário atual.
 */
export function OnDemandCard({ ownerId }: { ownerId: string | undefined }) {
  const me = useMe()
  const { can } = useAuth()
  const list = useOnDemand(ownerId)
  const { logOnDemand } = useTaskActions()
  const [editing, setEditing] = useState<OnDemandActivity | 'new' | null>(null)
  const [error, setError] = useState('')

  // Mesma regra das tarefas: a gestora cuida da rotina do admin e, se liberado, da própria.
  const canManage = !!ownerId && (me.role === 'ADMIN' || ownerId !== me.id || can('tasks.createOwn'))
  const items = list.data ?? []

  async function log(activity: OnDemandActivity, mode: 'start' | 'done') {
    setError('')
    try {
      await logOnDemand.mutateAsync({ id: activity.id, mode })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar.')
    }
  }

  return (
    <Card
      title="Sob demanda"
      action={
        canManage && (
          <Button size="sm" variant="ghost" onClick={() => setEditing('new')}>
            <Icon name="plus" className="size-3.5" />
            Adicionar
          </Button>
        )
      }
    >
      {list.isPending ? (
        <Empty>Carregando…</Empty>
      ) : items.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted">
          Atividades que surgem a qualquer hora, sem horário fixo. Cadastre aqui e, quando uma acontecer, registre com um clique: ela entra na rotina no
          horário em que aconteceu.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-2 px-4 py-2.5">
              <button
                type="button"
                onClick={() => canManage && setEditing(a)}
                disabled={!canManage}
                title={canManage ? 'Editar' : undefined}
                className="min-w-0 flex-1 text-left enabled:cursor-pointer"
              >
                <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                  {a.category && <span className="size-2 shrink-0 rounded-sm" style={{ background: a.category.color }} />}
                  <span className="truncate">{a.title}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted tabular">
                  {a.todayCount === 0 ? 'Nenhuma vez hoje' : `${a.todayCount}× hoje · última às ${a.lastTime}`}
                </p>
              </button>
              {canManage && (
                <>
                  <Button size="sm" onClick={() => log(a, 'done')} disabled={logOnDemand.isPending} title="Registrar como já feita, no horário atual">
                    <Icon name="check" className="size-3.5" />
                    Feita
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => log(a, 'start')} disabled={logOnDemand.isPending} title="Iniciar agora, com cronômetro">
                    <Icon name="play" className="size-3" />
                    Iniciar
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <div className="px-4 pb-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
      {editing && ownerId && (
        <OnDemandForm activity={editing === 'new' ? undefined : editing} assigneeId={ownerId} onClose={() => setEditing(null)} />
      )}
    </Card>
  )
}

function OnDemandForm({ activity, assigneeId, onClose }: { activity?: OnDemandActivity; assigneeId: string; onClose: () => void }) {
  const { can } = useAuth()
  const categories = useCategories()
  const actions = useTaskActions()
  const [title, setTitle] = useState(activity?.title ?? '')
  const [description, setDescription] = useState(activity?.description ?? '')
  const [priority, setPriority] = useState<Priority>(activity?.priority ?? 'MEDIUM')
  const [categoryId, setCategoryId] = useState(activity?.categoryId ?? '')
  const [error, setError] = useState('')

  const categoryLocked = !!activity && !can('tasks.changeCategory')
  const busy = actions.createOnDemand.isPending || actions.updateOnDemand.isPending

  async function run(fn: () => Promise<unknown>) {
    setError('')
    try {
      await fn()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const body = { title, description, priority, categoryId: categoryId || null }
    if (activity) {
      if (categoryLocked) delete (body as Partial<typeof body>).categoryId
      return run(() => actions.updateOnDemand.mutateAsync({ id: activity.id, ...body }))
    }
    return run(() => actions.createOnDemand.mutateAsync({ ...body, assigneeId }))
  }

  return (
    <Modal
      title={activity ? 'Editar atividade sob demanda' : 'Nova atividade sob demanda'}
      onClose={onClose}
      footer={
        <>
          {activity && can('tasks.delete') && (
            <span className="mr-auto">
              <ConfirmButton label="Remover" confirmLabel="Remover mesmo" onConfirm={() => run(() => actions.removeOnDemand.mutateAsync(activity.id))} />
            </span>
          )}
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="ondemand-form" variant="primary" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <form id="ondemand-form" onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-[13px] text-muted">
          Sem horário fixo: cada vez que acontecer, registre pelo cartão “Sob demanda” e ela entra na rotina do dia no horário atual.
        </p>
        <Field label="Nome" htmlFor="od-title">
          <input id="od-title" required autoFocus maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Ex.: Atender chamado" />
        </Field>
        <Field label="Descrição" htmlFor="od-desc">
          <textarea id="od-desc" rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} h-auto py-2`} />
        </Field>
        <Field label="Categoria" htmlFor="od-cat" hint={categoryLocked ? 'Só o admin altera a categoria.' : undefined}>
          <select id="od-cat" value={categoryId} disabled={categoryLocked} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
            <option value="">Sem categoria</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
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
        <ErrorText>{error}</ErrorText>
      </form>
    </Modal>
  )
}
