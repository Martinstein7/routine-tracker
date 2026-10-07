import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { BlockedDaysCard } from '../components/BlockedDays'
import { PageHeader } from '../components/Layout'
import { NotificationsCard } from '../components/NotificationsCard'
import { Avatar, Button, Card, ConfirmButton, cx, ErrorText, Field, Icon, inputCls, Segmented } from '../components/ui'
import { api } from '../lib/api'
import { useAuth, useMe } from '../lib/auth'
import { formatDate, roleLabel, toISO } from '../lib/format'
import { useCategories, useUsers } from '../lib/queries'
import { colorFields, defaultColors, useTheme } from '../lib/theme'
import type { Category, Invite, Role } from '../types'

export function SettingsPage() {
  const { can } = useAuth()
  // A gestora só vê o que é pessoal (aparência e notificações); o resto é do admin.
  if (!can('admin')) {
    return (
      <>
        <PageHeader title="Configurações" subtitle="Aparência e notificações da sua conta." />
        <div className="flex max-w-2xl flex-col gap-6">
          <Appearance />
          <NotificationsCard />
        </div>
      </>
    )
  }
  return (
    <>
      <PageHeader title="Configurações" subtitle="Aparência, notificações, dias bloqueados, acessos, permissões da gestora e categorias." />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <Appearance />
          <NotificationsCard />
          <Users />
          <Invites />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <BlockedDaysCard />
          <Permissions />
          <Categories />
          <Backup />
        </div>
      </div>
    </>
  )
}

function Appearance() {
  const { prefs, resolved, saving, setMode, setColor, resetColors } = useTheme()
  const custom = prefs[resolved]
  const themeName = resolved === 'dark' ? 'escuro' : 'claro'

  return (
    <Card
      title="Aparência"
      action={
        <span className="text-xs text-muted" aria-live="polite">
          {saving === 'saving' ? 'Salvando…' : saving === 'saved' ? 'Salvo' : ''}
        </span>
      }
    >
      <div className="flex flex-col gap-5 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Tema</p>
            <p className="text-xs text-muted">Automático segue o claro ou escuro do seu computador.</p>
          </div>
          <Segmented
            label="Tema"
            value={prefs.mode}
            onChange={setMode}
            options={[
              { value: 'light', label: 'Claro' },
              { value: 'dark', label: 'Escuro' },
              { value: 'system', label: 'Automático' },
            ]}
          />
        </div>

        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium">Cores do tema {themeName}</p>
            <Button size="sm" variant="ghost" disabled={Object.keys(custom).length === 0} onClick={resetColors}>
              Restaurar padrão
            </Button>
          </div>
          <p className="text-xs text-muted">
            A mudança aparece na hora. Cada tema guarda as próprias cores; para editar o {resolved === 'dark' ? 'claro' : 'escuro'}, mude o tema acima.
          </p>
          <ul className="mt-3 divide-y divide-line rounded-md border border-line">
            {colorFields.map((f) => (
              <ColorRow
                key={`${resolved}-${f.key}`}
                id={`color-${f.key}`}
                label={f.label}
                hint={f.hint}
                value={custom[f.key] ?? defaultColors[resolved][f.key]}
                changed={!!custom[f.key]}
                onChange={(v) => setColor(f.key, v)}
              />
            ))}
          </ul>
        </div>
        {saving === 'error' && <ErrorText>Não foi possível salvar o tema. Ele continua aplicado neste navegador.</ErrorText>}
      </div>
    </Card>
  )
}

function ColorRow({ id, label, hint, value, changed, onChange }: { id: string; label: string; hint: string; value: string; changed: boolean; onChange: (v: string) => void }) {
  // O campo de texto aceita digitação livre e só aplica quando vira um hexadecimal válido.
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])

  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <input
        id={id}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="size-9 shrink-0 cursor-pointer rounded-md border border-line-strong bg-surface p-1"
      />
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-sm leading-5 font-medium">
          {label}
          {changed && <span className="ml-2 text-xs font-normal text-muted">· alterada</span>}
        </span>
        <span className="mt-0.5 block text-xs leading-4 text-muted">{hint}</span>
      </label>
      <input
        aria-label={`${label} em hexadecimal`}
        value={text}
        maxLength={7}
        spellCheck={false}
        onChange={(e) => {
          const next = e.target.value.trim()
          setText(next)
          if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next.toLowerCase())
        }}
        onBlur={() => setText(value)}
        className="h-8 w-[5.5rem] shrink-0 rounded-md border border-line-strong bg-surface px-2 text-center font-mono text-xs text-ink uppercase focus:border-accent focus:outline-none"
      />
    </li>
  )
}

