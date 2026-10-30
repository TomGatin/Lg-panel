import { Redo2, Undo2 } from 'lucide-react'
import { ReactNode, useEffect, useState } from 'react'
import { describeEffects, hasEffects, isCueBehind, isCueDone, nextCue, SCREEN_LABELS, SFX_LABELS } from '../../shared/cues'
import { StaffSnapshot } from '../../shared/protocol'
import { getCurrentNightStep } from '../../shared/rules'
import { AmbienceId, AudioOutput, Cue, LightCommand, ScreenView, SfxId, Volumes } from '../../shared/types'
import { useLive } from '../lib/live'
import { useShowAudio } from '../lib/useShowAudio'
import { Setup } from '../setup/Setup'
import { DeniedScreen, ErrorToast, Loading } from '../ui/Feedback'
import { RoomPlan } from './RoomPlan'

const SCREENS: ScreenView[] = ['night', 'day', 'reveal', 'debate', 'vote', 'victory', 'blackout']
const PADS: SfxId[] = ['wolves', 'bell', 'gunshot', 'witch', 'rooster', 'bear', 'crow', 'flute']

function Panel({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-lg bg-panel p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="regie-label">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-md bg-tile px-2.5 py-1.5 text-[13px] font-semibold">
      <span className={`h-2 w-2 rounded-full ${ok ? 'bg-ok' : 'bg-blood-go'}`} />{label}
    </span>
  )
}

export function RegieApp() {
  const status = useLive(s => s.status)
  const snapshot = useLive(s => s.staff)
  const show = snapshot?.show
  const local = show?.audioOutput === 'regie'
  const audio = useShowAudio(show && local ? { ambience: show.ambience, volumes: show.volumes } : undefined)

  if (status === 'denied') return <DeniedScreen />
  if (!snapshot) return <Loading />
  return (
    <div className="min-h-screen bg-ink font-sans text-bone">
      {local && !audio.ready && (
        <button type="button" onClick={() => void audio.unlock()}
          className="flex w-full items-center justify-center gap-2 bg-blood-go py-3 text-[15px] font-bold text-[#FFF6EE]">
          Cliquer ici pour activer le son de la régie
        </button>
      )}
      <Console snapshot={snapshot} audioReady={local ? audio.ready : snapshot.publicAudio} />
      <ErrorToast />
    </div>
  )
}

