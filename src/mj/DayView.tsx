import { Pause, Play, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ROLES } from '../../shared/roles'
import { getBearGrowlStatus } from '../../shared/rules'
import { GameState, Player } from '../../shared/types'
import { haptics } from '../lib/haptics'
import { useLive } from '../lib/live'
import { formatClock, useRemaining } from '../lib/timer'
import { PickerSheet, PrimaryButton, SecondaryButton, StickyFooter } from './parts'

const DURATIONS = [120, 180, 300]

export function TimerControls({ game }: { game: GameState }) {
  const dispatch = useLive(s => s.dispatch)
  const remaining = useRemaining(game.timer)
  const running = game.timer.endsAt !== null
  const wasRunning = useRef(running)
  useEffect(() => {
    if (wasRunning.current && running && remaining === 0) haptics.timeUp()
    wasRunning.current = running && remaining > 0
  }, [remaining, running])

  return (
    <div className="flex items-center gap-1.5">
      <span className={`font-display text-2xl font-bold tabular-nums ${remaining <= 30 && running ? 'text-blood-text' : ''}`}>{formatClock(remaining)}</span>
      <button type="button" aria-label={running ? 'Mettre le débat en pause' : 'Lancer le débat'}
        onClick={() => dispatch(running ? { type: 'PAUSE_TIMER' } : { type: 'START_TIMER' })}
        className="flex h-12 w-12 items-center justify-center border border-rule">{running ? <Pause size={18} /> : <Play size={18} />}</button>
    </div>
  )
}

