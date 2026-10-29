import { ReactNode, useEffect } from 'react'
import { PublicView } from '../../shared/types'
import { useLive } from '../lib/live'
import { formatClock, useRemaining } from '../lib/timer'
import { Loading } from '../ui/Feedback'
import { useWakeLock } from '../ui/useWakeLock'

const RING = 2 * Math.PI * 150

/** Projector view, framed like an engraved notice. */
function Frame({ children, kicker }: { children: ReactNode; kicker?: string }) {
  return (
    <div className="flex h-full w-full p-[3vmin]">
      <div className="engraved flex flex-1 flex-col items-center justify-center space-y-[2.5vmin] p-[4vmin] text-center before:h-[5vmin] before:w-[5vmin] before:border-l-[3px] before:border-t-[3px] after:h-[5vmin] after:w-[5vmin] after:border-b-[3px] after:border-r-[3px]">
        {kicker && <span className="font-display text-[3vmin] font-bold uppercase tracking-[0.3em] text-muted">{kicker}</span>}
        {children}
      </div>
    </div>
  )
}

function Night({ view }: { view: PublicView }) {
  return (
    <div className="flex h-full flex-col items-center justify-center space-y-[3vmin] bg-[#050504] text-center">
      <svg viewBox="0 0 120 120" className="h-[16vmin] w-[16vmin]" aria-hidden>
        <circle cx="60" cy="60" r="44" fill="none" stroke="#3B352C" strokeWidth="1" />
        <path d="M78 26a40 40 0 1 0 16 46A32 32 0 0 1 78 26z" fill="#ECE4D3" opacity="0.85" />
      </svg>
      <span className="font-display text-[3vmin] font-bold uppercase tracking-[0.4em] text-faint">Nuit {view.roundNumber}</span>
      <h1 className="font-display text-[9vmin] font-bold tracking-[0.08em] text-bone-dim">Thiercelieux s'endort</h1>
      <p className="font-serif text-[4vmin] italic text-[#8A8273]">Fermez les yeux. Que personne ne bouge.</p>
    </div>
  )
}

function Reveal({ view }: { view: PublicView }) {
  if (view.lastDeaths.length === 0) {
    return (
      <Frame kicker={`Jour ${view.roundNumber} · Avis au village`}>
        <p className="font-serif text-[6vmin] italic text-bone-dim">Le village se réveille…</p>
        <h1 className="font-display text-[10vmin] font-bold tracking-[0.06em]">Personne n'a péri</h1>
      </Frame>
    )
  }
  const single = view.lastDeaths.length === 1
  return (
    <Frame kicker={`${view.cycle === 'day' ? 'Jour' : 'Nuit'} ${view.roundNumber} · Avis au village`}>
      <p className="font-serif text-[5vmin] italic text-bone-dim">
        {view.deathMoment === 'dawn' ? 'Au chant du coq, on retrouva sans vie' : 'Le village a perdu'}
      </p>
      {view.lastDeaths.map(d => (
        <div key={d.name} className="flex flex-col items-center space-y-[1vmin]">
          <h1 className={`font-display font-bold leading-none tracking-[0.06em] ${single ? 'text-[17vmin]' : 'text-[10vmin]'}`}>{d.name}</h1>
          <p className="font-serif text-[4.5vmin]">qui était <span className="italic text-blood-text">{d.roleName}</span></p>
        </div>
      ))}
      <span className="h-px w-[30vmin] bg-blood" />
      <span className="font-display text-[2.6vmin] font-medium uppercase tracking-[0.2em] text-muted">{view.aliveCount} âmes demeurent</span>
    </Frame>
  )
}

