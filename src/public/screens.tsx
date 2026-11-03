import { ReactNode, useEffect, useState } from 'react'
import { PublicView } from '../../shared/types'
import { formatClock, useRemaining } from '../lib/timer'

const RING = 2 * Math.PI * 150

/** Projector view, framed like an engraved notice. */
function Frame({ children, kicker }: { children: ReactNode; kicker?: string }) {
  return (
    <div className="flex h-full w-full p-[3cqmin]">
      <div className="engraved flex flex-1 flex-col items-center justify-center space-y-[2.5cqmin] p-[4cqmin] text-center before:h-[5cqmin] before:w-[5cqmin] before:border-l-[3px] before:border-t-[3px] after:h-[5cqmin] after:w-[5cqmin] after:border-b-[3px] after:border-r-[3px]">
        {kicker && <span className="font-display text-[3cqmin] font-bold uppercase tracking-[0.3em] text-muted">{kicker}</span>}
        {children}
      </div>
    </div>
  )
}

function Night({ view }: { view: PublicView }) {
  return (
    <div className="flex h-full flex-col items-center justify-center space-y-[3cqmin] bg-[#050504] text-center">
      <svg viewBox="0 0 120 120" className="h-[16cqmin] w-[16cqmin]" aria-hidden>
        <circle cx="60" cy="60" r="44" fill="none" stroke="#3B352C" strokeWidth="1" />
        <path d="M78 26a40 40 0 1 0 16 46A32 32 0 0 1 78 26z" fill="#ECE4D3" opacity="0.85" />
      </svg>
      <span className="font-display text-[3cqmin] font-bold uppercase tracking-[0.4em] text-faint">Nuit {view.roundNumber}</span>
      <h1 className="font-display text-[9cqmin] font-bold tracking-[0.08em] text-bone-dim">Thiercelieux s'endort</h1>
      <p className="font-serif text-[4cqmin] italic text-[#8A8273]">Fermez les yeux. Que personne ne bouge.</p>
    </div>
  )
}

