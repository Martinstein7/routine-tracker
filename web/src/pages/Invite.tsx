import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, ErrorText, Field, inputCls } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { roleLabel } from '../lib/format'
import type { Role } from '../types'
import { AuthShell } from './Login'

export function InvitePage() {
  const { token = '' } = useParams()
  const { acceptInvite } = useAuth()
  const navigate = useNavigate()
  const invite = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api.get<{ role: Role; name: string | null; email: string | null }>(`/api/invites/${token}`),
    retry: false,
  })

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (invite.isPending) {
    return <AuthShell><p className="text-sm text-muted">Verificando o convite…</p></AuthShell>
  }
  if (invite.isError) {
    return (
      <AuthShell>
        <h1 className="text-lg font-semibold">Convite indisponível</h1>
        <p className="mt-2 text-sm text-muted">{invite.error.message} Peça um novo link ao administrador.</p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-accent hover:underline">
          Ir para o login
        </Link>
      </AuthShell>
    )
  }

  const data = invite.data
  const finalEmail = data.email ?? email

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) return setError('As senhas não conferem.')
    setBusy(true)
    try {
      await acceptInvite(token, { name: name || data.name || '', email: finalEmail, password })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a conta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      <h1 className="text-lg font-semibold">Criar sua conta</h1>
      <p className="mt-1 text-sm text-muted">
        Você foi convidado com acesso de <strong className="font-medium text-ink">{roleLabel[data.role]}</strong>.
      </p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <Field label="Nome" htmlFor="inv-name">
          <input id="inv-name" required autoFocus autoComplete="name" defaultValue={data.name ?? ''} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="E-mail" htmlFor="inv-email" hint={data.email ? 'Definido pelo convite.' : undefined}>
          <input id="inv-email" type="email" required autoComplete="username" value={finalEmail} disabled={!!data.email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Senha" htmlFor="inv-password" hint="Pelo menos 8 caracteres.">
          <input id="inv-password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Confirmar senha" htmlFor="inv-confirm">
          <input id="inv-confirm" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" variant="primary" disabled={busy} className="mt-1 w-full">
          {busy ? 'Criando…' : 'Criar conta e entrar'}
        </Button>
      </form>
    </AuthShell>
  )
}
