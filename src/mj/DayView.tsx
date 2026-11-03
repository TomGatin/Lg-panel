import { Check, Pause, Play, RotateCcw, X } from 'lucide-react'
import { ReactNode, useEffect, useRef, useState } from 'react'
import { blockingCue, currentCue, dayCues, isCueDone, mjNextCue } from '../../shared/cues'
import { getServantTarget } from '../../shared/reducer'
import { ROLES } from '../../shared/roles'
import { checkVictory, getBearGrowlStatus, isPlayerWerewolf } from '../../shared/rules'
import { Cue, GameState, Player } from '../../shared/types'
import { haptics } from '../lib/haptics'
import { useLive } from '../lib/live'
import { formatClock, useRemaining } from '../lib/timer'
import { SeatGrid } from '../ui/SeatGrid'
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

/** « étape 3 sur 7 » in the header, like the rites of the night. */
export function dayProgress(cues: Cue[], current: Cue | undefined): { index: number; total: number } {
  const steps = dayCues(cues)
  return { index: current ? steps.indexOf(current) : -1, total: steps.length }
}

/** One moment of the day, full page, like a rite of the night: what to announce, then « Valider ». */
function StepCard({ title, subtitle, prompt, children }: { title: string; subtitle?: ReactNode; prompt?: string; children?: ReactNode }) {
  return (
    <section className="engraved mx-4 mt-4 flex flex-col items-center gap-2 px-5 py-6 text-center">
      <h1 className="font-display text-[32px] font-bold leading-tight tracking-[0.06em]">{title}</h1>
      {subtitle && <span className="font-serif text-[15px] italic text-blood-text">{subtitle}</span>}
      {prompt && <p className="mt-1 font-serif text-[22px] leading-snug">« {prompt} »</p>}
      {children}
    </section>
  )
}

function Notice({ tone = 'info', children }: { tone?: 'info' | 'alert'; children: ReactNode }) {
  return (
    <p className={`border px-4 py-3 font-serif text-[18px] ${tone === 'alert' ? 'border-blood bg-blood-deep text-[#F6EFE0]' : 'border-rule text-bone-dim'}`}>
      {children}
    </p>
  )
}

function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="min-h-[52px] border border-rule px-3 font-display text-[15px] font-bold tracking-[0.06em]">
      {children}
    </button>
  )
}

const DEATH_PROMPTS: Partial<Record<NonNullable<Player['deathReason']>, (name: string) => string>> = {
  chasseur: name => `Dans un dernier souffle, le Chasseur abat ${name}.`,
  vote: name => `Le village a condamné ${name}.`,
  bouc: name => `Le Bouc Émissaire, ${name}, est sacrifié.`
}

