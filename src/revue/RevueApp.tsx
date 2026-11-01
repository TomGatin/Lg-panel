import { ChevronLeft, ChevronRight, RotateCcw, Square } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { describeEffects } from '../../shared/cues'
import { buildReviewEvents, ReviewEvent } from '../../shared/review'
import { AudioOutput, CueEffects } from '../../shared/types'
import { SFX_FILES } from '../lib/audio'
import { useLive } from '../lib/live'
import { useShowAudio } from '../lib/useShowAudio'
import { DeniedScreen, ErrorToast, Loading } from '../ui/Feedback'

const EVENTS = buildReviewEvents()
const GROUPS = [...new Set(EVENTS.map(e => e.group))]
const OUTPUTS: [AudioOutput, string][] = [['regie', 'Ce PC'], ['public', 'Écran public']]

/** What is not ready for this event: a sound file or a stagehand scene that does not exist. */
function missingFor(effects: CueEffects, audioFiles: string[] | null, lightMissing: string[]): string[] {
  const missing: string[] = []
  const file = effects.sfx && SFX_FILES[effects.sfx].replace('/audio/', '')
  if (file && audioFiles && !audioFiles.includes(file)) missing.push(`Fichier manquant : ${file}`)
  if (effects.light?.kind === 'scene' && lightMissing.includes(effects.light.name)) missing.push(`Scène manquante : ${effects.light.name}`)
  return missing
}

