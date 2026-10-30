import { ReactNode, useEffect, useState } from 'react'
import { PublicView } from '../../shared/types'
import { reportAudioReady, useLive } from '../lib/live'
import { formatClock, useRemaining } from '../lib/timer'
import { useShowAudio } from '../lib/useShowAudio'
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
        <div key={d.seat} className="flex flex-col items-center space-y-[1vmin]">
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
  const fraction = view.timer.durationSeconds > 0 ? Math.min(1, remaining / view.timer.durationSeconds) : 0
  const urgent = remaining <= 30
  const timeUp = remaining === 0 && view.timer.endsAt !== null
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
      {timeUp && <p className="font-display text-[6vmin] font-bold uppercase tracking-[0.2em] text-blood-text">Temps écoulé</p>}
      {view.accused.length > 0 && (
        <p className="flex flex-wrap items-center justify-center font-display text-[4.5vmin] font-bold tracking-[0.06em]">
          <span className="mr-[2vmin] font-serif text-[4vmin] font-normal italic tracking-normal text-muted">Sont accusés</span>
          {view.accused.map((a, i) => (
            <span key={a.seat}>{i > 0 && <span className="mr-[2vmin] text-blood">·</span>}{a.name}</span>
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
          <li key={a.seat} className="flex items-center space-x-[3vmin]">
            <span className="w-[26vmin] text-right font-display text-[5vmin] font-bold">{a.name}</span>
            <span className="h-[4vmin] bg-blood" style={{ width: `${(a.votes / max) * 34}vmin` }} />
            <span className="font-display text-[5vmin] font-bold tabular-nums">{a.votes}</span>
          </li>
        ))}
      </ul>
    </Frame>
  )
}

function Village({ view }: { view: PublicView }) {
  const seats = view.village ?? []
  return (
    <Frame kicker={`${view.cycle === 'day' ? 'Jour' : 'Nuit'} ${view.roundNumber} · Le village`}>
      <ul className="grid w-full max-w-[150vmin] grid-cols-4 gap-x-[3vmin] gap-y-[2vmin]">
        {seats.map(s => (
          <li key={s.seat} className={`flex items-baseline space-x-[1.5vmin] border-b border-rule pb-[1vmin] text-left ${s.alive ? '' : 'opacity-60'}`}>
            <span className="font-display text-[2.4vmin] font-bold text-muted">{s.seat}</span>
            <span className="flex min-w-0 flex-col">
              <span className={`truncate font-display text-[3.6vmin] font-bold ${s.alive ? '' : 'line-through'}`}>
                {s.name}{s.captain && <span className="ml-[1vmin] font-serif text-[2.6vmin] font-normal italic text-blood-text">capitaine</span>}
              </span>
              {s.roleName && <span className="truncate font-serif text-[2.6vmin] italic text-blood-text">{s.roleName}</span>}
            </span>
          </li>
        ))}
      </ul>
      <span className="font-display text-[2.6vmin] font-medium uppercase tracking-[0.2em] text-muted">{view.aliveCount} âmes demeurent</span>
    </Frame>
  )
}

function Composition({ view }: { view: PublicView }) {
  return (
    <Frame kicker="Les cartes en jeu">
      <ul className="columns-2 gap-x-[8vmin] text-left">
        {(view.composition ?? []).map(r => (
          <li key={r.roleName} className="flex items-baseline space-x-[2vmin] py-[0.6vmin] font-serif text-[4vmin]">
            <span className="w-[5vmin] text-right font-display font-bold tabular-nums text-blood-text">{r.count}</span>
            <span>{r.roleName}</span>
          </li>
        ))}
      </ul>
    </Frame>
  )
}

