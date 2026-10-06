import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from './api'

export type ThemeMode = 'light' | 'dark' | 'system'
export type Resolved = 'light' | 'dark'
export type ColorKey = 'accent' | 'canvas' | 'surface' | 'line' | 'ink' | 'muted'
export type Palette = Partial<Record<ColorKey, string>>
export type ThemePrefs = { mode: ThemeMode; light: Palette; dark: Palette }

/** Mesmos valores de index.css: é o que aparece no seletor quando a cor não foi trocada. */
export const defaultColors: Record<Resolved, Record<ColorKey, string>> = {
  light: { accent: '#2f5fd0', canvas: '#f6f7f9', surface: '#ffffff', line: '#e5e7ec', ink: '#1c2230', muted: '#687085' },
  dark: { accent: '#6b93f0', canvas: '#0f1218', surface: '#171b23', line: '#262c38', ink: '#e6e9ef', muted: '#9aa3b5' },
}

export const colorFields: { key: ColorKey; label: string; hint: string }[] = [
  { key: 'accent', label: 'Destaque', hint: 'Botões, links e item selecionado' },
  { key: 'canvas', label: 'Fundo', hint: 'Atrás de tudo' },
  { key: 'surface', label: 'Cartões', hint: 'Painéis, listas e formulários' },
  { key: 'line', label: 'Bordas', hint: 'Divisórias e contornos' },
  { key: 'ink', label: 'Texto', hint: 'Títulos e texto principal' },
  { key: 'muted', label: 'Texto secundário', hint: 'Descrições e legendas' },
]

const defaultPrefs: ThemePrefs = { mode: 'system', light: {}, dark: {} }
// Cópia local do tema: o script em index.html lê daqui para a página já abrir com as cores certas.
const STORAGE_KEY = 'rt-theme'

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')
const resolve = (mode: ThemeMode): Resolved => (mode === 'system' ? (darkQuery().matches ? 'dark' : 'light') : mode)

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Texto sobre a cor de destaque: branco ou escuro, o que tiver mais contraste. */
function onAccent(accent: string) {
  const l = luminance(accent)
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.0565 ? '#ffffff' : '#111318'
}

function cssVars(palette: Palette) {
  const vars: Record<string, string> = {}
  for (const [key, value] of Object.entries(palette)) if (value) vars[`--color-${key}`] = value
  if (palette.accent) vars['--color-on-accent'] = onAccent(palette.accent)
  return vars
}

function apply(prefs: ThemePrefs) {
  const resolved = resolve(prefs.mode)
  const root = document.documentElement
  root.dataset.theme = resolved
  for (const key of [...colorFields.map((f) => f.key), 'on-accent']) root.style.removeProperty(`--color-${key}`)
  for (const [name, value] of Object.entries(cssVars(prefs[resolved]))) root.style.setProperty(name, value)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: prefs.mode, vars: { light: cssVars(prefs.light), dark: cssVars(prefs.dark) }, prefs }))
  } catch {
    // Sem armazenamento local: o tema só não abre pronto na próxima visita.
  }
}

function readCache(): ThemePrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (saved?.prefs) return saved.prefs
  } catch {
    // Cache corrompido ou indisponível: usa o padrão.
  }
  return defaultPrefs
}

type ThemeValue = {
  prefs: ThemePrefs
  resolved: Resolved
  saving: 'idle' | 'saving' | 'saved' | 'error'
  setMode: (mode: ThemeMode) => void
  setColor: (key: ColorKey, value: string) => void
  resetColors: () => void
}

const ThemeContext = createContext<ThemeValue | null>(null)

/** `saved` é o tema guardado na conta (null se a pessoa nunca mudou); sem sessão, nada é salvo. */
export function ThemeProvider({ loggedIn, saved, children }: { loggedIn: boolean; saved: ThemePrefs | null; children: ReactNode }) {
  const queryClient = useQueryClient()
  const [prefs, setPrefs] = useState<ThemePrefs>(readCache)
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs
  const [systemDark, setSystemDark] = useState(() => darkQuery().matches)
  const [saving, setSaving] = useState<ThemeValue['saving']>('idle')
  const timer = useRef<number | undefined>(undefined)

  // Quando a sessão carrega, o tema da conta vale mais que a cópia local.
  useEffect(() => {
    if (saved) setPrefs(saved)
  }, [saved])

  useEffect(() => {
    const query = darkQuery()
    const onChange = () => setSystemDark(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => apply(prefs), [prefs, systemDark])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Salva na conta com um pequeno atraso: o seletor de cor dispara a cada movimento.
  const update = useCallback(
    (next: (p: ThemePrefs) => ThemePrefs) => {
      const value = next(prefsRef.current)
      prefsRef.current = value
      setPrefs(value)
      if (!loggedIn) return
      window.clearTimeout(timer.current)
      setSaving('saving')
      timer.current = window.setTimeout(async () => {
        try {
          await api.put('/api/auth/me/theme', value)
          queryClient.setQueryData<{ theme?: ThemePrefs | null }>(['me'], (s) => (s ? { ...s, theme: value } : s))
          setSaving('saved')
        } catch {
          setSaving('error')
        }
      }, 600)
    },
    [loggedIn, queryClient],
  )

  const resolved = prefs.mode === 'system' ? (systemDark ? 'dark' : 'light') : prefs.mode

  const value = useMemo<ThemeValue>(
    () => ({
      prefs,
      resolved,
      saving,
      setMode: (mode) => update((p) => ({ ...p, mode })),
      setColor: (key, color) => update((p) => ({ ...p, [resolved]: { ...p[resolved], [key]: color } })),
      resetColors: () => update((p) => ({ ...p, [resolved]: {} })),
    }),
    [prefs, resolved, saving, update],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme fora do ThemeProvider')
  return ctx
}
