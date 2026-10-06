import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, ErrorText, Field, inputCls } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { AuthShell } from './Login'

export function SetupPage() {
  const { setupAdmin } = useAuth()
  const navigate = useNavigate()
  const setup = useQuery({
    queryKey: ['setup'],
    queryFn: () => api.get<{ available: boolean }>('/api/setup'),
    retry: false,
  })

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (setup.isPending) {
    return <AuthShell><p className="text-sm text-muted">Verificando…</p></AuthShell>
  }
  if (setup.isError) {
    return (
      <AuthShell>
        <h1 className="text-lg font-semibold">Cadastro indisponível</h1>
        <p className="mt-2 text-sm text-muted">{setup.error.message}</p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-accent hover:underline">
          Ir para o login
        </Link>
      </AuthShell>
    )
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) return setError('As senhas não conferem.')
    setBusy(true)
    try {
      await setupAdmin({ name, email, password })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a conta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      <h1 className="text-lg font-semibold">Criar conta de administrador</h1>
      <p className="mt-1 text-sm text-muted">
        Primeiro acesso ao sistema. Depois desta conta, as próximas entram por convite.
      </p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <Field label="Nome" htmlFor="setup-name">
          <input id="setup-name" required autoFocus autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="E-mail" htmlFor="setup-email">
          <input id="setup-email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Senha" htmlFor="setup-password" hint="Pelo menos 8 caracteres.">
          <input id="setup-password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Confirmar senha" htmlFor="setup-confirm">
          <input id="setup-confirm" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" variant="primary" disabled={busy} className="mt-1 w-full">
          {busy ? 'Criando…' : 'Criar conta e entrar'}
        </Button>
      </form>
    </AuthShell>
  )
}
