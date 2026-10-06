export function Brand() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
        <rect width="32" height="32" rx="8" className="fill-accent" />
        <circle cx="16" cy="16" r="8" fill="none" className="stroke-on-accent" strokeWidth="2.5" />
        <path d="M16 11v5l3 2" fill="none" className="stroke-on-accent" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight">Routine Tracker</span>
    </span>
  )
}