function Reveal({ view }: { view: PublicView }) {
  if (view.lastDeaths.length === 0) {
    return (
      <Frame kicker={`Jour ${view.roundNumber} · Avis au village`}>
        <p className="font-serif text-[6cqmin] italic text-bone-dim">Le village se réveille…</p>
        <h1 className="font-display text-[10cqmin] font-bold tracking-[0.06em]">Personne n'a péri</h1>
      </Frame>
    )
  }
  const single = view.lastDeaths.length === 1
  return (
    <Frame kicker={`${view.cycle === 'day' ? 'Jour' : 'Nuit'} ${view.roundNumber} · Avis au village`}>
      <p className="font-serif text-[5cqmin] italic text-bone-dim">
        {view.deathMoment === 'dawn' ? 'Au chant du coq, on retrouva sans vie' : 'Le village a perdu'}
      </p>
      {view.lastDeaths.map(d => (
        // Names come one at a time: only the newcomer fades in.
        <div key={d.seat} className="flex animate-[fadein_1.2s_ease-out] flex-col items-center space-y-[1cqmin]">
          <h1 className={`font-display font-bold leading-none tracking-[0.06em] ${single ? 'text-[17cqmin]' : 'text-[10cqmin]'}`}>{d.name}</h1>
          <p className="font-serif text-[4.5cqmin]">qui était <span className="italic text-blood-text">{d.roleName}</span></p>
        </div>
      ))}
      <span className="h-px w-[30cqmin] bg-blood" />
      <span className="font-display text-[2.6cqmin] font-medium uppercase tracking-[0.2em] text-muted">{view.aliveCount} âmes demeurent</span>
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
      <div className="relative h-[52cqmin] w-[52cqmin]">
        <svg viewBox="0 0 340 340" className="h-full w-full -rotate-90" role="img" aria-label={`Temps restant ${formatClock(remaining)}`}>
          <circle cx="170" cy="170" r="150" fill="none" stroke="#25211C" strokeWidth="6" />
          <circle cx="170" cy="170" r="150" fill="none" stroke={urgent ? '#DB6A5E' : '#C0392B'} strokeWidth="6"
            strokeDasharray={RING} strokeDashoffset={RING * (1 - fraction)} style={{ transition: 'stroke-dashoffset 0.25s linear' }} />
          <circle cx="170" cy="170" r="132" fill="none" stroke="#3B352C" strokeWidth="1" />
        </svg>
        <span className={`absolute left-0 top-0 flex h-full w-full items-center justify-center font-display text-[15cqmin] font-bold tabular-nums ${urgent ? 'text-blood-text' : ''}`}>
          {formatClock(remaining)}
        </span>
      </div>
      {timeUp && <p className="font-display text-[6cqmin] font-bold uppercase tracking-[0.2em] text-blood-text">Temps écoulé</p>}
      {view.accused.length > 0 && (
        <p className="flex flex-wrap items-center justify-center font-display text-[4.5cqmin] font-bold tracking-[0.06em]">
          <span className="mr-[2cqmin] font-serif text-[4cqmin] font-normal italic tracking-normal text-muted">Sont accusés</span>
          {view.accused.map((a, i) => (
            <span key={a.seat}>{i > 0 && <span className="mr-[2cqmin] text-blood">·</span>}{a.name}</span>
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
      {view.accused.length === 0 && <p className="font-serif text-[5cqmin] italic text-muted">Personne n'est encore accusé.</p>}
      <ul className="flex w-[70cqmin] flex-col space-y-[2cqmin]">
        {view.accused.map(a => (
          <li key={a.seat} className="flex items-center space-x-[3cqmin]">
            <span className="w-[26cqmin] text-right font-display text-[5cqmin] font-bold">{a.name}</span>
            <span className="h-[4cqmin] bg-blood" style={{ width: `${(a.votes / max) * 34}cqmin` }} />
            <span className="font-display text-[5cqmin] font-bold tabular-nums">{a.votes}</span>
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
      <ul className="grid w-full max-w-[150cqmin] grid-cols-4 gap-x-[3cqmin] gap-y-[2cqmin]">
        {seats.map(s => (
          <li key={s.seat} className={`flex items-baseline space-x-[1.5cqmin] border-b border-rule pb-[1cqmin] text-left ${s.alive ? '' : 'opacity-60'}`}>
            <span className="font-display text-[2.4cqmin] font-bold text-muted">{s.seat}</span>
            <span className="flex min-w-0 flex-col">
              <span className={`truncate font-display text-[3.6cqmin] font-bold ${s.alive ? '' : 'line-through'}`}>
                {s.name}{s.captain && <span className="ml-[1cqmin] font-serif text-[2.6cqmin] font-normal italic text-blood-text">capitaine</span>}
              </span>
              {s.roleName && <span className="truncate font-serif text-[2.6cqmin] italic text-blood-text">{s.roleName}</span>}
            </span>
          </li>
        ))}
      </ul>
      <span className="font-display text-[2.6cqmin] font-medium uppercase tracking-[0.2em] text-muted">{view.aliveCount} âmes demeurent</span>
    </Frame>
  )
}

function Composition({ view }: { view: PublicView }) {
  return (
    <Frame kicker="Les cartes en jeu">
      <ul className="columns-2 gap-x-[8cqmin] text-left">
        {(view.composition ?? []).map(r => (
          <li key={r.roleName} className="flex items-baseline space-x-[2cqmin] py-[0.6cqmin] font-serif text-[4cqmin]">
            <span className="w-[5cqmin] text-right font-display font-bold tabular-nums text-blood-text">{r.count}</span>
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
      <h1 className={`font-display font-bold tracking-[0.06em] ${cards.length > 0 ? 'text-[7cqmin]' : 'text-[11cqmin]'}`}>{view.victory?.title ?? 'La partie est terminée'}</h1>
      <p className="max-w-[110cqmin] font-serif text-[3.2cqmin] text-bone-dim">{view.victory?.description}</p>
      {cards.length > 0 && (
        <ul className="grid w-full max-w-[150cqmin] grid-cols-4 gap-x-[3cqmin] gap-y-[1.4cqmin] pt-[1cqmin]">
          {cards.map(c => (
            <li key={c.seat} className="flex flex-col border-b border-rule pb-[0.6cqmin] text-left">
              <span className={`truncate font-display text-[3cqmin] font-bold ${c.alive ? '' : 'text-muted line-through'}`}>{c.name}</span>
              <span className="truncate font-serif text-[2.4cqmin] italic text-blood-text">
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
  const corner = 'absolute h-[8cqmin] w-[8cqmin] border-blood-go'
  return (
    <div className="relative flex h-full flex-col items-center justify-center space-y-[2cqmin] bg-ink text-center">
      <span className={`${corner} left-0 top-0 border-l-[6px] border-t-[6px]`} />
      <span className={`${corner} right-0 top-0 border-r-[6px] border-t-[6px]`} />
      <span className={`${corner} bottom-0 left-0 border-b-[6px] border-l-[6px]`} />
      <span className={`${corner} bottom-0 right-0 border-b-[6px] border-r-[6px]`} />
      <h1 className="font-display text-[9cqmin] font-bold tracking-[0.08em]">Mire</h1>
      <p className="font-serif text-[4cqmin] text-bone-dim">Les quatre coins rouges doivent être entièrement visibles.</p>
      <p className="font-sans text-[3cqmin] tabular-nums text-muted">{size}</p>
    </div>
  )
}

/** One projector screen, sized to its container: the TV fills it, the MJ's phone shows it in miniature. */
export function Screen({ view }: { view: PublicView }) {
  if (view.phase === 'setup' && view.screen !== 'test') {
    return (
      <Frame kicker="Les Loups-Garous de">
        <h1 className="font-display text-[14cqmin] font-bold tracking-[0.08em]">Thiercelieux</h1>
        <p className="font-serif text-[4cqmin] italic text-muted">La partie va bientôt commencer.</p>
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
          <h1 className="font-display text-[11cqmin] font-bold tracking-[0.06em]">Le village se réveille</h1>
          <p className="font-serif text-[4.5cqmin] italic text-muted">{view.aliveCount} âmes sont encore en vie.</p>
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
          <h1 className="font-display text-[14cqmin] font-bold leading-none tracking-[0.06em]">{view.captain ?? 'Pas de capitaine'}</h1>
          {view.captain && <p className="font-serif text-[4.5cqmin] italic text-bone-dim">est élu Capitaine. En cas d'égalité, il tranche.</p>}
        </Frame>
      )
    case 'victory':
      return <Victory view={view} />
  }
}