/** The night's victims, ticked once their card is turned on the screen. */
function DawnList({ game, cues }: { game: GameState; cues: Cue[] }) {
  const show = useLive(s => s.staff?.show)
  const reveals = cues.filter(c => c.kind === 'reveal' && c.playerId)
  if (reveals.length === 0) return <p className="font-serif text-[17px] italic text-muted">Personne n'est mort cette nuit.</p>
  return (
    <ul className="flex w-full flex-col text-left">
      {reveals.map(cue => {
        const p = game.players.find(x => x.id === cue.playerId)
        if (!p) return null
        const shown = show ? isCueDone(cue, show) : false
        return (
          <li key={cue.id} className={`flex items-baseline gap-2 border-b border-rule py-1.5 ${shown ? 'text-muted' : ''}`}>
            <span className="w-5 shrink-0 self-center">{shown && <Check size={16} aria-label="révélé" />}</span>
            <span className="font-serif text-[18px] font-semibold">{p.name}</span>
            <span className="min-w-0 flex-1 truncate font-serif text-[16px] italic text-blood-text">{ROLES[p.roleId].name}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function DayView({ game }: { game: GameState }) {
  const dispatch = useLive(s => s.dispatch)
  const send = useLive(s => s.show)
  const cues = useLive(s => s.staff?.cues) ?? []
  const show = useLive(s => s.staff?.show)
  const [picker, setPicker] = useState<'accuse' | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  if (!show) return null

  const current = currentCue(cues, show)
  const next = mjNextCue(cues, show)
  const steps = dayCues(cues)
  // The election is a page of its own, from the moment it holds the show until its announcement is played.
  const waitingCaptain = blockingCue(cues, show)
  const index = current ? steps.indexOf(current) : -1
  const go = () => send({ kind: 'go' })

  const byId = (id: string | undefined) => game.players.find(p => p.id === id)
  const alive = game.players.filter(p => p.isAlive)
  const captain = game.players.find(p => p.isCaptain && p.isAlive)
  const powers = !game.villagePowersDisabled
  const wounded = byId(game.night.rustyWoundedWolfId)
  const goat = powers ? alive.find(p => p.roleId === 'bouc_emissaire') : undefined
  const servant = alive.find(p => p.roleId === 'servante_devouee' && !p.isLover)
  const servantTarget = servant ? getServantTarget(game) : undefined
  const judge = powers && !game.judgeUsed ? alive.find(p => p.roleId === 'juge_begue') : undefined
  const votedToday = game.players.some(p => !p.isAlive && p.deathReason === 'vote' && p.deathRound === `Jour ${game.roundNumber}`)

  const { accusedIds, votes, corbeauBonus } = game.vote
  const ranked = [...accusedIds].sort((a, b) => (votes[b] ?? 0) - (votes[a] ?? 0))
  const tie = ranked.length > 1 && (votes[ranked[0]] ?? 0) === (votes[ranked[1]] ?? 0)
  const condemnedId = selected && accusedIds.includes(selected) ? selected : tie ? undefined : ranked[0]
  const condemned = byId(condemnedId)

  const kind = current?.kind
  const nightFalls = game.phase === 'playing' ? () => dispatch({ type: 'ADVANCE_TO_NIGHT' }) : undefined

  // The page of the moment on stage; the footer moves to the next one.
  let page: ReactNode
  let footer: ReactNode = next
    ? <PrimaryButton onClick={go}>Valider</PrimaryButton>
    : nightFalls && <PrimaryButton onClick={nightFalls}>La nuit tombe</PrimaryButton>

  const accusedList = (counting: boolean) => (
    <div className="flex flex-col gap-1.5 px-4 pt-4">
      {accusedIds.length === 0 && <p className="px-1 font-serif text-lg italic text-muted">Aucun accusé pour l'instant.</p>}
      {/* In the order of accusation: rows must not jump around while the votes are counted. */}
      {accusedIds.map(id => {
        const p = byId(id)
        if (!p) return null
        const isPick = counting && condemnedId === id
        return (
          <div key={id} className={`flex items-center gap-1.5 py-2 pl-3 pr-2 ${isPick ? 'border border-blood bg-blood-deep shadow-[inset_0_0_0_1px_#9E2B25]' : 'border border-rule bg-surface'}`}>
            <button type="button" onClick={() => counting && setSelected(id)} className="flex min-h-[48px] flex-1 flex-col items-start justify-center text-left text-bone">
              <span className="font-serif text-[19px] font-semibold">{p.name}</span>
              {corbeauBonus[id] ? <span className="font-serif text-sm italic text-muted">dont {corbeauBonus[id]} voix du Corbeau</span> : null}
            </button>
            {counting && (
              <>
                <button type="button" aria-label={`Retirer une voix à ${p.name}`} onClick={() => dispatch({ type: 'ADJUST_VOTES', playerId: id, delta: -1 })}
                  className="h-12 w-12 border border-rule bg-ink text-2xl">−</button>
                <span className="w-9 text-center font-display text-2xl font-bold tabular-nums">{votes[id] ?? 0}</span>
                <button type="button" aria-label={`Ajouter une voix à ${p.name}`} onClick={() => dispatch({ type: 'ADJUST_VOTES', playerId: id, delta: 1 })}
                  className="h-12 w-12 border border-rule bg-ink text-2xl">+</button>
              </>
            )}
            <button type="button" aria-label={`Retirer l'accusation de ${p.name}`} onClick={() => dispatch({ type: 'UNACCUSE', playerId: id })}
              className="flex h-12 w-9 items-center justify-center text-muted"><X size={18} /></button>
          </div>
        )
      })}
    </div>
  )

  if (kind === 'election') {
    page = (
      <>
        <StepCard title="Élection du Capitaine" subtitle={captain ? captain.name : 'à désigner'}
          prompt="Avant de débattre, le village doit élire son Capitaine. Qui choisissez-vous ?">
          <p className="font-sans text-[14px] text-muted">En cas d'égalité au vote, le Capitaine tranche.</p>
        </StepCard>
        <div className="px-4 pt-4">
          <SeatGrid players={game.players} selectedIds={captain ? [captain.id] : []}
            onPick={id => { if (captain?.id !== id) dispatch({ type: 'ASSIGN_CAPTAIN', playerId: id }) }} />
        </div>
      </>
    )
    footer = <PrimaryButton onClick={go} disabled={waitingCaptain !== undefined}>Valider</PrimaryButton>
  } else switch (kind) {
    case undefined:
    case 'daybreak':
      page = (
        <StepCard title="Lever du jour" subtitle={`${alive.length} encore en vie`}
          prompt="Le soleil se lève sur Thiercelieux. Tout le village se réveille.">
          <span className="label-caps mt-3 self-start">Morts de la nuit</span>
          <DawnList game={game} cues={cues} />
        </StepCard>
      )
      break
    case 'reveal': {
      const p = byId(current?.playerId)
      page = p ? (
        <StepCard title={p.name} subtitle={ROLES[p.roleId].name} prompt={`${p.name} ne se réveillera pas. Sa carte : ${ROLES[p.roleId].name}.`}>
          <span className="label-caps mt-3 self-start">Morts de la nuit</span>
          <DawnList game={game} cues={cues} />
        </StepCard>
      ) : (
        <StepCard title="Aucune victime" prompt="Par miracle, personne n'est mort cette nuit." />
      )
      break
    }
    case 'bear': {
      const bear = getBearGrowlStatus(game.players)
      const growls = bear?.growls === true
      const neighbors = bear?.leftNeighbor && bear.rightNeighbor ? `${bear.leftNeighbor.name} et ${bear.rightNeighbor.name}` : undefined
      page = (
        <StepCard title={growls ? 'L\'ours grogne' : 'L\'ours se tait'} subtitle={`Montreur d'Ours : ${bear?.bear?.name ?? '?'}`}
          prompt={growls ? 'Grrr… L\'ours du Montreur grogne ce matin !' : 'Ce matin, l\'ours du Montreur reste silencieux.'}>
          <p className="font-sans text-[14px] text-muted">
            {growls
              ? bear?.bear?.isInfected && !(bear.leftNeighbor && isPlayerWerewolf(bear.leftNeighbor, game.players)) && !(bear.rightNeighbor && isPlayerWerewolf(bear.rightNeighbor, game.players))
                ? 'Le Montreur est infecté : son ours grogne chaque matin.'
                : `Un loup est assis à côté du Montreur${neighbors ? ` (voisins : ${neighbors})` : ''}.`
              : `Aucun loup parmi ses voisins${neighbors ? ` (${neighbors})` : ''}.`}
          </p>
        </StepCard>
      )
      break
    }
    case 'crow': {
      const [id, bonus] = Object.entries(corbeauBonus)[0] ?? []
      const target = byId(id)
      page = (
        <StepCard title="Le Corbeau" subtitle={target?.name}
          prompt={target ? `Le Corbeau a désigné ${target.name} : ${bonus} voix de plus au vote.` : 'Le Corbeau a désigné un suspect.'} />
      )
      break
    }
    case 'captain':
      page = (
        <StepCard title="Capitaine" subtitle={captain?.name}
          prompt={captain ? `${captain.name} est élu Capitaine. En cas d'égalité, il tranche.` : undefined} />
      )
      break
    case 'debate':
      page = (
        <>
          <StepCard title="Débat" prompt="Le village délibère. Qui accusez-vous ?">
            <p className="font-sans text-[14px] text-muted">Le minuteur tourne en haut à droite.</p>
          </StepCard>
          {accusedList(false)}
          <div className="flex px-4 pt-4">
            <button type="button" onClick={() => dispatch({ type: 'RESET_TIMER' })} className="flex min-h-[44px] items-center gap-2 px-2 font-sans text-[14px] text-muted">
              <RotateCcw size={16} />Minuteur
            </button>
            {DURATIONS.map(d => (
              <button key={d} type="button" onClick={() => dispatch({ type: 'RESET_TIMER', durationSeconds: d })}
                className={`min-h-[44px] px-3 font-sans text-[14px] ${game.timer.durationSeconds === d ? 'font-bold text-bone' : 'text-muted'}`}>{d / 60} min</button>
            ))}
          </div>
        </>
      )
      footer = (
        <>
          <SecondaryButton onClick={() => setPicker('accuse')}>Accuser</SecondaryButton>
          {next && <PrimaryButton onClick={go}>{next.kind === 'vote' ? 'Passer au vote' : 'Valider'}</PrimaryButton>}
        </>
      )
      break
    case 'vote':
      page = (
        <>
          <StepCard title={current?.id.endsWith('vote2') ? 'Second vote' : 'Le vote'} subtitle={`${alive.length} votants${captain ? ` · capitaine ${captain.name}` : ''}`}
            prompt="À trois, chaque joueur désigne la personne à éliminer." />
          {accusedList(true)}
          {tie && !selected && (
            <p className="px-5 pt-2 font-serif text-base italic text-blood-text">
              {goat ? `Égalité : le Bouc Émissaire (${goat.name}) est sacrifié.` : 'Égalité : le Capitaine tranche. Touchez le condamné.'}
            </p>
          )}
        </>
      )
      footer = (
        <>
          <SecondaryButton onClick={() => setPicker('accuse')}>Accuser</SecondaryButton>
          {condemned ? (
            <PrimaryButton onClick={() => { dispatch({ type: 'ELIMINATE_BY_VOTE', playerId: condemned.id }); setSelected(null) }}>Éliminer {condemned.name}</PrimaryButton>
          ) : tie && goat ? (
            <PrimaryButton onClick={() => dispatch({ type: 'SCAPEGOAT' })}>Sacrifier {goat.name}</PrimaryButton>
          ) : next ? (
            <PrimaryButton onClick={go}>Valider</PrimaryButton>
          ) : nightFalls && (
            <PrimaryButton onClick={nightFalls} disabled={tie}>La nuit tombe</PrimaryButton>
          )}
        </>
      )
      break
    case 'death': {
      const p = byId(current?.playerId)
      const role = p ? ROLES[p.roleId].name : ''
      const lead = p ? (DEATH_PROMPTS[p.deathReason ?? 'vote']?.(p.name) ?? `${p.name} meurt à son tour.`) : ''
      page = (
        <>
          <StepCard title={p?.name ?? 'Élimination'} subtitle={role} prompt={p ? `${lead} Sa carte : ${role}.` : undefined} />
          <div className="flex flex-col gap-2 px-4 pt-4">
            {servant && servantTarget && p?.id === servantTarget.id && (
              <ActionButton onClick={() => dispatch({ type: 'SERVANT_TAKE_ROLE' })}>La Servante ({servant.name}) prend le rôle de {servantTarget.name}</ActionButton>
            )}
            {judge && votedToday && game.phase === 'playing' && (
              <ActionButton onClick={() => dispatch({ type: 'JUDGE_SECOND_VOTE' })}>Second vote (Juge Bègue)</ActionButton>
            )}
          </div>
        </>
      )
      break
    }
    case 'victory': {
      const victory = checkVictory(game)
      page = <StepCard title={victory?.title ?? 'Fin de partie'} prompt={victory?.description} />
      break
    }
    default:
      page = <StepCard title={current?.title ?? 'Jour'} />
  }

  return (
    <>
      <div className="flex gap-1 px-5 pt-3" aria-hidden>
        {steps.map((s, i) => (
          <span key={s.id} className={`h-1 flex-1 ${i < index ? 'bg-muted' : i === index ? 'bg-blood-go' : 'bg-rule'}`} />
        ))}
      </div>

      {page}

      <div className="flex flex-col gap-2 px-4 pt-4">
        {wounded && wounded.isAlive && (kind === 'debate' || kind === 'vote') && (
          <Notice>{wounded.name} est blessé par l'épée rouillée : il mourra cette nuit.</Notice>
        )}
      </div>

      <StickyFooter>
        {footer}
      </StickyFooter>

      {picker === 'accuse' && (
        <PickerSheet title="Accuser" players={game.players} onClose={() => setPicker(null)}
          disabledReason={p => (accusedIds.includes(p.id) ? 'accusé' : undefined)}
          onPick={id => { dispatch({ type: 'ACCUSE', playerId: id }); setPicker(null) }} />
      )}
    </>
  )
}