function Debate({ view }: { view: PublicView }) {
  const remaining = useRemaining(view.timer)
  const fraction = view.timer.durationSeconds > 0 ? remaining / view.timer.durationSeconds : 0
  const urgent = remaining <= 30
  return (
    <Frame kicker={`Jour ${view.roundNumber} · Le village délibère`}>
      <div className="relative h-[52vmin] w-[52vmin]">
        <svg viewBox="0 0 340 340" className="h-full w-full -rotate-90" role="img" aria-label={`Temps restant ${formatClock(remaining)}`}>
          <circle cx="170" cy="170" r="150" fill="none" stroke="#25211C" strokeWidth="6" />
          <circle cx="170" cy="170" r="150" fill="none" stroke={urgent ? '#DB6A5E' : '#C0392B'} strokeWidth="6"
            strokeDasharray={RING} strokeDashoffset={RING * (1 - fraction)} style={{ transition: 'stroke-dashoffset 0.25s linear' }} />
          <circle cx="170" cy="170" r="132" fill="none" stroke="#3B352C" strokeWidth="1" />
        </svg>
        <span className={`absolute left-0 top-0 flex h-full w-full items-center justify-center font-display text-[15vmin] font-bold tabular-nums ${urgent ? 'text-blood-text' : ''}`}>
          {formatClock(remaining)}
        </span>
      </div>
      {view.accused.length > 0 && (
        <p className="flex flex-wrap items-center justify-center font-display text-[4.5vmin] font-bold tracking-[0.06em]">
          <span className="mr-[2vmin] font-serif text-[4vmin] font-normal italic tracking-normal text-muted">Sont accusés</span>
          {view.accused.map((a, i) => (
            <span key={a.name}>{i > 0 && <span className="mr-[2vmin] text-blood">·</span>}{a.name}</span>
          ))}
        </p>
      )}
    </Frame>
  )
}

function Vote({ view }: { view: PublicView }) {
  const max = Math.max(1, ...view.accused.map(a => a.votes))
  return (
    <Frame kicker={`Jour ${view.roundNumber} · Le vote`}>
      {view.accused.length === 0 && <p className="font-serif text-[5vmin] italic text-muted">Personne n'est encore accusé.</p>}
      <ul className="flex w-[70vmin] flex-col space-y-[2vmin]">
        {view.accused.map(a => (
          <li key={a.name} className="flex items-center space-x-[3vmin]">
            <span className="w-[26vmin] text-right font-display text-[5vmin] font-bold">{a.name}</span>
            <span className="h-[4vmin] bg-blood" style={{ width: `${(a.votes / max) * 34}vmin` }} />
            <span className="font-display text-[5vmin] font-bold tabular-nums">{a.votes}</span>
          </li>
        ))}
      </ul>
    </Frame>
  )
}

function Screen({ view }: { view: PublicView }) {
  if (view.phase === 'setup') {
    return (
      <Frame kicker="Les Loups-Garous de">
        <h1 className="font-display text-[14vmin] font-bold tracking-[0.08em]">Thiercelieux</h1>
        <p className="font-serif text-[4vmin] italic text-muted">La partie va bientôt commencer.</p>
      </Frame>
    )
  }
  switch (view.screen) {
    case 'blackout':
      return <div className="h-full bg-black" />
    case 'night':
      return <Night view={view} />
    case 'day':
      return (
        <Frame kicker={`Jour ${view.roundNumber}`}>
          <h1 className="font-display text-[11vmin] font-bold tracking-[0.06em]">Le village se réveille</h1>
          <p className="font-serif text-[4.5vmin] italic text-muted">{view.aliveCount} âmes sont encore en vie.</p>
        </Frame>
      )
    case 'reveal':
      return <Reveal view={view} />
    case 'debate':
      return <Debate view={view} />
    case 'vote':
      return <Vote view={view} />
    case 'victory':
      return (
        <Frame kicker="Fin de la partie">
          <h1 className="font-display text-[11vmin] font-bold tracking-[0.06em]">{view.victory?.title ?? 'La partie est terminée'}</h1>
          <p className="max-w-[80vmin] font-serif text-[4.5vmin] text-bone-dim">{view.victory?.description}</p>
        </Frame>
      )
  }
}

/** TV browsers lag behind: prefixed API, sometimes no promise, sometimes nothing at all. */
function enterFullscreen() {
  const doc = document as Document & { webkitFullscreenElement?: Element }
  if (doc.fullscreenElement || doc.webkitFullscreenElement) return
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void }
  try {
    const result = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen?.()
    if (result) result.catch(() => undefined)
  } catch {
    // Not allowed here: the browser's own full-screen mode is the fallback.
  }
}

export function PublicApp() {
  const view = useLive(s => s.view)
  useWakeLock()
  // A remote's OK button sends Enter; there is no double-click on a TV.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.keyCode === 13) enterFullscreen() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  if (!view) return <Loading label="Connexion à la partie…" />
  return (
    // fixed + full size instead of 100dvh, which older TV Chromium ignores.
    <div className="fixed left-0 top-0 h-full w-full cursor-none overflow-hidden bg-ink text-bone" onClick={enterFullscreen}>
      <div key={`${view.screen}-${view.roundNumber}-${view.cycle}`} className="h-full animate-[fadein_1.2s_ease-out]">
        <Screen view={view} />
      </div>
    </div>
  )
}