function Users() {
  const me = useMe()
  const users = useUsers()
  const qc = useQueryClient()
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch(`/api/admin/users/${id}`, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
  return (
    <Card title="Usuários">
      <ul className="divide-y divide-line">
        {users.data?.map((u) => (
          <li key={u.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={u.name} />
            <div className="min-w-0 flex-1">
              <p className={cx('truncate text-sm font-medium', !u.active && 'text-muted line-through')}>
                {u.name} {u.id === me.id && <span className="font-normal text-muted">(você)</span>}
              </p>
              <p className="truncate text-xs text-muted">
                {roleLabel[u.role]} · {u.email}
              </p>
            </div>
            {u.id !== me.id &&
              (u.active ? (
                <ConfirmButton size="sm" label="Desativar" confirmLabel="Desativar acesso" onConfirm={() => toggle.mutate({ id: u.id, active: false })} />
              ) : (
                <Button size="sm" onClick={() => toggle.mutate({ id: u.id, active: true })}>
                  Reativar
                </Button>
              ))}
          </li>
        ))}
      </ul>
      <ErrorText>{toggle.error?.message}</ErrorText>
    </Card>
  )
}

function Invites() {
  const qc = useQueryClient()
  const invites = useQuery({ queryKey: ['invites'], queryFn: () => api.get<Invite[]>('/api/admin/invites') })
  const [role, setRole] = useState<Role>('MANAGER')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [created, setCreated] = useState<{ link: string; expiresAt: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const create = useMutation({
    mutationFn: () => api.post<{ link: string; expiresAt: string }>('/api/admin/invites', { role, name, email }),
    onSuccess: (data) => {
      setCreated(data)
      setCopied(false)
      setName('')
      setEmail('')
      qc.invalidateQueries({ queryKey: ['invites'] })
    },
  })
  const revoke = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/invites/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    create.mutate()
  }

  async function copy() {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.link)
      setCopied(true)
    } catch {
      ;(document.getElementById('invite-link') as HTMLInputElement | null)?.select()
    }
  }

  return (
    <Card title="Convidar pessoa">
      <form onSubmit={submit} className="flex flex-col gap-4 p-4">
        <p className="text-sm text-muted">Gere um link de criação de conta. Ele vale por 7 dias e só pode ser usado uma vez.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Tipo de acesso" htmlFor="inv-role">
            <select id="inv-role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputCls}>
              <option value="MANAGER">Gestora</option>
              <option value="ADMIN">Admin</option>
            </select>
          </Field>
          <Field label="Nome (opcional)" htmlFor="inv-name-new">
            <input id="inv-name-new" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="E-mail (opcional)" htmlFor="inv-email-new">
            <input id="inv-email-new" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <ErrorText>{create.error?.message}</ErrorText>
        <div>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            Gerar link de convite
          </Button>
        </div>
        {created && (
          <div className="flex flex-col gap-2 rounded-md bg-accent-soft p-3">
            <p className="text-[13px] font-medium">Link gerado. Envie para a pessoa:</p>
            <div className="flex gap-2">
              <input id="invite-link" readOnly value={created.link} onFocus={(e) => e.target.select()} className={cx(inputCls, 'font-mono text-xs')} />
              <Button onClick={copy}>
                <Icon name="copy" className="size-3.5" />
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
            <p className="text-xs text-muted">Válido até {formatDate(toISO(new Date(created.expiresAt)))}. Ele só aparece agora; se perder, gere outro.</p>
          </div>
        )}
      </form>
      {invites.data && invites.data.length > 0 && (
        <div className="border-t border-line">
          <p className="px-4 pt-3 text-xs font-medium text-muted">Convites em aberto</p>
          <ul className="divide-y divide-line">
            {invites.data.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {roleLabel[i.role]}
                  {i.name && ` · ${i.name}`}
                  {i.email && ` · ${i.email}`}
                  <span className="text-muted"> · até {formatDate(toISO(new Date(i.expiresAt)))}</span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => revoke.mutate(i.id)}>
                  Cancelar
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function Permissions() {
  const qc = useQueryClient()
  const perms = useQuery({
    queryKey: ['permissions'],
    queryFn: () => api.get<{ key: string; label: string; enabled: boolean }[]>('/api/admin/permissions'),
  })
  const save = useMutation({
    mutationFn: (body: Record<string, boolean>) => api.put('/api/admin/permissions', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['permissions'] }),
  })

  return (
    <Card title="Permissões da gestora">
      <p className="px-4 pt-3 text-sm text-muted">
        A gestora já pode ver tudo, criar e editar tarefas para você, mudar horário, prioridade e status, e comentar. Abaixo, o que só vale se você liberar.
      </p>
      <ul className="divide-y divide-line pt-2">
        {perms.data?.map((p) => (
          <li key={p.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <label htmlFor={`perm-${p.key}`} className="text-sm">
              {p.label}
            </label>
            <button
              id={`perm-${p.key}`}
              type="button"
              role="switch"
              aria-checked={p.enabled}
              disabled={save.isPending}
              onClick={() => save.mutate({ [p.key]: !p.enabled })}
              className={cx('relative h-5 w-9 shrink-0 rounded-full transition-colors', p.enabled ? 'bg-accent' : 'bg-line-strong')}
            >
              <span className={cx('absolute top-0.5 size-4 rounded-full bg-white shadow transition-all', p.enabled ? 'left-4.5' : 'left-0.5')} />
            </button>
          </li>
        ))}
      </ul>
      <p className="border-t border-line px-4 py-3 text-xs text-muted">
        Sempre bloqueado para a gestora: usuários, permissões, categorias, configurações, backup e apagar histórico.
      </p>
      <ErrorText>{save.error?.message}</ErrorText>
    </Card>
  )
}

function Categories() {
  const categories = useCategories()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#2f5fd0')
  const refresh = () => qc.invalidateQueries({ queryKey: ['categories'] })
  const create = useMutation({
    mutationFn: () => api.post('/api/admin/categories', { name, color }),
    onSuccess: () => (setName(''), refresh()),
  })

  return (
    <Card title="Categorias">
      <ul className="divide-y divide-line">
        {categories.data?.map((c) => (
          <CategoryRow key={c.id} category={c} />
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate()
        }}
        className="flex flex-col gap-2 border-t border-line p-4"
      >
        <div className="flex gap-2">
          <input type="color" aria-label="Cor da nova categoria" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-line-strong bg-surface p-1" />
          <input aria-label="Nome da nova categoria" placeholder="Nova categoria" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          <Button type="submit" disabled={create.isPending}>
            Adicionar
          </Button>
        </div>
        <ErrorText>{create.error?.message}</ErrorText>
      </form>
    </Card>
  )
}

function CategoryRow({ category }: { category: Category }) {
  const qc = useQueryClient()
  const [name, setName] = useState(category.name)
  const [color, setColor] = useState(category.color)
  const dirty = name !== category.name || color !== category.color
  const refresh = () => qc.invalidateQueries({ queryKey: ['categories'] })
  const save = useMutation({ mutationFn: () => api.patch(`/api/admin/categories/${category.id}`, { name, color }), onSuccess: refresh })
  const remove = useMutation({ mutationFn: () => api.del(`/api/admin/categories/${category.id}`), onSuccess: refresh })

  return (
    <li className="group flex flex-col gap-1 px-4 py-2">
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`Cor de ${category.name}`} value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-9 shrink-0 cursor-pointer rounded-md border border-line bg-surface p-1" />
        <input aria-label="Nome da categoria" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className={cx(inputCls, 'h-8 border-transparent hover:border-line-strong')} />
        {dirty ? (
          <Button size="sm" variant="primary" onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>
            Salvar
          </Button>
        ) : (
          <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100">
            <ConfirmButton size="sm" label="Remover" confirmLabel="Remover mesmo" onConfirm={() => remove.mutate()} />
          </span>
        )}
      </div>
      <ErrorText>{save.error?.message ?? remove.error?.message}</ErrorText>
    </li>
  )
}

function Backup() {
  return (
    <Card title="Backup">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-muted">Baixa um arquivo JSON com tarefas, comentários, imprevistos e histórico. Senhas não vão no arquivo.</p>
        <a href="/api/admin/export" download className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3.5 text-sm font-medium hover:bg-canvas">
          <Icon name="download" className="size-3.5" />
          Baixar backup
        </a>
      </div>
    </Card>
  )
}
