import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { hasEffects, nextCue } from '../shared/cues'
import { Cue, CueEffects, LightCommand, LightStatus, ShowCommand, ShowState, SfxId } from '../shared/types'
import { LightPort } from './light'

/** An effect to play, or null to cut every effect still playing. */
export type AudioEmitter = (sfx: SfxId | null) => void

const initialShow = (): ShowState => ({
  firedCueIds: [],
  skippedCueIds: [],
  screen: 'blackout',
  ambience: 'none',
  autoKinds: [],
  audioOutput: 'public',
  volumes: { master: 0.8, ambience: 0.5 },
  villageScreen: false
})

const LIGHT_TEST_MS = 2000

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * Régie side of the show: what the projector displays, which cues were played,
 * and the bridge to lights and sound. Not part of the game history: undo never replays effects.
 */
export class ShowController {
  private current: ShowState
  private lightStatus: LightStatus
  private lightTest: ReturnType<typeof setTimeout> | undefined

  constructor(
    private readonly filePath: string | undefined,
    private readonly light: LightPort,
    private readonly emitAudio: AudioEmitter
  ) {
    this.current = filePath && existsSync(filePath)
      ? { ...initialShow(), ...(JSON.parse(readFileSync(filePath, 'utf8')) as Partial<ShowState>) }
      : initialShow()
    this.lightStatus = light.status
    light.onStatusChange(status => this.onLightStatus(status))
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
        if (cmd.view === 'village' && !this.current.villageScreen) return 'L\'écran Village est désactivé.'
        this.current.screen = cmd.view
        this.current.revealIds = undefined
        break
      case 'sfx':
        this.emitAudio(cmd.id)
        break
      case 'stopSfx':
        this.emitAudio(null)
        break
      case 'ambience':
        this.current.ambience = cmd.id
        break
      case 'light':
        this.sendLight(cmd.command)
        break
      case 'auto':
        this.current.autoKinds = cmd.on
          ? [...new Set([...this.current.autoKinds, cmd.cueKind])]
          : this.current.autoKinds.filter(k => k !== cmd.cueKind)
        break
      case 'audioOutput':
        this.current.audioOutput = cmd.target
        break
      case 'villageScreen':
        this.current.villageScreen = cmd.on
        if (!cmd.on && this.current.screen === 'village') this.current.screen = 'blackout'
        break
      case 'testLights':
        // Full on, then back to black: enough to see every fixture answers.
        clearTimeout(this.lightTest)
        void this.light.send({ kind: 'full' })
        this.lightTest = setTimeout(() => void this.light.send({ kind: 'blackout' }), LIGHT_TEST_MS)
        this.lightTest.unref()
        break
      case 'volume':
        this.current.volumes = {
          master: cmd.master === undefined ? this.current.volumes.master : clamp01(cmd.master),
          ambience: cmd.ambience === undefined ? this.current.volumes.ambience : clamp01(cmd.ambience)
        }
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
    this.current.lastLight = undefined
    this.save()
  }

  private fire(cue: Cue): void {
    this.applyEffects(cue.effects)
    if (!this.current.firedCueIds.includes(cue.id)) this.current.firedCueIds.push(cue.id)
  }

  private applyEffects(e: CueEffects): void {
    if (e.screen) {
      this.current.screen = e.screen
      this.current.revealIds = e.reveal
    }
    if (e.ambience) this.current.ambience = e.ambience
    if (e.light) this.sendLight(e.light)
    if (e.sfx) this.emitAudio(e.sfx)
  }

  private sendLight(command: LightCommand): void {
    // A real command must not be blacked out by the end of a test still running.
    clearTimeout(this.lightTest)
    // A strobe is a one-shot: there is no look to bring back.
    if (command.kind !== 'strobe') this.current.lastLight = command
    void this.light.send(command)
  }

  private onLightStatus(status: LightStatus): void {
    const recovered = this.lightStatus === 'down' && status === 'ok'
    this.lightStatus = status
    if (recovered && this.current.lastLight) void this.light.send(this.current.lastLight)
  }

  private save(): void {
    if (!this.filePath) return
    const tmp = `${this.filePath}.tmp`
    writeFileSync(tmp, JSON.stringify(this.current))
    renameSync(tmp, this.filePath)
  }
}