function Victory({ view }: { view: PublicView }) {
  const cards = view.finalReveal ?? []
  return (
    <Frame kicker="Fin de la partie">
      <h1 className={`font-display font-bold tracking-[0.06em] ${cards.length > 0 ? 'text-[7vmin]' : 'text-[11vmin]'}`}>{view.victory?.title ?? 'La partie est terminée'}</h1>
      <p className="max-w-[110vmin] font-serif text-[3.2vmin] text-bone-dim">{view.victory?.description}</p>
      {cards.length > 0 && (
        <ul className="grid w-full max-w-[150vmin] grid-cols-4 gap-x-[3vmin] gap-y-[1.4vmin] pt-[1vmin]">
          {cards.map(c => (
            <li key={c.seat} className="flex flex-col border-b border-rule pb-[0.6vmin] text-left">
              <span className={`truncate font-display text-[3vmin] font-bold ${c.alive ? '' : 'text-muted line-through'}`}>{c.name}</span>
              <span className="truncate font-serif text-[2.4vmin] italic text-blood-text">
                {c.roleName}{c.tags.length > 0 && <span className="text-muted"> · {c.tags.join(' · ')}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  )
}

/** Test card: the corner marks must all be visible, or the TV is cropping the picture (overscan). */
function TestCard() {
  const [size, setSize] = useState(() => `${window.innerWidth} × ${window.innerHeight}`)
  useEffect(() => {
    const onResize = () => setSize(`${window.innerWidth} × ${window.innerHeight}`)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const corner = 'absolute h-[8vmin] w-[8vmin] border-blood-go'
  return (
    <div className="relative flex h-full flex-col items-center justify-center space-y-[2vmin] bg-ink text-center">
      <span className={`${corner} left-0 top-0 border-l-[6px] border-t-[6px]`} />
      <span className={`${corner} right-0 top-0 border-r-[6px] border-t-[6px]`} />
      <span className={`${corner} bottom-0 left-0 border-b-[6px] border-l-[6px]`} />
      <span className={`${corner} bottom-0 right-0 border-b-[6px] border-r-[6px]`} />
      <h1 className="font-display text-[9vmin] font-bold tracking-[0.08em]">Mire</h1>
      <p className="font-serif text-[4vmin] text-bone-dim">Les quatre coins rouges doivent être entièrement visibles.</p>
      <p className="font-sans text-[3vmin] tabular-nums text-muted">{size}</p>
    </div>
  )
}

function Screen({ view }: { view: PublicView }) {
  if (view.phase === 'setup' && view.screen !== 'test') {
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
    case 'village':
      return <Village view={view} />
    case 'test':
      return <TestCard />
    case 'composition':
      return <Composition view={view} />
    case 'captain':
      return (
        <Frame kicker={`Jour ${view.roundNumber} · Le village a choisi`}>
          <h1 className="font-display text-[14vmin] font-bold leading-none tracking-[0.06em]">{view.captain ?? 'Pas de capitaine'}</h1>
          {view.captain && <p className="font-serif text-[4.5vmin] italic text-bone-dim">est élu Capitaine. En cas d'égalité, il tranche.</p>}
        </Frame>
      )
    case 'victory':
      return <Victory view={view} />
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
  const audio = useShowAudio(view?.audio)
  const { unlock } = audio
  useWakeLock()
  useEffect(() => reportAudioReady(audio.ready), [audio.ready])
  useEffect(() => { void unlock() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.keyCode !== 13) return
      enterFullscreen()
      void unlock()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  if (!view) return <Loading label="Connexion à la partie…" />
  return (
    <div className="fixed left-0 top-0 h-full w-full cursor-none overflow-hidden bg-ink text-bone"
      onClick={() => { enterFullscreen(); void unlock() }}>
      <div key={`${view.screen}-${view.roundNumber}-${view.cycle}`} className="h-full animate-[fadein_1.2s_ease-out]">
        <Screen view={view} />
      </div>
      {view.audio && !audio.ready && (
        <span className="absolute bottom-[3vmin] right-[4vmin] font-display text-[2vmin] uppercase tracking-[0.2em] text-faint">
          Appuyez sur OK pour activer le son
        </span>
      )}
    </div>
  )
}
