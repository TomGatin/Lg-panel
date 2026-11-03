import { Check, ChevronRight } from 'lucide-react'
import { hasEffects, isCueBehind, isCueDone, mjNextCue, SCREEN_LABELS, SFX_LABELS, showAfter } from '../../shared/cues'
import { projectPublic } from '../../shared/project'
import { ROLES } from '../../shared/roles'
import { Cue, GameState, PublicView, ShowState } from '../../shared/types'
import { useLive } from '../lib/live'
import { Screen } from '../public/screens'

function Preview({ label, view, note }: { label: string; view: PublicView; note?: string }) {
  return (
    <figure className="flex min-w-0 flex-1 flex-col gap-1">
      <figcaption className="label-caps truncate">{label}</figcaption>
      <div aria-hidden className="pointer-events-none relative aspect-video overflow-hidden border border-rule bg-ink text-bone [container-type:size]">
        <Screen view={view} />
      </div>
      {note && <span className="truncate font-sans text-[12px] text-muted">{note}</span>}
    </figure>
  )
}

// A cue with no screen of its own (the bear, the crow) leaves the picture as it is: say what it plays instead.
function effectNote(cue: Cue): string {
  const { screen, sfx } = cue.effects
  if (screen) return sfx ? `${SCREEN_LABELS[screen]} · ${SFX_LABELS[sfx]}` : SCREEN_LABELS[screen]
  return sfx ? `Son seul : ${SFX_LABELS[sfx]}` : 'Lumière seule'
}

/** The first cue the show is waiting on, so the MJ knows what unlocks « Suivant ». */
function waitingFor(cues: Cue[], show: ShowState): Cue | undefined {
  let from = 0
  cues.forEach((c, i) => { if (isCueDone(c, show)) from = i + 1 })
  return cues.slice(from).find(c => !c.ready && hasEffects(c) && c.kind !== 'night_step')
}

/**
 * The MJ runs the show from the phone: what the room sees, what comes next, and « Suivant » to play it.
 * The régie can still take over with GO: both move the same cursor, so nothing plays twice.
 */
export function ShowPanel({ game, deaths = false }: { game: GameState; deaths?: boolean }) {
  const send = useLive(s => s.show)
  const cues = useLive(s => s.staff?.cues)
  const show = useLive(s => s.staff?.show)
  if (!cues || !show) return null
  const next = mjNextCue(cues, show)
  const waiting = next ? undefined : waitingFor(cues, show)
  const announced = cues.filter(c => c.playerId !== undefined)

  return (
    <section className="flex flex-col gap-3 border border-rule px-3 py-3">
      <div className="flex gap-2">
        <Preview label="À l'écran" view={projectPublic(game, show)} />
        {next && <Preview label="Ensuite" view={projectPublic(game, showAfter(show, next))} note={effectNote(next)} />}
      </div>
      <div className="flex items-center gap-2 border border-blood bg-blood-deep py-2 pl-3 pr-2">
        <span className="min-w-0 flex-1 truncate font-serif text-[17px] text-[#F6EFE0]">
          {next ? next.title : waiting ? `En attente : ${waiting.title}` : 'Rien à lancer'}
        </span>
        <button type="button" disabled={!next} onClick={() => send({ kind: 'go' })}
          className="flex min-h-[52px] items-center gap-1 bg-blood px-4 font-display text-[15px] font-bold tracking-[0.06em] text-[#F6EFE0] active:bg-blood-go disabled:opacity-40">
          Suivant<ChevronRight size={18} />
        </button>
      </div>
      {deaths && (
        <div className="flex flex-col">
          <span className="label-caps">Morts du jour</span>
          {announced.length === 0 && <p className="font-serif text-[17px] italic text-muted">Personne n'est mort cette nuit.</p>}
          <ul className="flex flex-col">
            {announced.map(cue => {
              const p = game.players.find(x => x.id === cue.playerId)
              if (!p) return null
              const shown = isCueDone(cue, show) || isCueBehind(cue, cues, show)
              const isNext = cue.id === next?.id
              return (
                <li key={cue.id} className={`flex items-baseline gap-2 border-b border-rule py-1.5 ${shown ? 'text-muted' : ''}`}>
                  <span className="w-5 shrink-0 self-center">{shown && <Check size={16} aria-label="révélé" />}</span>
                  <span className="font-serif text-[18px] font-semibold">{p.name}</span>
                  <span className="min-w-0 flex-1 truncate font-serif text-[16px] italic text-blood-text">{ROLES[p.roleId].name}</span>
                  <span className="shrink-0 font-sans text-[12px] text-muted">{isNext ? 'ensuite' : shown ? 'révélé' : 'à révéler'}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