function Console({ snapshot, audioReady }: { snapshot: StaffSnapshot; audioReady: boolean }) {
  const { game, show, cues } = snapshot
  const send = useLive(s => s.show)
  const undo = useLive(s => s.undo)
  const redo = useLive(s => s.redo)
  const [targetSeat, setTargetSeat] = useState<number>()
  const next = nextCue(cues, show)
  const step = game.phase === 'playing' && game.cycle === 'night' ? getCurrentNightStep(game) : undefined

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      // Space is GO everywhere, even on a focused button (which would otherwise replay that button).
      if (e.code !== 'Space' || e.repeat || el.closest('input, select, textarea')) return
      e.preventDefault()
      send({ kind: 'go' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [send])

  const light = (command: LightCommand) => send({ kind: 'light', command })
  const phaseLabel = game.phase === 'setup' ? 'Préparation' : game.phase === 'game_over' ? 'Fin de partie' : `${game.cycle === 'night' ? 'Nuit' : 'Jour'} ${game.roundNumber}`

  return (
    <div className="flex flex-col gap-3 p-3">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-panel px-4 py-3">
        <span className="font-display text-xl font-bold tracking-[0.1em]">Régie</span>
        <span className="rounded-md bg-tile px-3 py-1.5 text-[15px] font-semibold">{phaseLabel}</span>
        {step && <span className="text-[15px] text-muted">MJ sur <strong className="text-bone">{step.title}</strong></span>}
        <div className="flex-1" />
        <Pill ok={snapshot.connected.mj > 0} label="MJ" />
        <Pill ok={snapshot.connected.public > 0} label="Écran" />
        <Pill ok={snapshot.lightStatus !== 'down'} label={snapshot.lightStatus === 'fake' ? 'Lumières simulées' : 'Lumières'} />
        <Pill ok={audioReady} label={show.audioOutput === 'public' ? 'Son TV' : 'Son régie'} />
      </header>

      <main className="flex flex-wrap items-start gap-3">
        <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-3">
          {game.phase === 'setup' ? (
            <div className="rounded-lg bg-panel"><Setup /></div>
          ) : (
            <>
              <NextCue cue={next} onGo={() => send({ kind: 'go' })} />
              <CueList cues={cues} snapshot={snapshot} />
            </>
          )}
          <Panel title="Écran public" aside={<span className="text-[13px] text-muted">affiche : {SCREEN_LABELS[show.screen]}</span>}>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
              {SCREENS.map(v => (
                <button key={v} type="button" onClick={() => send({ kind: 'screen', view: v })}
                  className={`min-h-[46px] rounded-md text-[15px] font-semibold ${show.screen === v ? 'bg-bone text-ink' : 'bg-tile'}`}>
                  {SCREEN_LABELS[v]}
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Journal" aside={
            <div className="flex gap-1.5">
              <button type="button" onClick={undo} disabled={!snapshot.canUndo} className="flex min-h-[36px] items-center gap-1.5 rounded-md bg-tile px-3 text-[14px] font-semibold"><Undo2 size={16} />Annuler</button>
              <button type="button" onClick={redo} disabled={!snapshot.canRedo} className="flex min-h-[36px] items-center gap-1.5 rounded-md bg-tile px-3 text-[14px] font-semibold"><Redo2 size={16} />Rétablir</button>
            </div>
          }>
            <ol className="flex max-h-56 flex-col gap-1 overflow-y-auto text-[14px]">
              {game.logs.slice(0, 60).map(l => (
                <li key={l.id} className={`flex gap-3 ${l.type === 'death' || l.type === 'alert' ? 'text-blood-text' : ''}`}>
                  <span className="shrink-0 tabular-nums text-muted">{l.time.slice(0, 5)}</span>
                  <span className="shrink-0 text-muted">{l.turnLabel}</span>
                  <span>{l.message}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </section>

        <aside className="flex min-w-0 flex-[1_1_380px] flex-col gap-3">
          <Panel title="Plan de salle · clic = lyres">
            <RoomPlan players={game.players} targetSeat={targetSeat}
              onTarget={seat => { setTargetSeat(seat); light({ kind: 'target', seat, color: 'red' }) }} />
          </Panel>
          <SoundPanel ambience={show.ambience} output={show.audioOutput} volumes={show.volumes} />
          <Panel title="Lumière">
            <div className="grid grid-cols-4 gap-1.5">
              <button type="button" onClick={() => light({ kind: 'blackout' })} className="min-h-[52px] rounded-md bg-bone text-[15px] font-bold text-ink">Blackout</button>
              <button type="button" onClick={() => light({ kind: 'full' })} className="min-h-[52px] rounded-md bg-bone text-[15px] font-bold text-ink">Plein feu</button>
              <button type="button" onClick={() => light({ kind: 'strobe' })} className="min-h-[52px] rounded-md bg-bone text-[15px] font-bold text-ink">Strobe</button>
              <button type="button" onClick={() => { setTargetSeat(undefined); light({ kind: 'scene', name: game.cycle === 'night' ? 'night' : 'day' }) }}
                className="min-h-[52px] rounded-md bg-bone text-[15px] font-bold text-ink">Retour</button>
            </div>
          </Panel>
        </aside>
      </main>
    </div>
  )
}

function NextCue({ cue, onGo }: { cue: Cue | undefined; onGo: () => void }) {
  return (
    <div className="flex flex-wrap overflow-hidden rounded-lg bg-blood-deep">
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5 p-5">
        <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-blood-text">
          {cue ? 'Prochaine cue' : 'En attente du MJ'}
        </span>
        <span className="font-display text-[28px] font-bold leading-tight">{cue?.title ?? 'Rien à lancer pour l\'instant'}</span>
        {cue && <span className="text-[15px] text-bone-dim">{describeEffects(cue.effects)}</span>}
      </div>
      <button type="button" onClick={onGo} disabled={!cue}
        className="flex min-h-[120px] flex-[0_0_200px] flex-col items-center justify-center bg-blood-go text-[#FFF6EE] max-sm:flex-1">
        <span className="text-[44px] font-bold leading-none">GO</span>
        <span className="text-[13px] font-semibold">barre espace</span>
      </button>
    </div>
  )
}

function CueList({ cues, snapshot }: { cues: Cue[]; snapshot: StaffSnapshot }) {
  const send = useLive(s => s.show)
  const { show } = snapshot
  const next = nextCue(cues, show)
  const nightAuto = show.autoKinds.includes('night_step')
  return (
    <Panel title="Conduite" aside={
      <label className="flex items-center gap-2 text-[13px] text-muted">
        <input type="checkbox" checked={nightAuto} onChange={e => send({ kind: 'auto', cueKind: 'night_step', on: e.target.checked })} className="h-4 w-4 accent-blood-go" />
        Étapes de nuit en automatique
      </label>
    }>
      <ol className="flex flex-col gap-1">
        {cues.map(cue => {
          const fired = show.firedCueIds.includes(cue.id)
          const done = isCueDone(cue, show) || isCueBehind(cue, cues, show)
          const isNext = cue.id === next?.id
          const mjHere = cue.kind === 'night_step' && cue.ready
          const badge = isNext ? 'Prochaine' : mjHere ? 'MJ ici' : fired ? 'Jouée' : done ? 'Passée' : cue.ready ? 'Prête' : 'À venir'
          const playable = hasEffects(cue)
          return (
            <li key={cue.id} className={`flex flex-wrap items-center gap-x-3.5 gap-y-1 rounded-md px-3 py-2.5 ${isNext ? 'bg-blood-deep' : mjHere ? 'bg-tile' : ''} ${done && !isNext && !mjHere ? 'opacity-45' : ''}`}>
              <span className="min-w-0 flex-[1_1_200px] text-[17px] font-semibold">{cue.title}</span>
              <span className="min-w-0 flex-[1_1_240px] text-[15px] text-bone-dim">{describeEffects(cue.effects)}</span>
              <span className={`rounded-md px-2.5 py-1 text-[13px] font-bold ${isNext ? 'bg-blood-go text-[#FFF6EE]' : mjHere ? 'bg-bone text-ink' : 'text-muted'}`}>{badge}</span>
              <span className="flex w-[118px] justify-end gap-1">
                {playable && <button type="button" onClick={() => send({ kind: 'fire', cueId: cue.id })} className="min-h-[36px] rounded-md bg-tile px-3 text-[13px] font-semibold">Jouer</button>}
                {playable && !done && <button type="button" onClick={() => send({ kind: 'skip', cueId: cue.id })} className="min-h-[36px] rounded-md px-2 text-[13px] text-muted">Passer</button>}
              </span>
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}

function SoundPanel({ ambience, output, volumes }: { ambience: AmbienceId; output: AudioOutput; volumes: Volumes }) {
  const send = useLive(s => s.show)
  const [draft, setDraft] = useState(volumes)
  useEffect(() => setDraft(volumes), [volumes.master, volumes.ambience])
  const setVolume = (key: keyof Volumes, value: number) => {
    setDraft(v => ({ ...v, [key]: value }))
    send({ kind: 'volume', [key]: value })
  }
  return (
    <Panel title="Son">
      <div className="grid grid-cols-2 gap-1.5">
        {(['public', 'regie'] as const).map(target => (
          <button key={target} type="button" onClick={() => send({ kind: 'audioOutput', target })}
            className={`min-h-[44px] rounded-md text-[14px] font-semibold ${output === target ? 'bg-bone text-ink' : 'bg-tile'}`}>
            {target === 'public' ? 'Sortie : écran TV' : 'Sortie : PC régie'}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-[14px] text-bone-dim">Général
        <input type="range" min={0} max={1} step={0.01} value={draft.master} onChange={e => setVolume('master', Number(e.target.value))} className="accent-blood-go" />
      </label>
      <label className="flex flex-col gap-1 text-[14px] text-bone-dim">Ambiance
        <input type="range" min={0} max={1} step={0.01} value={draft.ambience} onChange={e => setVolume('ambience', Number(e.target.value))} className="accent-blood-go" />
      </label>
      <div className="grid grid-cols-3 gap-1.5">
        {(['night', 'day', 'none'] as const).map(id => (
          <button key={id} type="button" onClick={() => send({ kind: 'ambience', id })}
            className={`min-h-[44px] rounded-md text-[14px] font-semibold ${ambience === id ? 'bg-bone text-ink' : 'bg-tile'}`}>
            {id === 'night' ? 'Ambiance nuit' : id === 'day' ? 'Ambiance jour' : 'Silence'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {PADS.map(id => (
          <button key={id} type="button" onClick={() => send({ kind: 'sfx', id })} className="min-h-[52px] rounded-md bg-tile text-[15px] font-semibold active:bg-rule">{SFX_LABELS[id]}</button>
        ))}
      </div>
      <button type="button" onClick={() => send({ kind: 'stopSfx' })}
        className="min-h-[52px] rounded-md bg-blood-go text-[15px] font-bold text-[#FFF6EE] active:opacity-80">Couper les effets</button>
    </Panel>
  )
}
