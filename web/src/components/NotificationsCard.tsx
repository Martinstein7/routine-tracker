import { useReminders, type Lead } from '../lib/reminders'
import { Button, Card, cx, Segmented } from './ui'

function Switch({ id, checked, onChange, disabled }: { id: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx('relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50', checked ? 'bg-accent' : 'bg-line-strong')}
    >
      <span className={cx('absolute top-0.5 size-4 rounded-full bg-white shadow transition-all', checked ? 'left-4.5' : 'left-0.5')} />
    </button>
  )
}

/** Lembretes de horário das tarefas: antecedência e notificações do Windows. Vale para este navegador. */
export function NotificationsCard() {
  const { prefs, setPrefs, permission, requestPermission, test } = useReminders()

  return (
    <Card title="Notificações">
      <div className="flex flex-col gap-5 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="rem-enabled" className="text-sm">
            <span className="block font-medium">Lembrar o horário das tarefas</span>
            <span className="block text-xs text-muted">Avisa quando chega a hora de começar cada tarefa sua que ainda não foi iniciada.</span>
          </label>
          <Switch id="rem-enabled" checked={prefs.enabled} onChange={(enabled) => setPrefs({ enabled })} />
        </div>

        {prefs.enabled && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium">Quando avisar</span>
              <Segmented<string>
                label="Quando avisar"
                value={String(prefs.lead)}
                onChange={(v) => setPrefs({ lead: Number(v) as Lead })}
                options={[
                  { value: '0', label: 'Na hora' },
                  { value: '5', label: '5 min antes' },
                  { value: '10', label: '10 min' },
                  { value: '15', label: '15 min' },
                ]}
              />
            </div>

            <div className="flex flex-col gap-3 rounded-md border border-line p-3">
              <p className="text-sm font-medium">Notificação do Windows</p>
              {permission === 'unsupported' ? (
                <p className="text-[13px] text-muted">
                  Só funciona abrindo o site por <strong className="font-medium text-ink">http://localhost:3000</strong>, no computador onde ele roda. Pelo IP da
                  rede o navegador não permite; o sino continua funcionando.
                </p>
              ) : permission === 'denied' ? (
                <p className="text-[13px] text-muted">
                  O navegador está bloqueando as notificações deste site. Clique no ícone ao lado do endereço, em <strong className="font-medium text-ink">Notificações</strong>, escolha{' '}
                  <strong className="font-medium text-ink">Permitir</strong> e recarregue a página.
                </p>
              ) : permission === 'default' ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[13px] text-muted">O navegador precisa da sua permissão para mostrar avisos no canto da tela.</p>
                  <Button variant="primary" size="sm" onClick={requestPermission}>
                    Permitir notificações
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="rem-desktop" className="text-[13px]">
                      Mostrar os lembretes no canto da tela
                    </label>
                    <Switch id="rem-desktop" checked={prefs.desktop} onChange={(desktop) => setPrefs({ desktop })} />
                  </div>
                  {prefs.desktop && (
                    <div>
                      <Button size="sm" onClick={test}>
                        Enviar notificação de teste
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        <p className="text-xs text-muted">
          Os lembretes funcionam com o site aberto numa aba, mesmo minimizada. Com o navegador fechado, não chegam. Estas opções valem para este navegador.
        </p>
      </div>
    </Card>
  )
}
