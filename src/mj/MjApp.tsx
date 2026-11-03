import { useEffect, useState } from 'react'
import { ROLES } from '../../shared/roles'
import { currentCue, mjNextCue } from '../../shared/cues'
import { checkVictory, getNightSteps } from '../../shared/rules'
import { Player } from '../../shared/types'
import { haptics } from '../lib/haptics'
import { onAck, useLive } from '../lib/live'
import { DeniedScreen, ErrorToast, Loading } from '../ui/Feedback'
import { useWakeLock } from '../ui/useWakeLock'
import { Setup } from '../setup/Setup'
import { dayProgress, DayView, TimerControls } from './DayView'
import { NightView } from './NightView'
import { CardReveal, MjHeader, PendingPrompts, PrimaryButton, ScreenSheet, StickyFooter, VillageSheet } from './parts'

export function MjApp() {
  const status = useLive(s => s.status)
  const game = useLive(s => s.staff?.game)
  const cues = useLive(s => s.staff?.cues)
  const show = useLive(s => s.staff?.show)
  const dispatch = useLive(s => s.dispatch)
  const [village, setVillage] = useState(false)
  const [screenSheet, setScreenSheet] = useState(false)
  const [inspect, setInspect] = useState<{ player: Player; context?: string } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  useWakeLock()
  useEffect(() => onAck(ok => (ok ? haptics.tick() : haptics.error())), [])

  if (status === 'denied') return <DeniedScreen />
  if (!game) return <Loading />

  // The day's pages run on until the victory is on screen, even when the game ended at dawn.
  const showPending = cues && show ? mjNextCue(cues, show) !== undefined : false
  const progress = cues && show ? dayProgress(cues, currentCue(cues, show)) : { index: -1, total: 0 }

  let body
  if (game.phase === 'setup') {
    body = <Setup />
  } else if (game.phase === 'game_over' && !(showPending && game.cycle === 'day')) {
    const victory = checkVictory(game)
    body = (
      <>
        <section className="engraved mx-4 mt-4 flex flex-col items-center gap-3 px-5 py-6 text-center">
          <h1 className="font-display text-[28px] font-bold tracking-[0.06em]">{victory?.title ?? 'Fin de partie'}</h1>
          <p className="font-serif text-xl">{victory?.description}</p>
        </section>
        <ul className="mx-4 mt-4 font-serif text-lg">
          {game.players.map(p => (
            <li key={p.id} className={`flex justify-between border-b border-rule py-2 ${p.isAlive ? '' : 'text-muted line-through'}`}>
              <span>{p.name}</span><span className="italic">{ROLES[p.roleId].name}</span>
            </li>
          ))}
        </ul>
        <StickyFooter>
          <PrimaryButton onClick={() => (confirmReset ? dispatch({ type: 'RESET_GAME' }) : setConfirmReset(true))}>
            {confirmReset ? 'Confirmer : nouvelle partie' : 'Nouvelle partie'}
          </PrimaryButton>
        </StickyFooter>
      </>
    )
  } else if (game.cycle === 'night') {
    const steps = getNightSteps(game)
    const done = steps.filter(s => game.night.completedSteps[s.id]).length
    body = (
      <>
        <MjHeader game={game} onVillage={() => setVillage(true)} onScreen={() => setScreenSheet(true)}
          subtitle={done < steps.length ? `rite ${done + 1} sur ${steps.length}` : 'tous les rites accomplis'} />
        <NightView game={game} onInspect={(player, context) => setInspect({ player, context })} />
      </>
    )
  } else {
    body = (
      <>
        <MjHeader game={game} onVillage={() => setVillage(true)} onScreen={() => setScreenSheet(true)} right={<TimerControls game={game} />}
          subtitle={progress.index >= 0 ? `étape ${progress.index + 1} sur ${progress.total}` : 'lever du jour'} />
        <DayView game={game} />
      </>
    )
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-ink font-serif">
      {body}
      {game.phase !== 'setup' && <PendingPrompts game={game} />}
      {screenSheet && <ScreenSheet onClose={() => setScreenSheet(false)} />}
      {village && <VillageSheet game={game} onClose={() => setVillage(false)} onInspect={p => setInspect({ player: p })} />}
      {inspect && <CardReveal player={inspect.player} players={game.players} context={inspect.context} onClose={() => setInspect(null)} />}
      <ErrorToast />
    </div>
  )
}
