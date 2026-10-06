import { useMe } from '../lib/auth'
import { useOwner } from '../lib/owner'

export function OwnerSelect() {
  const me = useMe()
  const { ownerId, setOwnerId, options } = useOwner()
  if (options.length < 2) return null
  return (
    <label className="flex items-center gap-2 text-[13px] text-muted">
      Rotina de
      <select
        value={ownerId ?? ''}
        onChange={(e) => setOwnerId(e.target.value)}
        className="h-9 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink focus:border-accent focus:outline-none"
      >
        {options.map((u) => (
          <option key={u.id} value={u.id}>
            {u.id === me.id ? `${u.name} (você)` : u.name}
          </option>
        ))}
      </select>
    </label>
  )
}