/** Walks through every sound and light of the game, outside a game. */
export function RevueApp() {
  const status = useLive(s => s.status)
  const snapshot = useLive(s => s.staff)
  const send = useLive(s => s.show)
  const show = snapshot?.show
  const local = show?.audioOutput === 'regie'
  const audio = useShowAudio(show && local ? { ambience: show.ambience, volumes: show.volumes } : undefined)
  const [current, setCurrent] = useState<number | null>(null)
  const [audioFiles, setAudioFiles] = useState<string[] | null>(null)
  const rowRef = useRef<HTMLButtonElement>(null)
  // Effects would land on the room in the middle of a real game.
  const locked = snapshot?.game.phase === 'playing'

  useEffect(() => {
    fetch('/api/assets').then(r => r.json() as Promise<{ audio: string[] }>).then(a => setAudioFiles(a.audio)).catch(() => setAudioFiles(null))
  }, [])
  useEffect(() => { rowRef.current?.scrollIntoView({ block: 'nearest' }) }, [current])

  const actions = useMemo(() => {
    const play = (i: number, from: number | null) => {
      const { screen, ambience, light, sfx, keepSound } = EVENTS[i].effects
      setCurrent(i)
      // Moving on cuts the last sound, as in a game, unless this event carries on the one just before.
      if (!keepSound || from !== i - 1) send({ kind: 'stopSfx' })
      if (screen) send({ kind: 'screen', view: screen })
      if (ambience) send({ kind: 'ambience', id: ambience })
      if (light) send({ kind: 'light', command: light })
      if (sfx) send({ kind: 'sfx', id: sfx })
    }
    return {
      play,
      step: (from: number | null, d: -1 | 1) => play(Math.min(EVENTS.length - 1, Math.max(0, from === null ? 0 : from + d)), from),
      finish: () => {
        setCurrent(null)
        send({ kind: 'stopSfx' })
        send({ kind: 'ambience', id: 'none' })
        send({ kind: 'light', command: { kind: 'blackout' } })
        send({ kind: 'screen', view: 'blackout' })
      }
    }
  }, [send])

  useEffect(() => {
    if (locked) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') actions.step(current, 1)
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') actions.step(current, -1)
      else if (e.code === 'Space') { if (current !== null) actions.play(current, null) }
      else if (e.key === 'Escape') send({ kind: 'stopSfx' })
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actions, current, locked, send])

  if (status === 'denied') return <DeniedScreen />
  if (!snapshot || !show) return <Loading />

  const event: ReviewEvent | undefined = current === null ? undefined : EVENTS[current]
  const button = 'flex min-h-[48px] items-center justify-center gap-2 rounded-md bg-tile px-4 text-[15px] font-semibold disabled:opacity-50'
  const noSound = !local && !snapshot.publicAudio
  return (
    <div className="min-h-screen bg-ink font-sans text-bone">
      {local && !audio.ready && (
        <button type="button" onClick={() => void audio.unlock()}
          className="flex w-full items-center justify-center bg-blood-go py-3 text-[15px] font-bold text-[#FFF6EE]">
          Cliquer ici pour activer le son sur ce PC
        </button>
      )}
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-3">
        <header className="sticky top-0 z-10 flex flex-col gap-3 rounded-lg bg-panel p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="font-display text-xl font-bold tracking-[0.1em]">Revue du spectacle</h1>
            <div className="flex-1" />
            <div className="flex items-center gap-1.5 text-[13px] text-muted">
              Son sur
              {OUTPUTS.map(([target, label]) => (
                <button key={target} type="button" onClick={() => send({ kind: 'audioOutput', target })} aria-pressed={show.audioOutput === target}
                  className={`min-h-[36px] rounded-md px-2.5 font-semibold ${show.audioOutput === target ? 'bg-blood-go text-[#FFF6EE]' : 'bg-tile text-bone'}`}>{label}</button>
              ))}
            </div>
            <span className="text-[13px] text-muted">{snapshot.lightStatus === 'ok' ? 'Lumières connectées' : snapshot.lightStatus === 'fake' ? 'Lumières simulées' : 'Lumières hors ligne'}</span>
          </div>
          {locked && <p className="rounded-md bg-blood-deep p-3 text-[14px]">Une partie est en cours : la revue est bloquée pour ne pas perturber la salle.</p>}
          {noSound && <p className="rounded-md bg-blood-deep p-3 text-[14px]">L'écran public n'a pas activé son audio : aucun son ne sortira. Choisis « Ce PC » ou active le son sur l'écran.</p>}
          <div>
            <p className="font-display text-lg font-bold">{event ? `${(current ?? 0) + 1}/${EVENTS.length} · ${event.title}` : `${EVENTS.length} évènements à vérifier`}</p>
            <p className="text-[14px] text-muted">{event ? describeEffects(event.effects) : 'Flèche droite pour commencer.'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} disabled={locked} onClick={() => actions.step(current, -1)}><ChevronLeft size={18} />Précédent</button>
            <button type="button" className={button} disabled={locked || current === null} onClick={() => current !== null && actions.play(current, null)}><RotateCcw size={16} />Rejouer</button>
            <button type="button" className={`${button.replace('bg-tile', 'bg-blood-go')} flex-1 text-[#FFF6EE]`} disabled={locked} onClick={() => actions.step(current, 1)}>Suivant<ChevronRight size={18} /></button>
            <button type="button" className={button} onClick={() => send({ kind: 'stopSfx' })}><Square size={14} />Couper le son</button>
            <button type="button" className={button} disabled={locked} onClick={actions.finish}>Terminer, tout éteindre</button>
          </div>
        </header>

        {GROUPS.map(group => (
          <section key={group} className="flex flex-col gap-1.5">
            <h2 className="regie-label px-1 pt-2">{group}</h2>
            {EVENTS.map((e, i) => {
              if (e.group !== group) return null
              const missing = missingFor(e.effects, audioFiles, snapshot.lightMissing)
              return (
                <button key={e.id} ref={i === current ? rowRef : undefined} type="button" disabled={locked} onClick={() => actions.play(i, current)}
                  aria-current={i === current}
                  className={`flex scroll-mt-64 flex-col gap-0.5 rounded-md p-3 text-left disabled:opacity-50 ${i === current ? 'bg-tile ring-2 ring-blood-go' : 'bg-panel'}`}>
                  <span className="text-[15px] font-semibold">{e.title}</span>
                  <span className="text-[13px] text-muted">{describeEffects(e.effects)}</span>
                  {missing.map(m => <span key={m} className="text-[13px] font-semibold text-blood-text">{m}</span>)}
                </button>
              )
            })}
          </section>
        ))}
      </div>
      <ErrorToast />
    </div>
  )
}
