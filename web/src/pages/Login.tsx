import { useState, type FormEvent } from 'react'
import { Button, ErrorText, Field, inputCls } from '../components/ui'
import { Brand } from '../components/Brand'
import { useAuth } from '../lib/auth'

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      <h1 className="text-lg font-semibold">Entrar</h1>
      <p className="mt-1 text-sm text-muted">Use o e-mail e a senha da sua conta.</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <Field label="E-mail" htmlFor="login-email">
          <input id="login-email" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Senha" htmlFor="login-password">
          <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" variant="primary" disabled={busy} className="mt-1 w-full">
          {busy ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <p className="mt-6 text-center text-xs text-muted">Não tem conta? O acesso é feito por convite do administrador.</p>
    </AuthShell>
  )
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Brand />
        </div>
        <div className="rounded-lg border border-line bg-surface p-6 sm:p-8">{children}</div>
      </div>
    </main>
  )
}
