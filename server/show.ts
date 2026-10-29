import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { hasEffects, nextCue } from '../shared/cues'
import { AmbienceId, Cue, CueEffects, ShowCommand, ShowState, SfxId } from '../shared/types'
import { LightPort } from './light'

export type AudioEmitter = (event: { sfx?: SfxId; ambience?: AmbienceId }) => void

const initialShow = (): ShowState => ({
  firedCueIds: [],
  skippedCueIds: [],
  screen: 'blackout',
  ambience: 'none',
  autoKinds: []
})

/**
 * Régie side of the show: what the projector displays, which cues were played,
 * and the bridge to lights and sound. Not part of the game history: undo never replays effects.
 */
export class ShowController {
  private current: ShowState

  constructor(
    private readonly filePath: string | undefined,
    private readonly light: LightPort,
    private readonly emitAudio: AudioEmitter
  ) {
    this.current = filePath && existsSync(filePath)
      ? { ...initialShow(), ...(JSON.parse(readFileSync(filePath, 'utf8')) as Partial<ShowState>) }
      : initialShow()
  }

  get state(): ShowState {
    return this.current
  }

  /** Returns an error message when the command cannot be applied. */
  command(cmd: ShowCommand, cues: Cue[]): string | undefined {
    switch (cmd.kind) {
      case 'go': {
        const cue = nextCue(cues, this.current)
        if (!cue) return 'Aucune cue prête.'
        this.fire(cue)
        break
      }
      case 'fire': {
        const cue = cues.find(c => c.id === cmd.cueId)
        if (!cue) return 'Cue introuvable.'
        this.fire(cue)
        break
      }
      case 'skip':
        if (!this.current.skippedCueIds.includes(cmd.cueId)) this.current.skippedCueIds.push(cmd.cueId)
        break
      case 'screen':
        this.current.screen = cmd.view
        break
      case 'sfx':
        this.emitAudio({ sfx: cmd.id })
        break
      case 'ambience':
        this.current.ambience = cmd.id
        this.emitAudio({ ambience: cmd.id })
        break
      case 'light':
        void this.light.send(cmd.command)
        break
      case 'auto':
        this.current.autoKinds = cmd.on
          ? [...new Set([...this.current.autoKinds, cmd.cueKind])]
          : this.current.autoKinds.filter(k => k !== cmd.cueKind)
        break
    }
    this.save()
    return undefined
  }

  /** Plays every ready cue whose kind the operator switched to automatic. */
  autoFire(cues: Cue[]): boolean {
    let fired = false
    for (const cue of cues) {
      const done = this.current.firedCueIds.includes(cue.id) || this.current.skippedCueIds.includes(cue.id)
      if (cue.ready && !done && hasEffects(cue) && this.current.autoKinds.includes(cue.kind)) {
        this.fire(cue)
        fired = true
      }
    }
    if (fired) this.save()
    return fired
  }

  /** A new game reuses cue ids (n1-nightfall…), so the played list must start empty. */
  clearCues(): void {
    if (this.current.firedCueIds.length === 0 && this.current.skippedCueIds.length === 0) return
    this.current.firedCueIds = []
    this.current.skippedCueIds = []
    this.save()
  }

  private fire(cue: Cue): void {
    this.applyEffects(cue.effects)
    if (!this.current.firedCueIds.includes(cue.id)) this.current.firedCueIds.push(cue.id)
  }

  private applyEffects(e: CueEffects): void {
    if (e.screen) this.current.screen = e.screen
    if (e.ambience) this.current.ambience = e.ambience
    if (e.light) void this.light.send(e.light)
    if (e.sfx || e.ambience) this.emitAudio({ sfx: e.sfx, ambience: e.ambience })
  }

  private save(): void {
    if (!this.filePath) return
    const tmp = `${this.filePath}.tmp`
    writeFileSync(tmp, JSON.stringify(this.current))
    renameSync(tmp, this.filePath)
  }
}
