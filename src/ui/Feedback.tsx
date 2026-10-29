import { useLive } from '../lib/live'

/** Refusals from the server (rule errors), shown briefly at the top. */
export function ErrorToast() {
  const error = useLive(s => s.error)
  const clear = useLive(s => s.clearError)
  if (!error) return null
  return (
    <button
      type="button"
      onClick={clear}
      className="fixed left-1/2 top-3 z-50 w-[min(92vw,520px)] -translate-x-1/2 border border-blood bg-blood-deep px-4 py-3 text-left font-sans text-[15px] text-bone shadow-2xl"
    >
      {error}
    </button>
  )
}

export function DeniedScreen() {
  const reason = useLive(s => s.deniedReason)
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div className="engraved max-w-sm p-6">
        <h1 className="font-display text-2xl font-bold">Accès refusé</h1>
        <p className="mt-3 font-serif text-lg text-bone-dim">{reason}</p>
      </div>
    </div>
  )
}

export function Loading({ label = 'Connexion au serveur…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center font-serif text-lg italic text-muted">{label}</div>
  )
}

export function ConnectionBadge() {
  const status = useLive(s => s.status)
  const pending = useLive(s => s.pending)
  const online = status === 'open'
  return (
    <span className={`flex items-center gap-1.5 font-sans text-xs ${online ? 'text-muted' : 'text-blood-text'}`}>
      <span className={`h-2 w-2 rounded-full ${online ? 'bg-ok' : 'animate-pulse bg-blood-go'}`} />
      {online ? 'connecté' : `hors ligne${pending > 0 ? ` · ${pending} en attente` : ''}`}
    </span>
  )
}