export function DayView({ game }: { game: GameState }) {
  const dispatch = useLive(s => s.dispatch)
  const [picker, setPicker] = useState<'accuse' | 'captain' | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const byId = (id: string) => game.players.find(p => p.id === id)
  const alive = game.players.filter(p => p.isAlive)
  const captain = game.players.find(p => p.isCaptain && p.isAlive)
  const bear = game.villagePowersDisabled ? null : getBearGrowlStatus(game.players)
  const wounded = byId(game.night.rustyWoundedWolfId ?? '')

  const { accusedIds, votes, corbeauBonus } = game.vote
  const ranked = [...accusedIds].sort((a, b) => (votes[b] ?? 0) - (votes[a] ?? 0))
  const top = ranked[0]
  const tie = ranked.length > 1 && (votes[ranked[0]] ?? 0) === (votes[ranked[1]] ?? 0)
  const condemnedId = selected && accusedIds.includes(selected) ? selected : tie ? undefined : top
  const condemned = condemnedId ? byId(condemnedId) : undefined

  return (
    <>
      <div className="flex flex-col gap-2 px-4 pt-4">
        <section className="border border-rule px-4 py-3">
          <span className="label-caps">À annoncer ce matin</span>
          <p className="mt-1 font-serif text-[19px] leading-snug">
            {game.dawnDeathIds.length === 0
              ? 'Personne n\'est mort cette nuit.'
              : game.dawnDeathIds.map(id => byId(id)).filter((p): p is Player => p !== undefined)
                .map(p => `${p.name} (${ROLES[p.roleId].name})`).join(', ') + (game.dawnDeathIds.length > 1 ? ' sont morts.' : ' est mort.')}
          </p>
        </section>
        {bear?.growls && (
          <section className="flex flex-col border border-blood bg-blood-deep px-4 py-3">
            <span className="font-display text-[15px] font-bold tracking-[0.06em] text-[#F6EFE0]">L'ours grogne</span>
            <span className="font-serif text-base text-[#E8CFC9]">Voisins : {bear.leftNeighbor?.name} et {bear.rightNeighbor?.name}</span>
          </section>
        )}
        {wounded && wounded.isAlive && (
          <p className="border border-rule px-4 py-3 font-serif text-base italic text-bone-dim">{wounded.name} est blessé par l'épée rouillée : il mourra cette nuit.</p>
        )}
        {!captain && (
          <button type="button" onClick={() => setPicker('captain')} className="min-h-[52px] border border-rule font-display text-[15px] font-bold tracking-[0.06em]">
            Élire le Capitaine
          </button>
        )}
      </div>

      <div className="flex items-baseline justify-between px-5 pb-2 pt-5">
        <h2 className="font-display text-lg font-bold tracking-[0.08em]">Le vote</h2>
        <span className="font-serif text-[15px] italic text-muted">
          {alive.length} votants{captain ? ` · capitaine ${captain.name}` : ''}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 px-4">
        {ranked.length === 0 && <p className="px-1 font-serif text-lg italic text-muted">Aucun accusé pour l'instant.</p>}
        {ranked.map(id => {
          const p = byId(id)
          if (!p) return null
          const isPick = condemnedId === id
          return (
            <div key={id} className={`flex items-center gap-1.5 py-2 pl-3 pr-2 ${isPick ? 'border border-blood bg-blood-deep shadow-[inset_0_0_0_1px_#9E2B25]' : 'border border-rule bg-surface'}`}>
              <button type="button" onClick={() => setSelected(id)} className="flex min-h-[48px] flex-1 flex-col items-start text-left">
                <span className="font-serif text-[19px] font-semibold">{p.name}</span>
                {corbeauBonus[id] ? <span className="font-serif text-sm italic text-muted">dont {corbeauBonus[id]} voix du Corbeau</span> : null}
              </button>
              <button type="button" aria-label={`Retirer une voix à ${p.name}`} onClick={() => dispatch({ type: 'ADJUST_VOTES', playerId: id, delta: -1 })}
                className="h-12 w-12 border border-rule bg-ink text-2xl">−</button>
              <span className="w-9 text-center font-display text-2xl font-bold tabular-nums">{votes[id] ?? 0}</span>
              <button type="button" aria-label={`Ajouter une voix à ${p.name}`} onClick={() => dispatch({ type: 'ADJUST_VOTES', playerId: id, delta: 1 })}
                className="h-12 w-12 border border-rule bg-ink text-2xl">+</button>
              <button type="button" aria-label={`Retirer l'accusation de ${p.name}`} onClick={() => dispatch({ type: 'UNACCUSE', playerId: id })}
                className="flex h-12 w-9 items-center justify-center text-muted"><X size={18} /></button>
            </div>
          )
        })}
        {tie && !selected && (
          <p className="px-1 font-serif text-base italic text-blood-text">Égalité : le Capitaine tranche. Touchez le condamné.</p>
        )}
      </div>

      <div className="flex px-4 pt-5">
        <button type="button" onClick={() => dispatch({ type: 'RESET_TIMER' })} className="flex min-h-[44px] items-center gap-2 px-2 font-sans text-[14px] text-muted">
          <RotateCcw size={16} />Minuteur
        </button>
        {DURATIONS.map(d => (
          <button key={d} type="button" onClick={() => dispatch({ type: 'RESET_TIMER', durationSeconds: d })}
            className={`min-h-[44px] px-3 font-sans text-[14px] ${game.timer.durationSeconds === d ? 'font-bold text-bone' : 'text-muted'}`}>{d / 60} min</button>
        ))}
      </div>

      <StickyFooter>
        <SecondaryButton onClick={() => setPicker('accuse')}>Accuser</SecondaryButton>
        {condemned ? (
          <PrimaryButton onClick={() => { dispatch({ type: 'ELIMINATE_BY_VOTE', playerId: condemned.id }); setSelected(null) }}>Éliminer {condemned.name}</PrimaryButton>
        ) : (
          <PrimaryButton onClick={() => dispatch({ type: 'ADVANCE_TO_NIGHT' })} disabled={tie}>La nuit tombe</PrimaryButton>
        )}
      </StickyFooter>

      {picker === 'accuse' && (
        <PickerSheet title="Accuser" players={game.players} onClose={() => setPicker(null)}
          disabledReason={p => (accusedIds.includes(p.id) ? 'accusé' : undefined)}
          onPick={id => { dispatch({ type: 'ACCUSE', playerId: id }); setPicker(null) }} />
      )}
      {picker === 'captain' && (
        <PickerSheet title="Élire le Capitaine" players={game.players} onClose={() => setPicker(null)}
          onPick={id => { dispatch({ type: 'ASSIGN_CAPTAIN', playerId: id }); setPicker(null) }} />
      )}
    </>
  )
}
